import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventBundle } from "@/lib/events/types";
import { EventDetail } from "./event-detail";

/** Next may cache static shells; fetching this page must always reflect current events. */
export const dynamic = "force-dynamic";

function parseInvite(raw: string | string[] | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return t;
  }
  return undefined;
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug: rawSlug } = await params;
  const sp = await searchParams;
  const invite = parseInvite(sp.invite);

  let slug = typeof rawSlug === "string" ? rawSlug.trim() : "";
  if (slug) {
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* keep trimmed raw */
    }
    slug = slug.trim().toLowerCase();
  }

  if (!slug) {
    notFound();
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    notFound();
  }

  // Omit optional UUID entirely when absent. Some PostgREST/Supabase setups
  // mishandle explicit null for defaulted uuid params differently than the confirmed page.
  const rpcArgs =
    invite != null && invite !== ""
      ? { p_slug: slug, p_invite_token: invite }
      : { p_slug: slug };

  const { data, error } = await supabase.rpc(
    "get_event_by_slug",
    rpcArgs,
  );

  if (error || data == null) {
    notFound();
  }

  const bundleSlug = (data as EventBundle).slug;
  const bundleId = (data as EventBundle).id;

  if (!bundleSlug || !bundleId) {
    notFound();
  }

  return (
    <EventDetail
      initial={data as EventBundle}
      slug={bundleSlug}
      inviteParam={invite}
    />
  );
}
