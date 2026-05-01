-- Add custom RSVP fields and participant response payloads.
alter table public.events
  add column if not exists rsvp_form_fields jsonb not null default '[]'::jsonb;

alter table public.rsvps
  add column if not exists response_data jsonb not null default '{}'::jsonb;

-- Host-only participant details including email + custom RSVP responses.
create or replace function public.get_event_participants(target_event_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  status public.rsvp_status,
  response_data jsonb,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.events e
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
