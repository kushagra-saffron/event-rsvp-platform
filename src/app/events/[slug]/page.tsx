import { Suspense } from "react";
import { EventSlugFetcher } from "./event-slug-fetcher";

function LoadingShell() {
  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-white px-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
        Loading event…
      </p>
    </div>
  );
}

/**
 * Loads the event bundle on the client (same Supabase path as Explore) so SSR env/cookies,
 * caching, or JSON-RPC shape quirks cannot silently 404 valid events on Vercel.
 */
export default function EventPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <EventSlugFetcher />
    </Suspense>
  );
}
