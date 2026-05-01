-- Events: optional marketing images (square thumbnail + wide banner URLs to public bucket).
alter table public.events
  add column if not exists thumbnail_image_url text,
  add column if not exists banner_image_url text;

-- Storage buckets (public read URLs for MVP).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
   array['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'image/gif'::text]),
  ('event_images', 'event_images', true, 10485760,
   array['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'image/gif'::text])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- --- storage.objects policies: avatars (first path segment = auth user id)

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- --- event_images: path {creator_id}/{event_id}/{filename}

drop policy if exists "event_images_select_public" on storage.objects;
create policy "event_images_select_public"
  on storage.objects for select to public
  using (bucket_id = 'event_images');

drop policy if exists "event_images_insert_creator" on storage.objects;
create policy "event_images_insert_creator"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event_images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.events ev
      where ev.id::text = split_part(name, '/', 2)
        and ev.creator_id = auth.uid()
    )
  );

drop policy if exists "event_images_update_creator" on storage.objects;
create policy "event_images_update_creator"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event_images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.events ev
      where ev.id::text = split_part(name, '/', 2)
        and ev.creator_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event_images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.events ev
      where ev.id::text = split_part(name, '/', 2)
        and ev.creator_id = auth.uid()
    )
  );

drop policy if exists "event_images_delete_creator" on storage.objects;
create policy "event_images_delete_creator"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event_images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.events ev
      where ev.id::text = split_part(name, '/', 2)
        and ev.creator_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- list_published_events: thumbnail + organizer avatar on cards
