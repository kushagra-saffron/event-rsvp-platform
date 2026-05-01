import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventBundle } from "@/lib/events/types";
import { EventDetail } from "./event-detail";

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
  const { slug } = await params;
  const sp = await searchParams;
  const invite = parseInvite(sp.invite);

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    notFound();
  }

  const { data, error } = await supabase.rpc("get_event_by_slug", {
    p_slug: slug,
    p_invite_token: invite ?? null,
  });

  if (error || data == null) {
    notFound();
  }

  return (
    <EventDetail initial={data as EventBundle} slug={slug} inviteParam={invite} />
  );
}
