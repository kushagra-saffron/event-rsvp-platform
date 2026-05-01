-- -----------------------------------------------------------------------------
-- Fix PostgreSQL 55000: record "rsvp" is not assigned yet.
--
-- `get_event_by_slug` used `rsvp record` plus expressions like
-- `(not has_rsvp or rsvp.status in (...))`. When `uid` is null, `SELECT INTO rsvp`
-- never runs; some eval paths still referenced `rsvp`, or `OR` did not short-
-- circuit before `rsvp.status`, triggering "tuple structure ... indeterminate".
--
-- Use scalar columns (NULL when no row) and a nested CASE that never reads RSVP
-- fields unless `has_rsvp` is true.
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