-- -----------------------------------------------------------------------------
create or replace function public.list_published_events(
  p_limit int default 50,
  p_offset int default 0,
  p_city text default null,
  p_search text default null
)
returns table (
  id uuid,
  slug text,
  title varchar(100),
  short_description text,
  event_type public.event_type,
  access_mode public.event_access_mode,
  start_datetime timestamptz,
  end_datetime timestamptz,
  timezone text,
  location_city text,
  max_capacity integer,
  confirmed_count bigint,
  creator_display_name text,
  thumbnail_image_url text,
  creator_avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id,
    e.slug,
    e.title,
    e.short_description,
    e.event_type,
    e.access_mode,
    e.start_datetime,
    e.end_datetime,
    e.timezone,
    e.location_city,
    e.max_capacity,
    (
      select count(*)::bigint from public.rsvps r
      where r.event_id = e.id and r.status = 'confirmed'
    ) as confirmed_count,
    p.display_name as creator_display_name,
    e.thumbnail_image_url as thumbnail_image_url,
    p.avatar_url as creator_avatar_url
  from public.events e
  join public.profiles p on p.id = e.creator_id
  where e.publication_status = 'published'
    and e.cancelled_at is null
    and (p_city is null or trim(p_city) = '' or e.location_city ilike '%' || trim(p_city) || '%')
    and (
      p_search is null or trim(p_search) = ''
      or e.title ilike '%' || trim(p_search) || '%'
      or e.short_description ilike '%' || trim(p_search) || '%'
    )
  order by e.start_datetime asc
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

grant execute on function public.list_published_events(int, int, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_event_by_slug: public narrative for everyone + image URLs + organizer avatar
-- -----------------------------------------------------------------------------
drop function if exists public.get_event_by_slug(text);
drop function if exists public.get_event_by_slug(text, uuid);

create or replace function public.get_event_by_slug(
  p_slug text,
  p_invite_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
volatile
as $$
declare
  ev record;
  org_name text;
  org_handle text;
  org_avatar_url text;
  uid uuid := auth.uid();
  is_host boolean := false;
  viewer text := 'A';
  has_rsvp boolean := false;
  r_status public.rsvp_guest_status;
  r_response jsonb;
  r_updated_at timestamptz;
  spk jsonb := '[]'::jsonb;
  confirmed_ct bigint;
  invite_ok boolean := false;
  show_rsvp_fields boolean;
begin
  select e.* into ev
  from public.events e
  where e.slug = p_slug
    and e.publication_status = 'published'
    and e.cancelled_at is null;

  if ev.id is null then
    return null;
  end if;

  invite_ok :=
    ev.access_mode <> 'invite_only'
    or (p_invite_token is not null and p_invite_token = ev.invite_token);

  select p.display_name, p.handle, p.avatar_url
    into org_name, org_handle, org_avatar_url
  from public.profiles p
  where p.id = ev.creator_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', s.name,
      'title', s.title,
      'organisation', s.organisation,
      'bio', s.bio
    ) order by s.display_order, s.name
  ), '[]'::jsonb)
  into spk
  from public.event_speakers s
  where s.event_id = ev.id;

  if uid is not null and ev.creator_id = uid then
    is_host := true;
    viewer := 'F';
  elsif uid is not null then
    select r.status, coalesce(r.response_data, '{}'::jsonb), r.timestamp
      into r_status, r_response, r_updated_at
    from public.rsvps r
    where r.event_id = ev.id and r.user_id = uid
    limit 1;
    has_rsvp := FOUND;
    if has_rsvp then
      if r_status = 'pending' then viewer := 'C';
      elsif r_status = 'confirmed' then
        if ev.publication_status = 'completed' or ev.end_datetime < now() then viewer := 'E';
        else viewer := 'D';
        end if;
      elsif r_status in ('rejected', 'cancelled') then viewer := 'B';
      end if;
    else
      viewer := 'B';
    end if;
  else
    viewer := 'A';
  end if;

  show_rsvp_fields :=
    viewer = 'B' and invite_ok and (
      not has_rsvp
      or (has_rsvp and r_status in ('rejected', 'cancelled'))
    );

  select count(*)::bigint into confirmed_ct
  from public.rsvps r
  where r.event_id = ev.id and r.status = 'confirmed';

  return jsonb_build_object(
    'id', ev.id,
    'slug', ev.slug,
    'title', ev.title,
    'event_type', ev.event_type,
    'access_mode', ev.access_mode,
    'publication_status', ev.publication_status,
    'start_datetime', ev.start_datetime,
    'end_datetime', ev.end_datetime,
    'timezone', ev.timezone,
    'max_capacity', ev.max_capacity,
    'confirmed_count', confirmed_ct,
    'thumbnail_image_url', ev.thumbnail_image_url,
    'banner_image_url', ev.banner_image_url,
    'organizer', jsonb_build_object(
      'id', ev.creator_id,
      'display_name', org_name,
      'handle', org_handle,
      'avatar_url', org_avatar_url
    ),
    'viewer', viewer,
    'is_host', is_host,
    'short_description', ev.short_description,
    'full_description', ev.full_description,
    'speakers', spk,
    'city', case when ev.event_type = 'physical' then ev.location_city else null end,
    'venue_name', case when viewer in ('D','E','F') and ev.event_type = 'physical' then ev.venue_name else null end,
    'venue_address', case when viewer in ('D','E','F') and ev.event_type = 'physical' then ev.venue_address else null end,
    'meeting_platform', case when viewer in ('D','E','F') and ev.event_type = 'digital' then ev.meeting_platform else null end,
    'meeting_link', case when viewer in ('D','E','F') and ev.event_type = 'digital' then ev.meeting_link else null end,
    'rsvp_form_fields', case
      when is_host then ev.rsvp_form_fields
      when show_rsvp_fields then ev.rsvp_form_fields
      else null
    end,
    'rsvp', case
      when uid is null then null
      when is_host then null
      else jsonb_build_object(
        'status', case when has_rsvp then r_status::text else null end,
        'response_data', case when has_rsvp then coalesce(r_response, '{}'::jsonb) else '{}'::jsonb end,
        'updated_at', case when has_rsvp then r_updated_at else null end
      )
    end
  );
end;
$$;

grant execute on function public.get_event_by_slug(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
