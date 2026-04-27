import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">Event RSVP</span>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Sign in with Google
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Host and join events in one place
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
            Physical events by city, digital events with a meeting link. Sign in
            with Google to create events or RSVP. Discovery feed and dashboards
            ship in upcoming sprints.
          </p>
        </div>

        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
          <p className="text-sm font-medium text-zinc-800">Upcoming events</p>
          <p className="mt-2 text-sm">
            Connect Supabase and run the migration in{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              supabase/migrations
            </code>{" "}
            to enable data. Then wire this feed to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              public.events
            </code>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
