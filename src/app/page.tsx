"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowUpRight,
  CheckCircle,
  ChevronLeft,
  Clock,
  Info,
  Lock,
  MapPin,
  Search,
  TrendingUp,
  User,
  Video,
} from "lucide-react";

type EventItem = {
  id: number;
  title: string;
  host: string;
  hostAvatar: string;
  date: string;
  time: string;
  location: string;
  type: "Zoom" | "In Person";
  topic: string;
  price: string;
  image: string;
  description: string;
};

const INITIAL_EVENTS: EventItem[] = [
  {
    id: 1,
    title: "Mastering Index Funds",
    host: "Sarah Chen",
    hostAvatar: "SC",
    date: "May 15, 2026",
    time: "6:30 PM",
    location: "Virtual",
    type: "Zoom",
    topic: "Personal Finance",
    price: "Free",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=800",
    description:
      "An intensive session on building long-term wealth using low-cost index funds. We cover asset allocation, rebalancing, and tax-loss harvesting strategies for modern investors.",
  },
  {
    id: 2,
    title: "Insurance 101 for Gen Z",
    host: "David Miller",
    hostAvatar: "DM",
    date: "May 18, 2026",
    time: "5:00 PM",
    location: "New York, NY",
    type: "In Person",
    topic: "Insurance",
    price: "$25.00",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800",
    description:
      "Most young professionals are under-insured or over-paying. This session breaks down life, health, and disability insurance into practical steps without jargon.",
  },
  {
    id: 3,
    title: "Crypto Regulation Update",
    host: "Dr. Elena Rossi",
    hostAvatar: "ER",
    date: "May 22, 2026",
    time: "12:00 PM",
    location: "London, UK",
    type: "In Person",
    topic: "Investing",
    price: "Free",
    image:
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&q=80&w=800",
    description:
      "Regulatory landscapes are shifting quickly. Join for a practical deep dive on how changes in the EU and US can affect retail and institutional holdings.",
  },
  {
    id: 4,
    title: "Estate Planning Essentials",
    host: "Marcus Thorne",
    hostAvatar: "MT",
    date: "June 02, 2026",
    time: "10:00 AM",
    location: "Austin, TX",
    type: "In Person",
    topic: "Wealth Management",
    price: "$50.00",
    image:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
    description:
      "Generational wealth is often lost due to poor planning. Learn legal and financial structures frequently used to preserve assets across generations.",
  },
];

