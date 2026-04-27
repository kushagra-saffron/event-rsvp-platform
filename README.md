# Event RSVP Platform (MVP)

Web app for creating, discovering, and RSVPing to **physical** (city) and **digital** (meeting link) events. Stack: **Next.js**, **Supabase** (Postgres + Auth), **Tailwind CSS**, deployed on **Vercel**.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Vercel](https://vercel.com) account (for deployment)

## Local setup

```bash
cd event-rsvp-platform
npm install
cp .env.example .env.local
```

Fill `.env.local` with your Supabase project URL and anon key (Settings → API).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database (Supabase)

1. In the Supabase SQL editor, run the migration in order:

   `supabase/migrations/20260427120000_initial_schema.sql`

   Or use the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase db push` after linking the project.

2. **Authentication → Providers:** enable **Google**. Add the OAuth client ID/secret from Google Cloud Console.

3. **Authentication → URL configuration:** set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`) and add the same under **Redirect URLs**, plus `http://localhost:3000` for local dev.

4. Optional: set `NEXT_PUBLIC_SITE_URL` in Vercel to your production URL so any client-side redirect helpers stay consistent.

### PRD mapping

| PRD | Implementation |
|-----|----------------|
| Users | `auth.users` (email) + `public.profiles` (`display_name`, `avatar_url`, `google_id`) |
| Events | `public.events` (includes `timezone` default `Asia/Kolkata`, `cancelled_at` for soft cancel) |
| RSVPs | `public.rsvps` with `unique(event_id, user_id)` |

`start_datetime` / `end_datetime` are stored as **UTC** (`timestamptz`). The host picks **local date/time** and **`timezone`** (IANA, default IST); the app layer should convert to UTC on write and format using the event timezone on read.

## GitHub + Vercel

1. Create a new empty repository on GitHub.
2. From this directory:

   ```bash
   git init
   git add .
   git commit -m "Initial scaffold: Next.js, Supabase, Tailwind"
   git branch -M main
   git remote add origin https://github.com/<org>/<repo>.git
   git push -u origin main
   ```

3. In Vercel: **Import** the GitHub repo, set **Framework Preset** to Next.js, and add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as in Supabase API settings).

## Next implementation steps

- Google sign-in UI and session-aware header
- Event create wizard, listing, detail, RSVP mutations
- Dashboard: hosted events and my RSVPs
- Server-side datetime conversion using `timezone` + limited Markdown for descriptions

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |
