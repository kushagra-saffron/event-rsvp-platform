-- Ensure column exists locally and reload PostgREST schema cache so
-- Supabase REST sees `events.rsvp_form_fields` immediately after migrations.
alter table public.events
  add column if not exists rsvp_form_fields jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