const TOPICS = [
  "All",
  "Personal Finance",
  "Insurance",
  "Investing",
  "Wealth Management",
];
const LOCATIONS = ["All", "Virtual", "New York, NY", "London, UK", "Austin, TX"];

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
  onClick,
}: {
  event: EventItem;
  onClick: (event: EventItem) => void;
}) {
  return (
    <button
      onClick={() => onClick(event)}
      className="group flex h-full flex-col overflow-hidden border-2 border-black bg-white text-left transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[14px_14px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="relative h-52 overflow-hidden border-b-2 border-black bg-zinc-100">
        <img
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105"
        />
        <div className="absolute bottom-3 left-3 bg-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white">
          {event.topic}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border border-black bg-zinc-100 text-[10px] font-black">
              {event.hostAvatar}
            </div>
            <p className="text-xs font-bold uppercase tracking-tight">{event.host}</p>
          </div>
          <div className="flex items-center bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase">
            {event.type === "Zoom" ? (
              <Video className="mr-1 h-3.5 w-3.5" />
            ) : (
              <MapPin className="mr-1 h-3.5 w-3.5" />
            )}
            {event.type}
          </div>
        </div>
        <h3 className="mb-4 text-2xl font-black uppercase leading-tight tracking-tight">
          {event.title}
        </h3>
        <div className="mt-auto flex items-center justify-between border-t-2 border-black pt-4">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
            {event.date}
          </span>
          <ArrowUpRight className="h-5 w-5 text-zinc-400 group-hover:text-black" />
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"home" | "explore" | "detail">("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rsvps, setRsvps] = useState<Record<number, boolean>>({});
  const [topicFilter, setTopicFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    return INITIAL_EVENTS.filter((event) => {
      const matchTopic = topicFilter === "All" || event.topic === topicFilter;
      const matchLocation =
        locationFilter === "All" || event.location === locationFilter;
      const text = searchQuery.toLowerCase();
      const matchSearch =
        event.title.toLowerCase().includes(text) ||
        event.host.toLowerCase().includes(text);
      return matchTopic && matchLocation && matchSearch;
    });
  }, [locationFilter, searchQuery, topicFilter]);

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });
  }, []);

  function handleEventClick(event: EventItem) {
    setSelectedEvent(event);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogin() {
    setShowAuthModal(false);
    router.push("/login?next=/welcome");
  }

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setView("home");
  }

  function handleRsvp(eventId: number) {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    setRsvps((current) => ({ ...current, [eventId]: !current[eventId] }));
  }

  return (
    <div className="min-h-screen bg-white text-black antialiased">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-6">
          <button
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
              onClick={() => setView("explore")}
              className={`text-[11px] font-black uppercase tracking-[0.25em] ${
                view === "explore"
                  ? "text-black underline decoration-4 underline-offset-8"
                  : "text-zinc-400 hover:text-black"
              }`}
            >
              Explore
            </button>
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <button className="flex h-9 w-9 items-center justify-center bg-black">
                  <User className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => void handleSignOut()}
                  className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-black"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="border-2 border-black px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
              >
                Sign In
              </button>
            )}
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
                  onClick={() => setView("explore")}
                  className="w-full bg-black px-12 py-5 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:w-auto"
                >
                  Explore Events
                </button>
                <button
                  onClick={() => router.push("/welcome")}
                  className="w-full border-4 border-black px-12 py-5 text-sm font-black uppercase tracking-[0.25em] transition hover:bg-zinc-100 sm:w-auto"
                >
                  Go to Dashboard
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
                    placeholder="Search sessions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-2 border-black bg-zinc-50 py-4 pl-12 pr-4 text-xs font-black uppercase tracking-wider placeholder:text-zinc-400 focus:outline-none"
                  />
                </label>
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="min-w-[180px] border-2 border-black bg-white px-4 py-4 text-xs font-black uppercase tracking-wider focus:outline-none"
                >
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic === "All" ? "All Topics" : topic}
                    </option>
                  ))}
                </select>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="min-w-[180px] border-2 border-black bg-white px-4 py-4 text-xs font-black uppercase tracking-wider focus:outline-none"
                >
                  {LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location === "All" ? "All Locations" : location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredEvents.length ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            ) : (
              <div className="border-4 border-dashed border-zinc-300 py-24 text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
                  No events match these filters
                </p>
              </div>
            )}
          </section>
        )}

        {view === "detail" && selectedEvent && (
          <section className="mx-auto max-w-screen-2xl px-6 py-16">
            <button
              onClick={() => setView("explore")}
              className="mb-10 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] transition hover:-translate-x-1"
            >
              <ChevronLeft className="h-4 w-4" /> Back to discover
            </button>

            <div className="grid grid-cols-1 gap-14 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <img
                  src={selectedEvent.image}
                  alt={selectedEvent.title}
                  className="mb-10 h-[420px] w-full border-4 border-black object-cover grayscale"
                />

                <div className="mb-6 flex gap-3">
                  <span className="bg-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    {selectedEvent.topic}
                  </span>
                  <span className="border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
                    {selectedEvent.type}
                  </span>
                </div>
                <h3 className="mb-8 text-5xl font-black uppercase leading-tight tracking-tight md:text-7xl">
                  {selectedEvent.title}
                </h3>
                <p className="max-w-4xl text-lg font-medium leading-relaxed text-zinc-700 md:text-2xl">
                  {selectedEvent.description}
                </p>
              </div>

              <aside className="xl:col-span-4">
                <div className="sticky top-28 border-4 border-black bg-white p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
                  <div className="space-y-8">
                    <div className="flex items-start gap-4">
                      <Clock className="mt-1 h-5 w-5 text-zinc-300" />
                      <div>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                          Time
                        </p>
                        <p className="text-xl font-black uppercase">{selectedEvent.date}</p>
                        <p className="text-lg font-semibold text-zinc-500">{selectedEvent.time}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <MapPin className="mt-1 h-5 w-5 text-zinc-300" />
                      <div>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                          Location
                        </p>
                        <p className="text-xl font-black uppercase">{selectedEvent.location}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-zinc-100 text-[10px] font-black">
                        {selectedEvent.hostAvatar}
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                          Host
                        </p>
                        <p className="text-xl font-black uppercase">{selectedEvent.host}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 space-y-3">
                    <button
                      onClick={() => handleRsvp(selectedEvent.id)}
                      className={`w-full py-4 text-xs font-black uppercase tracking-[0.2em] ${
                        rsvps[selectedEvent.id]
                          ? "border-2 border-zinc-300 bg-zinc-100 text-zinc-500"
                          : "bg-black text-white transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                      }`}
                    >
                      {rsvps[selectedEvent.id] ? (
                        <span className="inline-flex items-center gap-2">
                          You are going <CheckCircle className="h-4 w-4" />
                        </span>
                      ) : (
                        `Confirm RSVP (${selectedEvent.price})`
                      )}
                    </button>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                      <span>Status</span>
                      <span>{rsvps[selectedEvent.id] ? "Active" : "Not registered"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-4 border-2 border-black bg-zinc-50 p-6">
                  <Info className="h-5 w-5" />
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]">
                    Access uses Google authentication via Supabase.
                  </p>
                </div>
              </aside>
            </div>
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
