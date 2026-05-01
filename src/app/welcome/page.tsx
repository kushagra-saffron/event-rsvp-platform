"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronDown, ChevronUp, PlusSquare, TrendingUp } from "lucide-react";

type EventSummary = {
  id: string;
  slug: string;
  title: string;
  event_type: "physical" | "digital";
  location_city: string | null;
  meeting_link: string | null;
  start_datetime: string;
  end_datetime: string;
  publication_status?: string;
  access_mode?: string;
  rsvp_form_fields?: Array<{ label: string }>;
};

type AttendingEvent = {
  event: EventSummary;
  status: string;
};

type Participant = {
  user_id: string;
  display_name: string;
  email: string;
  status: string;
  response_data: Record<string, string>;
};

function bucketByDate<T extends { start_datetime: string; end_datetime: string }>(
  items: T[],
) {
  const now = new Date();
  return {
    past: items.filter((item) => new Date(item.end_datetime) < now),
    current: items.filter(
      (item) =>
        new Date(item.start_datetime) <= now && new Date(item.end_datetime) >= now,
    ),
    future: items.filter((item) => new Date(item.start_datetime) > now),
  };
}

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("Member");
  const [createdEvents, setCreatedEvents] = useState<EventSummary[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<AttendingEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [participantsByEvent, setParticipantsByEvent] = useState<
    Record<string, Participant[]>
  >({});

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    void (async () => {
      const hasDemoCookie = document.cookie.includes("moneystage_demo_auth=1");
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (hasDemoCookie && process.env.NODE_ENV === "development") {
          setDisplayName("Demo User");
          setCreatedEvents([
            {
              id: "demo-created-1",
              slug: "moneystage-demo-sip",
              title: "MoneyStage Demo: SIP Planning",
              event_type: "digital",
              location_city: null,
              meeting_link: "https://meet.google.com/demo-one",
              start_datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              end_datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
              rsvp_form_fields: [{ label: "LinkedIn URL" }],
            },
          ]);
          setAttendingEvents([
            {
              status: "confirmed",
              event: {
                id: "demo-attending-1",
                slug: "index-investing-ama-demo",
                title: "Index Investing AMA",
                event_type: "physical",
                location_city: "Mumbai",
                meeting_link: null,
                start_datetime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                end_datetime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
              },
            },
          ]);
          setParticipantsByEvent({
            "demo-created-1": [
              {
                user_id: "p1",
                display_name: "Aanya Gupta",
                email: "aanya@example.com",
                status: "confirmed",
                response_data: { "LinkedIn URL": "https://linkedin.com/in/aanyagupta" },
              },
            ],
          });
        }
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (hasDemoCookie && process.env.NODE_ENV === "development") {
          setDisplayName("Demo User");
          setCreatedEvents([]);
          setAttendingEvents([]);
          setLoading(false);
          return;
        }
        router.replace("/login?next=/welcome");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const [createdResult, attendingResult] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id,slug,title,event_type,location_city,meeting_link,start_datetime,end_datetime,rsvp_form_fields,publication_status,access_mode",
          )
          .eq("creator_id", user.id)
          .is("cancelled_at", null)
          .order("start_datetime", { ascending: true }),
        supabase
          .from("rsvps")
          .select(
            "status, events!inner(id,slug,title,event_type,location_city,meeting_link,start_datetime,end_datetime,publication_status)",
          )
          .eq("user_id", user.id)
          .in("status", ["confirmed", "pending"])
          .order("timestamp", { ascending: false }),
      ]);

      setDisplayName(profile?.display_name || user.user_metadata?.full_name || "Member");
      setCreatedEvents((createdResult.data ?? []) as EventSummary[]);
      const normalizedAttending: AttendingEvent[] = (attendingResult.data ?? [])
        .map((row: { status: string; events: EventSummary[] | EventSummary }) => ({
          status: row.status,
          event: Array.isArray(row.events) ? row.events[0] : row.events,
        }))
        .filter((item) => Boolean(item.event?.id));
      setAttendingEvents(normalizedAttending);
      setLoading(false);
    })();
  }, [router]);

  async function toggleParticipants(eventId: string) {
    const nextId = expandedEventId === eventId ? null : eventId;
    setExpandedEventId(nextId);
    if (!nextId || participantsByEvent[nextId]) return;

    const hasDemoCookie = document.cookie.includes("moneystage_demo_auth=1");
    if (hasDemoCookie && process.env.NODE_ENV === "development") return;

    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase.rpc("get_event_participants", {
      target_event_id: nextId,
    });
    setParticipantsByEvent((prev) => ({
      ...prev,
      [nextId]: (data as Participant[]) ?? [],
    }));
  }

  async function signOut() {
    document.cookie =
      "moneystage_demo_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.replace("/");
  }

  const createdBuckets = bucketByDate(createdEvents);
  const attendingBuckets = bucketByDate(attendingEvents.map((item) => item.event));

  function renderEventList(
    title: string,
    events: EventSummary[],
    canViewParticipants: boolean,
  ) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          {title} ({events.length})
        </h3>
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => {
              const expanded = expandedEventId === event.id;
              const participants = participantsByEvent[event.id] ?? [];
              return (
                <div key={event.id} className="border-2 border-black bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-black uppercase tracking-tight">
                        {event.title}
                      </p>
                      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                        {new Date(event.start_datetime).toLocaleString()} -{" "}
                        {new Date(event.end_datetime).toLocaleString()}
                      </p>
                      {event.slug ? (
                        <Link
                          href={`/events/${event.slug}`}
                          className="mt-2 inline-block text-xs font-black uppercase tracking-[0.15em] underline"
                        >
                          View public page
                        </Link>
                      ) : null}
                    </div>
                    {canViewParticipants ? (
                      <button
                        onClick={() => void toggleParticipants(event.id)}
                        className="inline-flex items-center gap-2 border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em] hover:bg-zinc-100"
                      >
                        Participants
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  {canViewParticipants && expanded ? (
                    <div className="mt-4 border-t border-zinc-200 pt-4">
                      {participants.length ? (
                        <div className="space-y-2">
                          {participants.map((participant) => (
                            <div
                              key={participant.user_id}
                              className="rounded border border-zinc-300 p-3 text-sm"
                            >
                              <p className="font-semibold">{participant.display_name}</p>
                              <p className="text-zinc-600">{participant.email}</p>
                              {Object.keys(participant.response_data ?? {}).length ? (
                                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                                  {Object.entries(participant.response_data).map(
                                    ([key, value]) => (
                                      <p key={key}>
                                        <span className="font-semibold">{key}:</span>{" "}
                                        {String(value)}
                                      </p>
                                    ),
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No participants with RSVP details yet.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No events in this bucket.</p>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-black">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight">
              MoneyStage
            </span>
          </div>
          <button
            onClick={() => void signOut()}
            className="border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Dashboard</p>
        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Welcome, {displayName}
        </h1>
        <p className="mt-5 max-w-2xl text-sm font-medium uppercase tracking-wide text-zinc-500">
          Your post sign-in workspace for hosting, discovering, and managing RSVPs.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-3 border-4 border-black bg-black px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-white hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <CalendarCheck className="h-4 w-4" />
            Explore Events
          </Link>
          <Link
            href="/create"
            className="flex items-center justify-center gap-3 border-4 border-black px-6 py-5 text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-100"
          >
            <PlusSquare className="h-4 w-4" />
            Create Event
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 xl:grid-cols-2">
          <section className="space-y-5 border-4 border-black bg-white p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black uppercase tracking-tight">
              Events Created By You
            </h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : (
              <div className="space-y-6">
                {renderEventList("Current", createdBuckets.current, true)}
                {renderEventList("Previous", createdBuckets.past, true)}
                {renderEventList("Upcoming", createdBuckets.future, true)}
              </div>
            )}
          </section>

          <section className="space-y-5 border-4 border-black bg-white p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black uppercase tracking-tight">
              Events You Are Attending
            </h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : (
              <div className="space-y-6">
                {renderEventList(
                  "Past",
                  attendingEvents
                    .map((item) => item.event)
                    .filter((event) =>
                      attendingBuckets.past.some((bucket) => bucket.id === event.id),
                    ),
                  false,
                )}
                {renderEventList(
                  "Present",
                  attendingEvents
                    .map((item) => item.event)
                    .filter((event) =>
                      attendingBuckets.current.some((bucket) => bucket.id === event.id),
                    ),
                  false,
                )}
                {renderEventList(
                  "Future",
                  attendingEvents
                    .map((item) => item.event)
                    .filter((event) =>
                      attendingBuckets.future.some((bucket) => bucket.id === event.id),
                    ),
                  false,
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
