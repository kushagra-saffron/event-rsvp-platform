import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventBundle } from "@/lib/events/types";
import { buildGoogleCalendarUrl, buildIcsDataUrl } from "@/lib/calendar";

export default async function RsvpConfirmedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect(`/events/${slug}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/events/${slug}/confirmed`)}`);
  }

  const { data: raw, error } = await supabase.rpc("get_event_by_slug", {
    p_slug: slug,
  });

  if (error || raw == null) {
    redirect("/");
  }

  const bundle = raw as EventBundle;
  const status = bundle.rsvp?.status;
  if (!status || (status !== "confirmed" && status !== "pending")) {
    redirect(`/events/${slug}`);
  }

  const start = new Date(bundle.start_datetime);
  const end = new Date(bundle.end_datetime);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const eventUrl = `${site.replace(/\/$/, "")}/events/${slug}`;

  const gcal =
    status === "confirmed"
      ? buildGoogleCalendarUrl({
          title: bundle.title,
          details: `MoneyStage event\n${eventUrl}`,
          start,
          end,
          timezone: bundle.timezone,
        })
      : null;

  const ics =
    status === "confirmed"
      ? buildIcsDataUrl({
          title: bundle.title,
          description: `MoneyStage\n${eventUrl}`,
          start,
          end,
          url: eventUrl,
        })
      : null;

  return (
    <div className="min-h-full bg-white text-black">
      <main className="mx-auto max-w-3xl px-6 py-14">
        <Link
          href={`/events/${slug}`}
          className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-black"
        >
          ← Back to event
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
          RSVP received
        </p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-tight md:text-5xl">
          {status === "confirmed" ? "You are confirmed" : "Pending review"}
        </h1>
        <p className="mt-4 text-lg font-semibold text-zinc-800">{bundle.title}</p>
        <p className="mt-2 text-sm text-zinc-600">
          {start.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          ({bundle.timezone})
        </p>

        {status === "pending" ? (
          <p className="mt-8 border-2 border-black bg-amber-50 p-5 text-sm leading-relaxed">
            The host will review your RSVP. You will receive another email when you
            are confirmed. Joining details are only sent after confirmation.
          </p>
        ) : (
          <p className="mt-8 border-2 border-black bg-lime-50 p-5 text-sm leading-relaxed">
            You are confirmed for this event. We emailed you the same summary with
            joining details where applicable.
          </p>
        )}

        {status === "confirmed" && gcal && ics ? (
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href={gcal}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center border-4 border-black bg-black px-5 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-white hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              Add to Google Calendar
            </a>
            <a
              href={ics}
              download={`${slug}.ics`}
              className="inline-flex flex-1 items-center justify-center border-4 border-black px-5 py-4 text-center text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-100"
            >
              Download .ics
            </a>
          </div>
        ) : null}

        <div className="mt-12 border-2 border-black bg-zinc-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Share
          </p>
          <p className="mt-2 break-all text-sm font-medium">{eventUrl}</p>
        </div>
      </main>
    </div>
  );
}
