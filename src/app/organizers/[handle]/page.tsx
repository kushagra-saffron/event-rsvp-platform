import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowControls } from "./follow-controls";

type OrganizerProfileResult = {
  organizer: {
    id: string;
    display_name: string | null;
    handle: string;
    bio: string | null;
  };
  follower_count: number;
  total_confirmed_attendees: number;
  events: Array<{
    id: string;
    slug: string;
    title: string;
    start_datetime: string;
    end_datetime: string;
    event_type: "physical" | "digital";
    publication_status: "published" | "completed";
    confirmed_count: number;
  }>;
};

export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_organizer_profile", {
    p_handle: handle,
  });

  if (!data) notFound();
  const profile = data as OrganizerProfileResult;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-black uppercase tracking-tight">
        {profile.organizer.display_name || "Organizer"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">@{profile.organizer.handle}</p>
      <p className="mt-4 text-sm text-zinc-700">
        {profile.organizer.bio || "Finance events host on MoneyStage."}
      </p>
      <div className="mt-4 flex flex-wrap gap-6 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
        <span>Followers: {profile.follower_count ?? 0}</span>
        <span>Total attendees: {profile.total_confirmed_attendees ?? 0}</span>
      </div>

      <FollowControls organizerId={profile.organizer.id} />

      <section className="mt-10">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          Events
        </h2>
        <div className="mt-4 space-y-3">
          {(profile.events ?? []).map((event) => (
            <article key={event.id} className="border-2 border-black p-4">
              <Link
                href={`/events/${event.slug}`}
                className="text-lg font-black uppercase tracking-tight underline"
              >
                {event.title}
              </Link>
              <p className="text-sm text-zinc-600">
                {new Date(event.start_datetime).toLocaleString()} ·{" "}
                {event.event_type === "digital" ? "Online" : "In person"} ·{" "}
                {event.confirmed_count} confirmed
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
