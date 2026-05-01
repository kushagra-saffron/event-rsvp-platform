-- Phase 1 PRD: publication + access modes, RSVP lifecycle, speakers, safe reads via RPC, RLS tightening.

-- -----------------------------------------------------------------------------
-- New enums
-- -----------------------------------------------------------------------------
create type public.event_access_mode as enum ('open', 'approval_required', 'invite_only');
create type public.event_publication_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.rsvp_guest_status as enum ('pending', 'confirmed', 'cancelled', 'rejected');

-- -----------------------------------------------------------------------------
-- Events: PRD-aligned columns (additive + backfill)
-- -----------------------------------------------------------------------------
alter table public.events
  add column if not exists slug text,
  add column if not exists short_description text not null default '',
  add column if not exists full_description text,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists meeting_platform text,
  add column if not exists access_mode public.event_access_mode not null default 'open',
  add column if not exists publication_status public.event_publication_status not null default 'published',
  add column if not exists max_capacity integer,
  add column if not exists invite_token uuid default gen_random_uuid(),
  add column if not exists completed_at timestamptz;

update public.events
set
  full_description = coalesce(nullif(trim(full_description), ''), description),
  short_description = case
    when nullif(trim(short_description), '') is not null then short_description
    else left(regexp_replace(description, '\s+', ' ', 'g'), 280)
  end,
  slug = coalesce(
    nullif(trim(slug), ''),
    lower(regexp_replace(left(title, 60), '[^a-Za-z0-9]+', '-', 'g')) || '-' || substr(replace(id::text, '-', ''), 1, 8)
  )
where true;

alter table public.events alter column full_description set not null;
alter table public.events alter column slug set not null;

create unique index if not exists events_slug_unique on public.events (slug);

-- -----------------------------------------------------------------------------
-- RSVP: migrate legacy enum to PRD lifecycle
-- -----------------------------------------------------------------------------
alter table public.rsvps rename column status to legacy_rsvp_status;
alter table public.rsvps add column status public.rsvp_guest_status not null default 'pending';

update public.rsvps r
set status = case r.legacy_rsvp_status::text
  when 'going' then 'confirmed'::public.rsvp_guest_status
  when 'maybe' then 'pending'::public.rsvp_guest_status
  when 'declined' then 'cancelled'::public.rsvp_guest_status
end;

alter table public.rsvps drop column legacy_rsvp_status;
drop type public.rsvp_status;

alter table public.rsvps add column if not exists confirmed_at timestamptz;
alter table public.rsvps add column if not exists reminder_48h_sent_at timestamptz;

update public.rsvps
set confirmed_at = coalesce(confirmed_at, timestamp)
where status = 'confirmed';

create index if not exists rsvps_event_status_guest_idx on public.rsvps (event_id, status);

-- -----------------------------------------------------------------------------
-- Speakers (Phase 1 minimal)
-- -----------------------------------------------------------------------------
create table public.event_speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  title text,
  organisation text,
  bio text,
  display_order int not null default 0
);

create index event_speakers_event_id_idx on public.event_speakers (event_id);

alter table public.event_speakers enable row level security;

-- -----------------------------------------------------------------------------
-- Replace host participant RPC return type
-- -----------------------------------------------------------------------------
drop function if exists public.get_event_participants(uuid);

create or replace function public.get_event_participants(target_event_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  status public.rsvp_guest_status,
  response_data jsonb,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = target_event_id and e.creator_id = auth.uid()
  ) then
    raise exception 'Only the event creator can view participant details';
  end if;

  return query
  select
    r.user_id,
    p.display_name,
    u.email::text,
    r.status,
    r.response_data,
    r.timestamp
  from public.rsvps r
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.event_id = target_event_id
  order by r.timestamp desc;
end;
$$;

