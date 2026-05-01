import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import type { EventBundle } from "@/lib/events/types";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "MoneyStage <onboarding@resend.dev>";

  let slug: string;
  try {
    const body = (await request.json()) as { slug?: string };
    slug = typeof body.slug === "string" ? body.slug.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "slug_required" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ skipped: true, reason: "no_resend_key" });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "supabase_config" }, { status: 500 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: raw, error: rpcError } = await supabase.rpc("get_event_by_slug", {
    p_slug: slug,
  });
  if (rpcError || raw == null) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  const bundle = raw as EventBundle;
  const rsvpStatus = bundle.rsvp?.status ?? null;
  if (!rsvpStatus || (rsvpStatus !== "confirmed" && rsvpStatus !== "pending")) {
    return NextResponse.json({ error: "no_rsvp" }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const eventUrl = `${site.replace(/\/$/, "")}/events/${bundle.slug}`;

  const joiningLines: string[] = [];
  if (rsvpStatus === "confirmed") {
    if (bundle.event_type === "physical") {
      if (bundle.venue_name) joiningLines.push(`Venue: ${bundle.venue_name}`);
      if (bundle.venue_address) joiningLines.push(`Address: ${bundle.venue_address}`);
      if (bundle.city) joiningLines.push(`City: ${bundle.city}`);
    } else {
      if (bundle.meeting_platform) {
        joiningLines.push(`Platform: ${bundle.meeting_platform}`);
      }
      if (bundle.meeting_link) {
        joiningLines.push(`Join link: ${bundle.meeting_link}`);
      }
    }
  }

  const subject =
    rsvpStatus === "confirmed"
      ? `You are confirmed: ${bundle.title}`
      : `RSVP received — ${bundle.title}`;

  const textBody =
    rsvpStatus === "confirmed"
      ? [
          `Hi,`,
          ``,
          `Your RSVP for "${bundle.title}" is confirmed.`,
          ``,
          `When: ${bundle.start_datetime} (${bundle.timezone})`,
          ``,
          joiningLines.length ? joiningLines.join("\n") + "\n\n" : "",
          `Event page: ${eventUrl}`,
          ``,
          `See you there,`,
          `MoneyStage`,
        ].join("\n")
      : [
          `Hi,`,
          ``,
          `We received your RSVP for "${bundle.title}".`,
          `The host will review your request. You will get another email when you are confirmed.`,
          ``,
          `When: ${bundle.start_datetime} (${bundle.timezone})`,
          ``,
          `Event page: ${eventUrl}`,
          ``,
          `MoneyStage`,
        ].join("\n");

  const htmlJoining =
    rsvpStatus === "confirmed" && joiningLines.length
      ? `<ul>${joiningLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      : rsvpStatus === "pending"
        ? `<p>Location and joining details will be emailed once the host confirms your RSVP.</p>`
        : "";

  const html = `
    <p>Hi,</p>
    ${
      rsvpStatus === "confirmed"
        ? `<p>Your RSVP for <strong>${escapeHtml(bundle.title)}</strong> is <strong>confirmed</strong>.</p>`
        : `<p>We received your RSVP for <strong>${escapeHtml(bundle.title)}</strong>. The host will review your request.</p>`
    }
    <p><strong>When:</strong> ${escapeHtml(bundle.start_datetime)} (${escapeHtml(bundle.timezone)})</p>
    ${htmlJoining}
    <p><a href="${eventUrl}">Open event page</a></p>
    <p>— MoneyStage</p>
  `;

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: user.email,
    subject,
    html,
    text: textBody,
  });

  if (sendError) {
    return NextResponse.json(
      { error: "send_failed", detail: sendError.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
