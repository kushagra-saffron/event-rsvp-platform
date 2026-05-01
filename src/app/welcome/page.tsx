"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronDown, ChevronUp, PlusSquare, TrendingUp } from "lucide-react";

type EventSummary = {
  id: string;
  slug: string;
  title: string;
  event_type: "physical" | "digital";
  start_datetime: string;
  end_datetime: string;
  publication_status?: string;
  access_mode?: string;
  invite_token?: string | null;
};

type AttendingEvent = { event: EventSummary; status: string };
type Participant = {
  user_id: string;
  display_name: string;
  email: string;
  status: "pending" | "confirmed" | "cancelled" | "rejected";
  response_data: Record<string, string>;
};

function bucketByDate<T extends { start_datetime: string; end_datetime: string }>(items: T[]) {
  const now = new Date();
  return {
    past: items.filter((item) => new Date(item.end_datetime) < now),
    current: items.filter(
      (item) => new Date(item.start_datetime) <= now && new Date(item.end_datetime) >= now,
    ),
    future: items.filter((item) => new Date(item.start_datetime) > now),
  };
}

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Member");
  const [createdEvents, setCreatedEvents] = useState<EventSummary[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<AttendingEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [participantsByEvent, setParticipantsByEvent] = useState<Record<string, Participant[]>>({});
  const [searchByEvent, setSearchByEvent] = useState<Record<string, string>>({});
  const [statusFilterByEvent, setStatusFilterByEvent] = useState<Record<string, string>>({});

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  async function loadDashboard() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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
          "id,slug,title,event_type,start_datetime,end_datetime,publication_status,access_mode,invite_token",
        )
        .eq("creator_id", user.id)
        .order("start_datetime", { ascending: true }),
      supabase
        .from("rsvps")
        .select(
          "status, events!inner(id,slug,title,event_type,start_datetime,end_datetime,publication_status,access_mode)",
        )
        .eq("user_id", user.id)
        .in("status", ["confirmed", "pending"])
        .order("timestamp", { ascending: false }),
    ]);
    setDisplayName(profile?.display_name || user.user_metadata?.full_name || "Member");
    setCreatedEvents((createdResult.data ?? []) as EventSummary[]);
    setAttendingEvents(
      (attendingResult.data ?? [])
        .map((row: { status: string; events: EventSummary[] | EventSummary }) => ({
          status: row.status,
          event: Array.isArray(row.events) ? row.events[0] : row.events,
        }))
        .filter((item) => Boolean(item.event?.id)),
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function toggleParticipants(eventId: string) {
    const next = expandedEventId === eventId ? null : eventId;
    setExpandedEventId(next);
    if (!next) return;
    await refreshParticipants(next);
  }

  async function refreshParticipants(eventId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase.rpc("get_event_participants", { target_event_id: eventId });
    setParticipantsByEvent((prev) => ({ ...prev, [eventId]: (data as Participant[]) ?? [] }));
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/");
  }

  async function setParticipantStatus(eventId: string, userId: string, status: "confirmed" | "rejected") {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.rpc("host_set_rsvp_status", {
      p_event_id: eventId,
      p_user_id: userId,
      p_status: status,
      p_review_note: null,
    });
    await refreshParticipants(eventId);
  }

  async function bulkSetPending(eventId: string, status: "confirmed" | "rejected") {
    const rows = (participantsByEvent[eventId] ?? []).filter((p) => p.status === "pending");
    for (const row of rows) {
      // sequential keeps host actions predictable and avoids throttling issues
      // eslint-disable-next-line no-await-in-loop
      await setParticipantStatus(eventId, row.user_id, status);
    }
  }

  async function setEventState(eventId: string, state: "cancelled" | "completed") {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.rpc("host_set_event_state", {
      p_event_id: eventId,
      p_publication_status: state,
    });
    await loadDashboard();
  }

  async function cancelMyRsvp(slug: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.rpc("cancel_own_rsvp", { p_slug: slug });
    await loadDashboard();
  }

  async function copyInviteLink(slug: string, token?: string | null) {
    if (!token) return;
    const origin = window.location.origin;
    await navigator.clipboard.writeText(`${origin}/events/${slug}?invite=${token}`);
  }

  function exportCsv(event: EventSummary) {
    const rows = participantsByEvent[event.id] ?? [];
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.response_data ?? {}))));
    const header = ["name", "email", "status", ...keys];
    const lines = rows.map((r) => {
      const base = [r.display_name, r.email, r.status];
      const dynamic = keys.map((k) => String(r.response_data?.[k] ?? ""));
      return [...base, ...dynamic]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const createdBuckets = bucketByDate(createdEvents);
  const attendingBuckets = bucketByDate(attendingEvents.map((a) => a.event));

  const filteredParticipants = (eventId: string) => {
    const search = (searchByEvent[eventId] ?? "").toLowerCase();
    const status = statusFilterByEvent[eventId] ?? "all";
    return (participantsByEvent[eventId] ?? []).filter((p) => {
      const statusOk = status === "all" || p.status === status;
      const searchOk =
        !search ||
        p.display_name.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search);
      return statusOk && searchOk;
    });
  };

  const stats = useMemo(() => {
    const totalHosted = createdEvents.length;
    const totalUpcoming = createdBuckets.future.length;
    const totalAttending = attendingEvents.length;
    return { totalHosted, totalUpcoming, totalAttending };
  }, [createdEvents.length, createdBuckets.future.length, attendingEvents.length]);

  function renderEventList(title: string, events: EventSummary[], hostView: boolean) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          {title} ({events.length})
        </h3>
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => {
              const expanded = expandedEventId === event.id;
              const participants = filteredParticipants(event.id);
              return (
                <article key={event.id} className="border-2 border-black bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-black uppercase tracking-tight">{event.title}</p>
                      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                        {new Date(event.start_datetime).toLocaleString()} -{" "}
                        {new Date(event.end_datetime).toLocaleString()}
                      </p>
                      <Link
                        href={`/events/${event.slug}`}
                        className="mt-2 inline-block text-xs font-black uppercase tracking-[0.15em] underline"
                      >
                        View public page
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hostView ? (
                        <>
                          <button
                            onClick={() => void toggleParticipants(event.id)}
                            className="inline-flex items-center gap-2 border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em] hover:bg-zinc-100"
                          >
                            Participants
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {event.access_mode === "invite_only" ? (
                            <button
                              onClick={() => void copyInviteLink(event.slug, event.invite_token)}
                              className="border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em]"
                            >
                              Copy invite link
                            </button>
                          ) : null}
                          <button
                            onClick={() => void setEventState(event.id, "completed")}
                            className="border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em]"
                          >
                            Mark completed
                          </button>
                          <button
                            onClick={() => void setEventState(event.id, "cancelled")}
                            className="border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em]"
                          >
                            Cancel event
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void cancelMyRsvp(event.slug)}
                          className="border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em]"
                        >
                          Cancel RSVP
                        </button>
                      )}
                    </div>
                  </div>
                  {hostView && expanded ? (
                    <div className="mt-4 border-t border-zinc-200 pt-4">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <input
                          placeholder="Search attendee name/email"
                          value={searchByEvent[event.id] ?? ""}
                          onChange={(e) =>
                            setSearchByEvent((prev) => ({ ...prev, [event.id]: e.target.value }))
                          }
                          className="border-2 border-black px-3 py-2 text-xs"
                        />
                        <select
                          value={statusFilterByEvent[event.id] ?? "all"}
                          onChange={(e) =>
                            setStatusFilterByEvent((prev) => ({ ...prev, [event.id]: e.target.value }))
                          }
                          className="border-2 border-black px-3 py-2 text-xs"
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="rejected">Rejected</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button
                          onClick={() => void bulkSetPending(event.id, "confirmed")}
                          className="border-2 border-black px-3 py-2 text-xs font-black uppercase"
                        >
                          Approve all pending
                        </button>
                        <button
                          onClick={() => void bulkSetPending(event.id, "rejected")}
                          className="border-2 border-black px-3 py-2 text-xs font-black uppercase"
                        >
                          Reject all pending
                        </button>
                        <button
                          onClick={() => exportCsv(event)}
                          className="border-2 border-black px-3 py-2 text-xs font-black uppercase"
                        >
                          Export CSV
                        </button>
                      </div>
                      {participants.length ? (
                        <div className="space-y-2">
                          {participants.map((p) => (
                            <div key={p.user_id} className="rounded border border-zinc-300 p-3 text-sm">
                              <p className="font-semibold">{p.display_name}</p>
                              <p className="text-zinc-600">{p.email}</p>
                              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                                Status: {p.status}
                              </p>
                              {Object.entries(p.response_data ?? {}).length ? (
                                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                                  {Object.entries(p.response_data).map(([k, v]) => (
                                    <p key={k}>
                                      <span className="font-semibold">{k}:</span> {String(v)}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => void setParticipantStatus(event.id, p.user_id, "confirmed")}
                                  className="border border-black px-2 py-1 text-xs font-black uppercase"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => void setParticipantStatus(event.id, p.user_id, "rejected")}
                                  className="border border-black px-2 py-1 text-xs font-black uppercase"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No participants in this view.</p>
                      )}
                    </div>
                  ) : null}
                </article>
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
            <span className="text-2xl font-black uppercase tracking-tight">MoneyStage</span>
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
        <div className="mt-4 flex flex-wrap gap-6 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          <span>Hosted: {stats.totalHosted}</span>
          <span>Upcoming hosted: {stats.totalUpcoming}</span>
          <span>Attending: {stats.totalAttending}</span>
        </div>

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
            <h2 className="text-xl font-black uppercase tracking-tight">Events Created By You</h2>
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
            <h2 className="text-xl font-black uppercase tracking-tight">Events You Are Attending</h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : (
              <div className="space-y-6">
                {renderEventList(
                  "Past",
                  attendingEvents.map((a) => a.event).filter((e) => attendingBuckets.past.some((b) => b.id === e.id)),
                  false,
                )}
                {renderEventList(
                  "Present",
                  attendingEvents
                    .map((a) => a.event)
                    .filter((e) => attendingBuckets.current.some((b) => b.id === e.id)),
                  false,
                )}
                {renderEventList(
                  "Future",
                  attendingEvents.map((a) => a.event).filter((e) => attendingBuckets.future.some((b) => b.id === e.id)),
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
