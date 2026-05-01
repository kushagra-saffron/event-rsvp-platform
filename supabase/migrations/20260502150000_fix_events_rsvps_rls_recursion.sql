-- -----------------------------------------------------------------------------
-- Break RLS infinite recursion between `events` and `rsvps`.
--
-- `events_select_host_or_published_participant` referenced `rsvps`, while
-- `rsvps_select_own_or_host` referenced `events` — Postgres re-evaluates policies
-- and raises: "infinite recursion detected in policy for relation \"events\"".
--
-- SECURITY DEFINER helpers read underlying rows without re-entering caller RLS.
-- -----------------------------------------------------------------------------

create or replace function public.actor_is_creator_of_event(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.creator_id = auth.uid()
  );
$$;

create or replace function public.actor_has_rsvp_for_event(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rsvps r
    where r.event_id = p_event_id and r.user_id = auth.uid()
  );
$$;

create or replace function public.actor_can_view_event_as_attendee_teaser_context(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.publication_status = 'published'
      and e.cancelled_at is null
      and (
        e.creator_id = auth.uid()
        or exists (
          select 1 from public.rsvps r
          where r.event_id = e.id and r.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.actor_can_select_event_resource(
  p_event_id uuid,
  p_visibility public.resource_visibility,
  p_specific_user_ids uuid[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.publication_status = 'completed'
      and (
        e.creator_id = auth.uid()
        or exists (
          select 1 from public.rsvps r
          where r.event_id = e.id
            and r.user_id = auth.uid()
            and r.status = 'confirmed'
            and (
              p_visibility = 'all_confirmed'::public.resource_visibility
              or auth.uid() = any(p_specific_user_ids)
            )
        )
      )
  );
$$;

revoke all on function public.actor_is_creator_of_event(uuid) from public;
revoke all on function public.actor_has_rsvp_for_event(uuid) from public;
revoke all on function public.actor_can_view_event_as_attendee_teaser_context(uuid) from public;
revoke all on function public.actor_can_select_event_resource(uuid, public.resource_visibility, uuid[])
  from public;

grant execute on function public.actor_is_creator_of_event(uuid) to authenticated;
grant execute on function public.actor_has_rsvp_for_event(uuid) to authenticated;
grant execute on function public.actor_can_view_event_as_attendee_teaser_context(uuid) to authenticated;
grant execute on function public.actor_can_select_event_resource(uuid, public.resource_visibility, uuid[])
  to authenticated;

drop policy if exists "events_select_host_or_published_participant" on public.events;
create policy "events_select_host_or_published_participant"
  on public.events for select
  to authenticated
  using (
    creator_id = auth.uid()
    or public.actor_has_rsvp_for_event(events.id)
  );

drop policy if exists "rsvps_select_own_or_host" on public.rsvps;
create policy "rsvps_select_own_or_host"
  on public.rsvps for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.actor_is_creator_of_event(rsvps.event_id)
  );

drop policy if exists "event_speakers_select_authenticated_event_visible" on public.event_speakers;
create policy "event_speakers_select_authenticated_event_visible"
  on public.event_speakers for select
  to authenticated
  using (
    public.actor_can_view_event_as_attendee_teaser_context(event_speakers.event_id)
  );

drop policy if exists "event_speakers_all_for_host" on public.event_speakers;
create policy "event_speakers_all_for_host"
  on public.event_speakers for all
  to authenticated
  using (public.actor_is_creator_of_event(event_speakers.event_id))
  with check (public.actor_is_creator_of_event(event_speakers.event_id));

drop policy if exists "event_resources_select_confirmed_or_host" on public.event_resources;
create policy "event_resources_select_confirmed_or_host"
  on public.event_resources for select
  to authenticated
  using (
    public.actor_can_select_event_resource(
      event_resources.event_id,
      event_resources.visibility,
      event_resources.specific_user_ids
    )
  );

drop policy if exists "event_resources_modify_host_only" on public.event_resources;
create policy "event_resources_modify_host_only"
  on public.event_resources for all
  to authenticated
  using (public.actor_is_creator_of_event(event_resources.event_id))
  with check (public.actor_is_creator_of_event(event_resources.event_id));
