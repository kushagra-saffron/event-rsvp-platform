-- Event RSVP Platform — initial schema (Supabase + Postgres)
-- PRD "Users" entity: public.profiles (id = auth.users.id); email lives on auth.users.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.event_type as enum ('physical', 'digital');
create type public.rsvp_status as enum ('going', 'maybe', 'declined');

-- -----------------------------------------------------------------------------
-- Profiles (maps to PRD Users; no email column — use auth.users.email server-side)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  google_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_google_id_idx on public.profiles (google_id) where google_id is not null;

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete restrict,
  title varchar(100) not null,
  description text not null default '',
  event_type public.event_type not null,
  location_city text,
  meeting_link text,
  timezone text not null default 'Asia/Kolkata',
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint events_end_after_start check (end_datetime > start_datetime),
  constraint events_physical_digital check (
    (event_type = 'physical' and location_city is not null and trim(location_city) <> '')
    or
    (event_type = 'digital' and meeting_link is not null and trim(meeting_link) <> '')
  )
);

create index events_start_datetime_idx on public.events (start_datetime)
  where cancelled_at is null;

create index events_event_type_idx on public.events (event_type)
  where cancelled_at is null;

create index events_creator_id_idx on public.events (creator_id);

-- -----------------------------------------------------------------------------
-- RSVPs
-- -----------------------------------------------------------------------------
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null,
  timestamp timestamptz not null default now(),
  unique (event_id, user_id)
);

create index rsvps_event_id_idx on public.rsvps (event_id);
create index rsvps_user_id_idx on public.rsvps (user_id);
create index rsvps_event_status_idx on public.rsvps (event_id, status);

-- -----------------------------------------------------------------------------
-- Auth: sync new Google (or any) user into profiles
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, google_id)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1),
      'Guest'
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'sub'), '')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    google_id = coalesce(excluded.google_id, public.profiles.google_id),
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;

-- Profiles: readable for discovery / RSVP social proof; users update only their row
create policy "profiles_select_all"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Events: public read; hosts manage their rows
create policy "events_select_all"
  on public.events for select
  to anon, authenticated
  using (true);

create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "events_update_own"
  on public.events for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- RSVPs: public read (going counts / avatars); users insert/update/delete own row
create policy "rsvps_select_all"
  on public.rsvps for select
  to anon, authenticated
  using (true);

create policy "rsvps_insert_own"
  on public.rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "rsvps_update_own"
  on public.rsvps for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "rsvps_delete_own"
  on public.rsvps for delete
  to authenticated
  using (auth.uid() = user_id);
