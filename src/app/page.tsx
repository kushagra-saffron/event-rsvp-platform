"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PublishedEventRow } from "@/lib/events/types";
import {
  ArrowUpRight,
  Lock,
  MapPin,
  Search,
  TrendingUp,
  Video,
} from "lucide-react";

function AuthModal({
  isOpen,
  onClose,
  onLogin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md border-4 border-black bg-white p-10 text-center shadow-[18px_18px_0px_0px_rgba(0,0,0,1)]">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center bg-black">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h3 className="mb-3 text-2xl font-black uppercase tracking-tight">
          Verified Access
        </h3>
        <p className="mb-8 text-sm text-zinc-600">
          Please sign in with Google to RSVP or create events.
        </p>
        <button
          onClick={onLogin}
          className="w-full border-4 border-black px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function EventCard({
  event,
  onOpen,
}: {
  event: PublishedEventRow;
  onOpen: (slug: string) => void;
}) {
  const start = new Date(event.start_datetime);
  const access =
    event.access_mode === "open"
      ? "Open"
      : event.access_mode === "approval_required"
        ? "Approval"
        : "Invite";

  return (
    <button
      type="button"
      onClick={() => onOpen(event.slug)}
      className="group flex h-full flex-col overflow-hidden border-2 border-black bg-white text-left transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[14px_14px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="relative flex h-40 flex-col justify-end overflow-hidden border-b-2 border-black bg-zinc-100 p-4">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {access}
        </span>
        <span className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight">
          {event.title}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-tight">
              {event.creator_display_name ?? "Host"}
            </p>
          </div>
          <div className="flex items-center bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase">
            {event.event_type === "digital" ? (
              <Video className="mr-1 h-3.5 w-3.5" />
            ) : (
              <MapPin className="mr-1 h-3.5 w-3.5" />
            )}
            {event.event_type === "digital" ? "Online" : "In person"}
          </div>
        </div>
        <p className="line-clamp-3 text-sm text-zinc-600">{event.short_description}</p>
        <div className="mt-auto flex items-center justify-between border-t-2 border-black pt-4">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
            {start.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <ArrowUpRight className="h-5 w-5 text-zinc-400 group-hover:text-black" />
        </div>
        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
          {event.event_type === "physical"
            ? event.location_city ?? "City TBA"
            : "Online"}
          {event.max_capacity != null
            ? ` · ${event.confirmed_count}/${event.max_capacity}`
            : ` · ${event.confirmed_count} going`}
        </p>
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"home" | "explore">("home");
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      typeof window !== "undefined" &&
      document.cookie.includes("moneystage_demo_auth=1"),
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [liveEvents, setLiveEvents] = useState<PublishedEventRow[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const debouncedCity = useDebouncedValue(cityQuery, 350);

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (document.cookie.includes("moneystage_demo_auth=1")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });
  }, []);

  useEffect(() => {
    if (view !== "explore") return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLiveEvents([]);
      setExploreError("Connect Supabase to load live events.");
      return;
    }
    let cancelled = false;
    void (async () => {
      setExploreLoading(true);
      setExploreError(null);
      const { data, error } = await supabase.rpc("list_published_events", {
        p_limit: 50,
        p_offset: 0,
        p_city: debouncedCity.trim() || null,
        p_search: debouncedSearch.trim() || null,
      });
      if (cancelled) return;
      if (error) {
        setExploreError(error.message);
        setLiveEvents([]);
      } else {
        setLiveEvents((data as PublishedEventRow[]) ?? []);
      }
      setExploreLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, debouncedSearch, debouncedCity]);

  function handleLogin() {
    setShowAuthModal(false);
    router.push("/login?next=/welcome");
  }

  function handleCreateEventClick() {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    router.push("/create");
  }

  async function handleSignOut() {
    document.cookie =
      "moneystage_demo_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsLoggedIn(false);
    setView("home");
  }

  const filteredLabel = useMemo(
    () => (debouncedCity || debouncedSearch ? "No events match these filters" : "No published events yet"),
    [debouncedCity, debouncedSearch],
  );

  return (
    <div className="min-h-screen bg-white text-black antialiased">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-6">
          <button
            type="button"
            className="group flex items-center space-x-3"
            onClick={() => setView("home")}
          >
            <div className="flex h-10 w-10 items-center justify-center bg-black transition group-hover:rotate-12">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight">
              MoneyStage
            </span>
          </button>

          <div className="flex items-center space-x-8">
            <button
              type="button"
              onClick={() => setView("explore")}
              className={`text-[11px] font-black uppercase tracking-[0.25em] ${
                view === "explore"
                  ? "text-black underline decoration-4 underline-offset-8"
                  : "text-zinc-400 hover:text-black"
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => router.push("/welcome")}
              className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 hover:text-black"
            >
              Dashboard
            </button>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {view === "home" && (
          <section className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="max-w-5xl">
              <div className="mb-10 inline-flex items-center border-2 border-black px-5 py-2">
                <span className="text-[11px] font-black uppercase tracking-[0.3em]">
                  MoneyStage Event Series
                </span>
              </div>
              <h1 className="mb-8 text-6xl font-black uppercase leading-[0.9] tracking-tighter md:text-8xl">
                Manage
                <br />
                Your Money
              </h1>
              <p className="mx-auto mb-12 max-w-2xl text-lg font-bold uppercase tracking-tight text-zinc-500 md:text-2xl">
                High-calibre events for modern investors, with physical and digital
                sessions in one clean RSVP flow.
              </p>

              <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setView("explore")}
                  className="w-full bg-black px-12 py-5 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:w-auto"
                >
                  Explore Events
                </button>
                <button
                  type="button"
                  onClick={handleCreateEventClick}
                  className="w-full border-4 border-black px-12 py-5 text-sm font-black uppercase tracking-[0.25em] transition hover:bg-zinc-100 sm:w-auto"
                >
                  Create Event
                </button>
              </div>
            </div>
          </section>
        )}

        {view === "explore" && (
          <section className="mx-auto max-w-screen-2xl px-6 py-16">
            <div className="mb-16 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <h2 className="text-6xl font-black uppercase tracking-tighter md:text-8xl">
                Discover
              </h2>
              <div className="flex w-full flex-col gap-4 md:flex-row lg:w-auto">
                <label className="relative min-w-[280px] flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search title or teaser…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-2 border-black bg-zinc-50 py-4 pl-12 pr-4 text-xs font-black uppercase tracking-wider placeholder:text-zinc-400 focus:outline-none"
                  />
                </label>
                <input
                  type="text"
                  placeholder="City contains…"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  className="min-w-[200px] border-2 border-black bg-white px-4 py-4 text-xs font-black uppercase tracking-wider focus:outline-none"
                />
              </div>
            </div>

            {exploreLoading ? (
              <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
                Loading events…
              </p>
            ) : exploreError ? (
              <p className="text-sm text-red-700">{exploreError}</p>
            ) : liveEvents.length ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                {liveEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onOpen={(slug) => router.push(`/events/${slug}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="border-4 border-dashed border-zinc-300 py-24 text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
                  {filteredLabel}
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
      />

      <footer className="mt-12 border-t-2 border-black bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-start justify-between gap-4 px-6 py-8 text-xs font-black uppercase tracking-[0.15em] text-zinc-500 sm:flex-row sm:items-center">
          <span className="text-zinc-800">MoneyStage</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-black">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-black">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
