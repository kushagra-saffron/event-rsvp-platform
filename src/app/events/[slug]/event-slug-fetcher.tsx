"use client";

import { useParams, useSearchParams, notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventBundle } from "@/lib/events/types";
import { coerceRpcJsonb } from "@/lib/supabase/coerce-rpc-jsonb";
import { EventDetail } from "./event-detail";

function normalizeSlugParam(raw: unknown): string {
  const segment =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0]
        : "";
  if (!segment.trim()) return "";
  let slug = segment.trim();
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep segment */
  }
  return slug.trim().toLowerCase();
}

function uuidInviteFromSearch(inviteRaw: string | null): string | undefined {
  if (!inviteRaw?.trim()) return undefined;
  const t = inviteRaw.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return t;
  }
  return undefined;
}

export function EventSlugFetcher() {
  const rawSlug = useParams()?.slug;
  const searchParams = useSearchParams();

  const slug = useMemo(() => normalizeSlugParam(rawSlug), [rawSlug]);
  const inviteFromQuery = uuidInviteFromSearch(searchParams?.get("invite") ?? null);
  const inviteSearch = searchParams?.get("invite");
  /** Pass raw (?invite=) into EventDetail when non-empty. */
  const inviteRaw =
    inviteSearch != null && inviteSearch.trim() !== ""
      ? inviteSearch.trim()
      : undefined;

  const [bundle, setBundle] = useState<EventBundle | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) {
        setBundle(null);
        return;
      }

      setBundle(undefined);

      let supabase;
      try {
        supabase = createClient();
      } catch {
        if (!cancelled) setBundle(null);
        return;
      }

      const rpcArgs =
        inviteFromQuery != null && inviteFromQuery !== ""
          ? { p_slug: slug, p_invite_token: inviteFromQuery }
          : { p_slug: slug };

      const { data, error } = await supabase.rpc("get_event_by_slug", rpcArgs);

      if (cancelled) return;

      if (error || data === null || data === undefined) {
        setBundle(null);
        return;
      }

      const normalized = coerceRpcJsonb<EventBundle>(data);
      if (
        normalized == null ||
        typeof normalized.id !== "string" ||
        typeof normalized.slug !== "string"
      ) {
        setBundle(null);
        return;
      }

      setBundle(normalized);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug, inviteFromQuery]);

  if (!slug) {
    notFound();
  }

  if (bundle === undefined) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-white px-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          Loading event…
        </p>
      </div>
    );
  }

  if (bundle === null) {
    notFound();
  }

  return (
    <EventDetail
      initial={bundle}
      slug={bundle.slug}
      inviteParam={inviteRaw}
    />
  );
}
