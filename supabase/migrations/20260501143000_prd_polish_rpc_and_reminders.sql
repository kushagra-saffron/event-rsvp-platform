-- PRD polish: handle-based organizer profile RPC, improved event bundle, 2h reminder plumbing.

alter table public.rsvps
  add column if not exists reminder_2h_sent_at timestamptz;

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
stable
as $$
declare
  ev record;
  org_name text;
  org_handle text;
  rsvp record;
  uid uuid := auth.uid();
  is_host boolean := false;
  viewer text := 'A';
  has_rsvp boolean := false;
  spk jsonb := '[]'::jsonb;
  confirmed_ct bigint;
  invite_ok boolean := false;
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

  select p.display_name, p.handle
    into org_name, org_handle
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
    select * into rsvp from public.rsvps r
    where r.event_id = ev.id and r.user_id = uid
    limit 1;
    has_rsvp := FOUND;
    if has_rsvp then
      if rsvp.status = 'pending' then viewer := 'C';
      elsif rsvp.status = 'confirmed' then
        if ev.publication_status = 'completed' or ev.end_datetime < now() then viewer := 'E';
        else viewer := 'D';
        end if;
      elsif rsvp.status in ('rejected', 'cancelled') then viewer := 'B';
      end if;
    else
      viewer := 'B';
    end if;
  else
    viewer := 'A';
  end if;

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
    'organizer', jsonb_build_object(
      'id', ev.creator_id,
      'display_name', org_name,
      'handle', org_handle
    ),
    'viewer', viewer,
    'is_host', is_host,
    'short_description', ev.short_description,
    'full_description', case when viewer in ('B','C','D','E','F') then ev.full_description else null end,
    'speakers', case when viewer in ('B','C','D','E','F') then spk else null end,
    'city', case when viewer in ('B','C','D','E','F') and ev.event_type = 'physical' then ev.location_city else null end,
    'venue_name', case when viewer in ('D','E','F') and ev.event_type = 'physical' then ev.venue_name else null end,
    'venue_address', case when viewer in ('D','E','F') and ev.event_type = 'physical' then ev.venue_address else null end,
    'meeting_platform', case when viewer in ('D','E','F') and ev.event_type = 'digital' then ev.meeting_platform else null end,
    'meeting_link', case when viewer in ('D','E','F') and ev.event_type = 'digital' then ev.meeting_link else null end,
    'rsvp_form_fields', case
      when is_host then ev.rsvp_form_fields
      when viewer = 'B' and (not has_rsvp or rsvp.status in ('rejected', 'cancelled')) and invite_ok
      then ev.rsvp_form_fields
      else null
    end,
    'rsvp', case
      when uid is null then null
      when is_host then null
      else jsonb_build_object(
        'status', case when has_rsvp then rsvp.status::text else null end,
        'response_data', case when has_rsvp then coalesce(rsvp.response_data, '{}'::jsonb) else '{}'::jsonb end,
        'updated_at', case when has_rsvp then rsvp.timestamp else null end
      )
    end
  );
end;
$$;

grant execute on function public.get_event_by_slug(text, uuid) to anon, authenticated;

create or replace function public.get_organizer_profile(p_handle text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with org as (
    select p.id, p.display_name, p.handle, p.bio
    from public.profiles p
    where p.handle = p_handle
    limit 1
  ),
  org_events as (
    select
      e.id,
      e.slug,
      e.title,
      e.start_datetime,
      e.end_datetime,
      e.event_type,
      e.publication_status,
      (
        select count(*)::int
        from public.rsvps r
        where r.event_id = e.id and r.status = 'confirmed'
      ) as confirmed_count
    from public.events e
    join org o on o.id = e.creator_id
    where e.publication_status in ('published', 'completed')
      and e.cancelled_at is null
    order by e.start_datetime desc
  )
  select case when exists (select 1 from org) then jsonb_build_object(
    'organizer', (
      select jsonb_build_object(
        'id', o.id,
        'display_name', o.display_name,
        'handle', o.handle,
        'bio', o.bio
      ) from org o
    ),
    'follower_count', (
      select count(*)::int
      from public.organizer_follows f
      join org o on o.id = f.organizer_id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', oe.id,
        'slug', oe.slug,
        'title', oe.title,
        'start_datetime', oe.start_datetime,
        'end_datetime', oe.end_datetime,
        'event_type', oe.event_type,
        'publication_status', oe.publication_status,
        'confirmed_count', oe.confirmed_count
      )), '[]'::jsonb)
      from org_events oe
    ),
    'total_confirmed_attendees', (
      select coalesce(sum(oe.confirmed_count), 0)::int from org_events oe
    )
  ) else null end;
$$;

grant execute on function public.get_organizer_profile(text) to anon, authenticated;

create or replace function public.get_2h_reminder_targets()
returns table (
  rsvp_id uuid,
  attendee_email text,
  attendee_display_name text,
  event_slug text,
  event_title varchar(100),
  start_datetime timestamptz,
  end_datetime timestamptz,
  timezone text,
  event_type public.event_type,
  venue_name text,
  venue_address text,
  meeting_platform text,
  meeting_link text,
  location_city text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    r.id,
    u.email::text,
    coalesce(p.display_name, ''),
    e.slug,
    e.title,
    e.start_datetime,
    e.end_datetime,
    e.timezone,
    e.event_type,
    e.venue_name,
    e.venue_address,
    e.meeting_platform,
    e.meeting_link,
    e.location_city
  from public.rsvps r
  join public.events e on e.id = r.event_id
  join auth.users u on u.id = r.user_id
  join public.profiles p on p.id = r.user_id
  where r.status = 'confirmed'
    and r.reminder_2h_sent_at is null
    and e.publication_status = 'published'
    and e.cancelled_at is null
    and e.start_datetime >= now() + interval '1 hour'
    and e.start_datetime <= now() + interval '3 hours';
$$;

grant execute on function public.get_2h_reminder_targets() to service_role;

create or replace function public.mark_rsvp_reminder_2h_sent(p_rsvp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rsvps
  set reminder_2h_sent_at = now()
  where id = p_rsvp_id;
end;
$$;

grant execute on function public.mark_rsvp_reminder_2h_sent(uuid) to service_role;
