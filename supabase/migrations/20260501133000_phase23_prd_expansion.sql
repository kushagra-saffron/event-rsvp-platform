-- PRD expansion: attendee moderation, cancellation windows, resources, organizer profiles/follows.

alter table public.profiles
  add column if not exists handle text,
  add column if not exists bio text not null default '';

update public.profiles
set handle = coalesce(
  nullif(trim(handle), ''),
  lower(regexp_replace(coalesce(nullif(trim(display_name), ''), split_part(id::text, '-', 1)), '[^a-z0-9]+', '-', 'g'))
)
where true;

alter table public.profiles alter column handle set not null;
create unique index if not exists profiles_handle_unique on public.profiles (handle);

alter table public.rsvps
  add column if not exists cancelled_at timestamptz,
  add column if not exists review_note text;

create type public.event_resource_type as enum ('video_link', 'pdf', 'doc_link', 'text_summary');
create type public.resource_visibility as enum ('all_confirmed', 'specific');

create table if not exists public.event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  type public.event_resource_type not null,
  title text not null,
  url text,
  content text,
  visibility public.resource_visibility not null default 'all_confirmed',
  specific_user_ids uuid[] not null default '{}',
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint event_resources_payload_check check (
    (type = 'text_summary' and content is not null and trim(content) <> '')
    or (type <> 'text_summary' and url is not null and trim(url) <> '')
  )
);

create index if not exists event_resources_event_id_idx on public.event_resources (event_id);

create table if not exists public.organizer_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, organizer_id),
  constraint organizer_follows_no_self_follow check (follower_id <> organizer_id)
);

alter table public.event_resources enable row level security;
alter table public.organizer_follows enable row level security;

drop policy if exists "event_resources_select_confirmed_or_host" on public.event_resources;
create policy "event_resources_select_confirmed_or_host"
  on public.event_resources for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_resources.event_id
        and e.publication_status = 'completed'
        and (
          e.creator_id = auth.uid()
          or exists (
            select 1 from public.rsvps r
            where r.event_id = e.id
              and r.user_id = auth.uid()
              and r.status = 'confirmed'
              and (
                event_resources.visibility = 'all_confirmed'
                or auth.uid() = any(event_resources.specific_user_ids)
              )
          )
        )
    )
  );

drop policy if exists "event_resources_modify_host_only" on public.event_resources;
create policy "event_resources_modify_host_only"
  on public.event_resources for all
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_resources.event_id and e.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_resources.event_id and e.creator_id = auth.uid()
    )
  );

drop policy if exists "organizer_follows_select_all" on public.organizer_follows;
create policy "organizer_follows_select_all"
  on public.organizer_follows for select
  to anon, authenticated
  using (true);

drop policy if exists "organizer_follows_insert_own" on public.organizer_follows;
create policy "organizer_follows_insert_own"
  on public.organizer_follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "organizer_follows_delete_own" on public.organizer_follows;
create policy "organizer_follows_delete_own"
  on public.organizer_follows for delete
  to authenticated
  using (auth.uid() = follower_id);

create or replace function public.cancel_own_rsvp(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into ev
  from public.events
  where slug = p_slug and publication_status in ('published', 'completed') and cancelled_at is null;

  if ev.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if ev.start_datetime <= now() + interval '2 hours' then
    return jsonb_build_object('ok', false, 'error', 'cancellation_window_closed');
  end if;

  update public.rsvps
  set status = 'cancelled',
      cancelled_at = now(),
      timestamp = now()
  where event_id = ev.id and user_id = uid and status in ('pending', 'confirmed');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_active_rsvp');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_own_rsvp(text) to authenticated;

create or replace function public.host_set_rsvp_status(
  p_event_id uuid,
  p_user_id uuid,
  p_status public.rsvp_guest_status,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  select * into ev from public.events where id = p_event_id;
  if ev.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if ev.creator_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_status not in ('confirmed', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  update public.rsvps
  set status = p_status,
      review_note = p_review_note,
      confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
      timestamp = now()
  where event_id = p_event_id and user_id = p_user_id and status in ('pending', 'confirmed');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'rsvp_not_found');
  end if;

  return jsonb_build_object('ok', true, 'status', p_status::text);
end;
$$;

grant execute on function public.host_set_rsvp_status(uuid, uuid, public.rsvp_guest_status, text) to authenticated;

create or replace function public.host_set_event_state(
  p_event_id uuid,
  p_publication_status public.event_publication_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set publication_status = p_publication_status,
      cancelled_at = case when p_publication_status = 'cancelled' then now() else cancelled_at end,
      completed_at = case when p_publication_status = 'completed' then now() else completed_at end
  where id = p_event_id and creator_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_found_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.host_set_event_state(uuid, public.event_publication_status) to authenticated;

create or replace function public.upsert_event_resource(
  p_event_id uuid,
  p_type public.event_resource_type,
  p_title text,
  p_url text default null,
  p_content text default null,
  p_visibility public.resource_visibility default 'all_confirmed',
  p_specific_user_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  rid uuid;
begin
  select * into ev
  from public.events
  where id = p_event_id and creator_id = auth.uid();

  if ev.id is null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if ev.publication_status <> 'completed' then
    return jsonb_build_object('ok', false, 'error', 'event_not_completed');
  end if;

  insert into public.event_resources (
    event_id, type, title, url, content, visibility, specific_user_ids, uploaded_by
  )
  values (
    p_event_id, p_type, p_title, p_url, p_content, p_visibility, coalesce(p_specific_user_ids, '{}'), auth.uid()
  )
  returning id into rid;

  return jsonb_build_object('ok', true, 'id', rid);
end;
$$;

grant execute on function public.upsert_event_resource(uuid, public.event_resource_type, text, text, text, public.resource_visibility, uuid[]) to authenticated;

create or replace function public.get_event_resources_by_slug(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', er.id,
        'type', er.type,
        'title', er.title,
        'url', er.url,
        'content', er.content,
        'created_at', er.created_at
      ) order by er.created_at desc
    ),
    '[]'::jsonb
  )
  from public.event_resources er
  join public.events e on e.id = er.event_id
  where e.slug = p_slug;
$$;

grant execute on function public.get_event_resources_by_slug(text) to authenticated;

create or replace function public.follow_organizer(p_organizer_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  insert into public.organizer_follows (follower_id, organizer_id)
  values (auth.uid(), p_organizer_id)
  on conflict do nothing
  returning jsonb_build_object('ok', true);
$$;

grant execute on function public.follow_organizer(uuid) to authenticated;

create or replace function public.unfollow_organizer(p_organizer_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  delete from public.organizer_follows
  where follower_id = auth.uid() and organizer_id = p_organizer_id
  returning jsonb_build_object('ok', true);
$$;

grant execute on function public.unfollow_organizer(uuid) to authenticated;
