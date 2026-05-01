"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PublishedEventRow } from "@/lib/events/types";
import { EventCard } from "@/components/event-card";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ExploreEventsSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [liveEvents, setLiveEvents] = useState<PublishedEventRow[]>([]);
  const [exploreLoading, setExploreLoading] = useState(true);
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLiveEvents([]);
      setExploreError("Connect Supabase to load live events.");
      setExploreLoading(false);
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
  }, [debouncedSearch, debouncedCity]);

  const filteredLabel = useMemo(
    () =>
      debouncedCity || debouncedSearch
        ? "No events match these filters"
        : "No published events yet",
    [debouncedCity, debouncedSearch],
  );

  return (
    <section className="mx-auto max-w-screen-2xl px-6 py-16">
      <div className="mb-16 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <h1 className="text-6xl font-black uppercase tracking-tighter md:text-8xl">
          Discover
        </h1>
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
              onOpen={(s) => router.push(`/events/${encodeURIComponent(s)}`)}
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
  );
}