grant execute on function public.get_event_participants(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: published events for discovery (state A safe fields)
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
  creator_display_name text
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
    p.display_name as creator_display_name
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
-- RPC: event detail bundle with progressive disclosure (PRD §4.1)
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
stable
as $$
declare
  ev record;
  org_name text;
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

  select p.display_name into org_name from public.profiles p where p.id = ev.creator_id;

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
    'organizer', jsonb_build_object('id', ev.creator_id, 'display_name', org_name),
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

-- -----------------------------------------------------------------------------
-- RPC: RSVP submit (capacity + open vs approval + invite token)
-- -----------------------------------------------------------------------------
create or replace function public.submit_rsvp(
  p_slug text,
  p_response_data jsonb,
  p_invite_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  uid uuid := auth.uid();
  existing record;
  confirmed_count bigint;
  new_status public.rsvp_guest_status;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into ev
  from public.events e
  where e.slug = p_slug
    and e.publication_status = 'published'
    and e.cancelled_at is null;

  if ev.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if ev.access_mode = 'invite_only' then
    if p_invite_token is null or p_invite_token <> ev.invite_token then
      return jsonb_build_object('ok', false, 'error', 'invite_required');
    end if;
  end if;

  select * into existing from public.rsvps r where r.event_id = ev.id and r.user_id = uid;
  if found and existing.status in ('pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'error', 'already_rsvped', 'status', existing.status::text);
  end if;

  select count(*)::bigint into confirmed_count
  from public.rsvps r
  where r.event_id = ev.id and r.status = 'confirmed';

  if ev.max_capacity is not null and confirmed_count >= ev.max_capacity and ev.access_mode = 'open' then
    return jsonb_build_object('ok', false, 'error', 'capacity_reached');
  end if;

  if ev.access_mode = 'open' then
    new_status := 'confirmed'::public.rsvp_guest_status;
  else
    new_status := 'pending'::public.rsvp_guest_status;
  end if;

  insert into public.rsvps (event_id, user_id, status, response_data, confirmed_at)
  values (
    ev.id,
    uid,
    new_status,
    coalesce(p_response_data, '{}'::jsonb),
    case when new_status = 'confirmed' then now() else null end
  )
  on conflict (event_id, user_id) do update set
    status = excluded.status,
    response_data = excluded.response_data,
    timestamp = now(),
    confirmed_at = excluded.confirmed_at;

  return jsonb_build_object(
    'ok', true,
    'status', new_status::text,
    'slug', ev.slug,
    'title', ev.title,
    'access_mode', ev.access_mode::text,
    'start_datetime', ev.start_datetime,
    'end_datetime', ev.end_datetime
  );
end;
$$;

grant execute on function public.submit_rsvp(text, jsonb, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Cron: 48h reminder batch (service_role; joining details only for confirmed)
-- -----------------------------------------------------------------------------
create or replace function public.get_48h_reminder_targets()
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
    and r.reminder_48h_sent_at is null
    and e.publication_status = 'published'
    and e.cancelled_at is null
    and e.start_datetime >= now() + interval '47 hours'
    and e.start_datetime <= now() + interval '49 hours';
$$;

grant execute on function public.get_48h_reminder_targets() to service_role;

create or replace function public.mark_rsvp_reminder_sent(p_rsvp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rsvps
  set reminder_48h_sent_at = now()
  where id = p_rsvp_id;
end;
$$;

grant execute on function public.mark_rsvp_reminder_sent(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- RLS refresh (events + rsvps + speakers)
-- -----------------------------------------------------------------------------
drop policy if exists "events_select_all" on public.events;
drop policy if exists "rsvps_select_all" on public.rsvps;

create policy "events_select_host_or_published_participant"
  on public.events for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.rsvps r
      where r.event_id = events.id and r.user_id = auth.uid()
    )
  );

create policy "rsvps_select_own_or_host"
  on public.rsvps for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = rsvps.event_id and e.creator_id = auth.uid()
    )
  );

create policy "event_speakers_select_authenticated_event_visible"
  on public.event_speakers for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_speakers.event_id
        and e.publication_status = 'published'
        and e.cancelled_at is null
        and (
          e.creator_id = auth.uid()
          or exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = auth.uid())
        )
    )
  );

create policy "event_speakers_all_for_host"
  on public.event_speakers for all
  to authenticated
  using (
    exists (select 1 from public.events e where e.id = event_speakers.event_id and e.creator_id = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_speakers.event_id and e.creator_id = auth.uid())
  );
