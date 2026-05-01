-- Surface organizer avatar on public profile RPC.
create or replace function public.get_organizer_profile(p_handle text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with org as (
    select p.id, p.display_name, p.handle, p.bio, p.avatar_url
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
        'bio', o.bio,
        'avatar_url', o.avatar_url
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

notify pgrst, 'reload schema';
