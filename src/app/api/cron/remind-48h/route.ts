import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type ReminderRow = {
  rsvp_id: string;
  attendee_email: string;
  attendee_display_name: string;
  event_slug: string;
  event_title: string;
  start_datetime: string;
  end_datetime: string;
  timezone: string;
  event_type: "physical" | "digital";
  venue_name: string | null;
  venue_address: string | null;
  meeting_platform: string | null;
  meeting_link: string | null;
  location_city: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json(
        { error: "cron_secret_not_configured" },
        { status: 503 },
      );
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "MoneyStage <onboarding@resend.dev>";

  if (!apiKey) {
    return NextResponse.json({ skipped: true, reason: "no_resend_key" });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "missing_service_role" },
      { status: 500 },
    );
  }

  const { data: rows, error } = await admin.rpc("get_48h_reminder_targets");
  if (error) {
    return NextResponse.json(
      { error: "rpc_failed", detail: error.message },
      { status: 500 },
    );
  }

  const targets = (rows ?? []) as ReminderRow[];
  const resend = new Resend(apiKey);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let sent = 0;

  for (const row of targets) {
    const eventUrl = `${site.replace(/\/$/, "")}/events/${row.event_slug}`;
    const joining: string[] = [];
    if (row.event_type === "physical") {
      if (row.venue_name) joining.push(`Venue: ${row.venue_name}`);
      if (row.venue_address) joining.push(`Address: ${row.venue_address}`);
      if (row.location_city) joining.push(`City: ${row.location_city}`);
    } else {
      if (row.meeting_platform) joining.push(`Platform: ${row.meeting_platform}`);
      if (row.meeting_link) joining.push(`Join link: ${row.meeting_link}`);
    }

    const text = [
      `Hi${row.attendee_display_name ? ` ${row.attendee_display_name}` : ""},`,
      ``,
      `Reminder: "${row.event_title}" starts in about 48 hours.`,
      ``,
      `When: ${row.start_datetime} (${row.timezone})`,
      ``,
      ...joining.map((l) => l),
      ``,
      `Event page: ${eventUrl}`,
      ``,
      `MoneyStage`,
    ].join("\n");

    const { error: sendError } = await resend.emails.send({
      from,
      to: row.attendee_email,
      subject: `Reminder: ${row.event_title}`,
      text,
    });

    if (!sendError) {
      await admin.rpc("mark_rsvp_reminder_sent", { p_rsvp_id: row.rsvp_id });
      sent += 1;
    }
  }

  // Also mark 2h reminders (same route keeps scheduler simple when email provider is optional).
  const { data: rows2h } = await admin.rpc("get_2h_reminder_targets");
  const targets2h = (rows2h ?? []) as ReminderRow[];
  for (const row of targets2h) {
    const eventUrl = `${site.replace(/\/$/, "")}/events/${row.event_slug}`;
    const joining: string[] = [];
    if (row.event_type === "physical") {
      if (row.venue_name) joining.push(`Venue: ${row.venue_name}`);
      if (row.venue_address) joining.push(`Address: ${row.venue_address}`);
      if (row.location_city) joining.push(`City: ${row.location_city}`);
    } else {
      if (row.meeting_platform) joining.push(`Platform: ${row.meeting_platform}`);
      if (row.meeting_link) joining.push(`Join link: ${row.meeting_link}`);
    }
    const text = [
      `Hi${row.attendee_display_name ? ` ${row.attendee_display_name}` : ""},`,
      ``,
      `Final reminder: "${row.event_title}" starts in about 2 hours.`,
      ``,
      `When: ${row.start_datetime} (${row.timezone})`,
      ``,
      ...joining,
      ``,
      `Event page: ${eventUrl}`,
      ``,
      `MoneyStage`,
    ].join("\n");
    const { error: sendError } = await resend.emails.send({
      from,
      to: row.attendee_email,
      subject: `Final reminder: ${row.event_title}`,
      text,
    });
    if (!sendError) {
      await admin.rpc("mark_rsvp_reminder_2h_sent", { p_rsvp_id: row.rsvp_id });
      sent += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    count48h: targets.length,
    count2h: targets2h.length,
    sent,
  });
}
