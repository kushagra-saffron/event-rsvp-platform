"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Link as LinkIcon,
  Lock,
  MapPin,
  User,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  EventBundle,
  EventResource,
  EventViewerState,
  RsvpFormField,
} from "@/lib/events/types";

function accessLabel(mode: string): string {
  if (mode === "open") return "Open RSVP";
  if (mode === "approval_required") return "Approval required";
  return "Invite only";
}

function parseInviteParam(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return t;
  }
  return null;
}

export function EventDetail({
  initial,
  slug,
  inviteParam,
}: {
  initial: EventBundle;
  slug: string;
  inviteParam?: string;
}) {
  const router = useRouter();
  const [bundle, setBundle] = useState<EventBundle>(initial);
  const [copyDone, setCopyDone] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resources, setResources] = useState<EventResource[]>([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceType, setResourceType] =
    useState<EventResource["type"]>("doc_link");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceContent, setResourceContent] = useState("");

  const inviteToken = useMemo(
    () => parseInviteParam(inviteParam),
    [inviteParam],
  );

  const refresh = useCallback(async () => {
    const supabase = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (!supabase) return;
    const { data } = await supabase.rpc("get_event_by_slug", {
      p_slug: slug,
      p_invite_token: inviteToken,
    });
    if (data) setBundle(data as EventBundle);
  }, [slug, inviteToken]);

  const viewer: EventViewerState = bundle.viewer;
  const isAnon = viewer === "A";
  const canSeeFullTeaser = !isAnon;
  const showVenueOrLink = viewer === "D" || viewer === "E";
  const inviteOnlyBlocked =
    bundle.access_mode === "invite_only" && !inviteToken && viewer === "B";
  const showRsvpForm =
    viewer === "B" && !bundle.is_host && !inviteOnlyBlocked;
  const canCancelOwnRsvp = viewer === "C" || viewer === "D";
  const canSeeResources = viewer === "E" || bundle.is_host;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!canSeeResources) return;
    const supabase = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (!supabase) return;
    void supabase
      .rpc("get_event_resources_by_slug", { p_slug: slug })
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setResources(data as EventResource[]);
        }
      });
  }, [canSeeResources, slug]);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setUserId(null);
          return;
        }
        setUserId(user.id);
        setUserEmail(user.email ?? "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const metaName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined);
        setProfileName(
          profile?.display_name?.trim() ||
            metaName?.trim() ||
            user.email?.split("@")[0] ||
            "",
        );
      } catch {
        setUserId(null);
      }
    })();
  }, []);

  const eventUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/events/${slug}`
      : `/events/${slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  }

  async function onSubmitRsvp(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!userId) {
      const next = encodeURIComponent(
        `/events/${slug}${inviteToken ? `?invite=${inviteToken}` : ""}`,
      );
      router.push(`/login?next=${next}`);
      return;
    }
    if (!consent) {
      setSubmitError("Please confirm you agree to attend.");
      return;
    }
    const fields = (bundle.rsvp_form_fields ?? []) as RsvpFormField[];
    for (const f of fields) {
      if (f.required && !String(fieldValues[f.label] ?? "").trim()) {
        setSubmitError(`Please fill in: ${f.label}`);
        return;
      }
    }

    const supabase = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (!supabase) {
      setSubmitError("App is missing Supabase configuration.");
      return;
    }

    setSubmitting(true);
    const responseData: Record<string, unknown> = { ...fieldValues };
    responseData.__consent = true;

    const { data, error } = await supabase.rpc("submit_rsvp", {
      p_slug: slug,
      p_response_data: responseData,
      p_invite_token: inviteToken,
    });

    if (error) {
      setSubmitting(false);
      setSubmitError(error.message);
      return;
    }

    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      setSubmitting(false);
      setSubmitError(
        result?.error === "already_rsvped"
          ? "You already have an active RSVP for this event."
          : result?.error === "capacity_reached"
            ? "This event is at capacity."
            : result?.error === "invite_required"
              ? "A valid invite link is required."
              : (result?.error ?? "Could not submit RSVP."),
      );
      return;
    }

    try {
      await fetch("/api/emails/rsvp-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch {
      // non-blocking
    }

    setSubmitting(false);
    router.push(`/events/${slug}/confirmed`);
  }

  async function onCancelOwnRsvp() {
    const supabase = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (!supabase) return;
    const { data } = await supabase.rpc("cancel_own_rsvp", { p_slug: slug });
    if ((data as { ok?: boolean })?.ok) {
      await refresh();
    }
  }

  async function onUploadResource(e: FormEvent) {
    e.preventDefault();
    if (!bundle.is_host) return;
    const supabase = (() => {
      try {
        return createClient();
      } catch {
        return null;
      }
    })();
    if (!supabase) return;
    const { data } = await supabase.rpc("upsert_event_resource", {
      p_event_id: bundle.id,
      p_type: resourceType,
      p_title: resourceTitle,
      p_url: resourceType === "text_summary" ? null : resourceUrl || null,
      p_content: resourceType === "text_summary" ? resourceContent || null : null,
      p_visibility: "all_confirmed",
      p_specific_user_ids: [],
    });
    if ((data as { ok?: boolean })?.ok) {
      setResourceTitle("");
      setResourceUrl("");
      setResourceContent("");
      const refreshed = await supabase.rpc("get_event_resources_by_slug", {
        p_slug: slug,
      });
      if (Array.isArray(refreshed.data)) {
        setResources(refreshed.data as EventResource[]);
      }
    }
  }

  const start = new Date(bundle.start_datetime);
  const end = new Date(bundle.end_datetime);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b-2 border-black bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-black"
          >
            ← Home
          </Link>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-2 border-2 border-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zinc-100"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {copyDone ? "Copied" : "Copy link"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="border-2 border-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">
            {bundle.event_type === "physical" ? "In person" : "Online"}
          </span>
          <span className="bg-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
            {accessLabel(bundle.access_mode)}
          </span>
        </div>

        <h1 className="text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          {bundle.title}
        </h1>

        <div className="mt-6 flex flex-col gap-4 text-sm font-semibold text-zinc-600 md:flex-row md:items-center md:gap-8">
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {start.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            —{" "}
            {end.toLocaleTimeString(undefined, {
              timeStyle: "short",
            })}{" "}
            ({bundle.timezone})
          </span>
          <span className="inline-flex items-center gap-2">
            <User className="h-4 w-4" />
            <Link
              href={`/organizers/${bundle.organizer.handle ?? bundle.organizer.id}`}
              className="underline"
            >
              {bundle.organizer.display_name ?? "Organizer"}
            </Link>
          </span>
        </div>

        <div className="mt-6 border-2 border-black bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-[0.15em]">
          {bundle.max_capacity != null
            ? `${bundle.confirmed_count} / ${bundle.max_capacity} spots filled`
            : `${bundle.confirmed_count} attending`}
        </div>

        <p className="mt-8 text-lg font-medium leading-relaxed text-zinc-800">
          {bundle.short_description}
        </p>

        {!canSeeFullTeaser ? (
          <p className="mt-6 flex items-start gap-3 border-2 border-black bg-white p-4 text-sm font-medium text-zinc-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            Sign in to see full event details and speaker profiles.
          </p>
        ) : null}

        {canSeeFullTeaser && bundle.full_description ? (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
              About
            </h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800">
              {bundle.full_description}
            </p>
          </section>
        ) : null}

        {canSeeFullTeaser && bundle.speakers && bundle.speakers.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
              Speakers
            </h2>
            <ul className="space-y-4">
              {bundle.speakers.map((s, i) => (
                <li
                  key={`${s.name}-${i}`}
                  className="border-2 border-black bg-white p-4"
                >
                  <p className="text-lg font-black uppercase">{s.name}</p>
                  {s.title ? (
                    <p className="text-sm text-zinc-600">{s.title}</p>
                  ) : null}
                  {s.organisation ? (
                    <p className="text-sm text-zinc-500">{s.organisation}</p>
                  ) : null}
                  {s.bio ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                      {s.bio}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bundle.event_type === "physical" && isAnon ? (
          <p className="mt-6 flex items-start gap-3 border-2 border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            Sign in to see event location (city).
          </p>
        ) : null}

        {bundle.event_type === "physical" && canSeeFullTeaser && bundle.city ? (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" />
            {bundle.city}
          </p>
        ) : null}

        {bundle.event_type === "physical" && canSeeFullTeaser && !bundle.city ? null : null}

        {showVenueOrLink && bundle.event_type === "physical" ? (
          <div className="mt-6 border-4 border-black bg-lime-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Venue
            </p>
            <p className="mt-2 text-lg font-black uppercase">
              {bundle.venue_name ?? "TBA"}
            </p>
            {bundle.venue_address ? (
              <p className="mt-1 text-sm text-zinc-700">{bundle.venue_address}</p>
            ) : null}
          </div>
        ) : canSeeFullTeaser &&
          (viewer === "B" || viewer === "C") &&
          bundle.event_type === "physical" ? (
          <p className="mt-6 border-2 border-black bg-zinc-50 p-4 text-sm">
            Location and joining details are shared once your RSVP is confirmed.
          </p>
        ) : null}

        {showVenueOrLink && bundle.event_type === "digital" ? (
          <div className="mt-6 border-4 border-black bg-lime-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Join online
            </p>
            {bundle.meeting_platform ? (
              <p className="mt-2 text-sm font-bold">{bundle.meeting_platform}</p>
            ) : null}
            {bundle.meeting_link ? (
              <a
                href={bundle.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 break-all text-sm font-black uppercase text-blue-700 underline"
              >
                <Video className="h-4 w-4 shrink-0" />
                Open meeting link
              </a>
            ) : null}
          </div>
        ) : canSeeFullTeaser &&
          (viewer === "B" || viewer === "C") &&
          bundle.event_type === "digital" ? (
          <p className="mt-6 border-2 border-black bg-zinc-50 p-4 text-sm">
            Meeting link will appear here after your RSVP is confirmed by the host
            (or immediately for open events once you submit).
          </p>
        ) : null}

        {viewer === "C" ? (
          <div className="mt-8 border-2 border-black bg-amber-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-900">
              RSVP status
            </p>
            <p className="mt-2 text-sm font-semibold text-amber-950">
              Your RSVP is under review. The host will confirm you soon.
            </p>
          </div>
        ) : null}

        {viewer === "D" || viewer === "E" ? (
          <div className="mt-8 flex items-start gap-3 border-2 border-black bg-white p-5">
            <CheckCircle className="mt-0.5 h-5 w-5 text-lime-700" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                {viewer === "E" ? "Past attendee" : "Confirmed"}
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                {viewer === "E"
                  ? "Thanks for attending. Post-event resources will appear here when the host marks the event complete and uploads materials."
                  : "You are confirmed for this event. Calendar actions are on the confirmation page."}
              </p>
              <Link
                href={`/events/${slug}/confirmed`}
                className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] underline"
              >
                <Calendar className="h-4 w-4" />
                Open confirmation &amp; calendar
              </Link>
            </div>
          </div>
        ) : null}

        {canCancelOwnRsvp ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => void onCancelOwnRsvp()}
              className="border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-100"
            >
              Cancel RSVP (until 2 hours before start)
            </button>
          </div>
        ) : null}

        {bundle.is_host ? (
          <div className="mt-10 border-4 border-black p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              Host
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              You created this event. Manage it from your dashboard.
            </p>
            <Link
              href="/welcome"
              className="mt-4 inline-block border-2 border-black bg-black px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-zinc-900"
            >
              Go to dashboard
            </Link>
          </div>
        ) : inviteOnlyBlocked ? (
          <div className="mt-10 border-4 border-black bg-zinc-100 p-6">
            <p className="text-sm font-bold">
              This event is invite-only. Open the invite link from your host to
              RSVP.
            </p>
          </div>
        ) : showRsvpForm ? (
          <form
            onSubmit={(ev) => void onSubmitRsvp(ev)}
            className="mt-10 space-y-6 border-4 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]"
          >
            <h2 className="text-xl font-black uppercase tracking-tight">RSVP</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Name
                </label>
                <input
                  readOnly
                  value={profileName}
                  className="mt-1 w-full border-2 border-black bg-zinc-50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Email
                </label>
                <input
                  readOnly
                  value={userEmail}
                  className="mt-1 w-full border-2 border-black bg-zinc-50 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {(bundle.rsvp_form_fields ?? []).map((field) =>
              field.label ? (
                <div key={field.label}>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <input
                    required={Boolean(field.required)}
                    value={fieldValues[field.label] ?? ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({
                        ...prev,
                        [field.label]: e.target.value,
                      }))
                    }
                    className="mt-1 w-full border-2 border-black px-3 py-2 text-sm"
                  />
                </div>
              ) : null,
            )}

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 border-2 border-black"
              />
              <span>
                I agree to attend and understand the host may contact me about this
                event.
              </span>
            </label>

            {submitError ? (
              <p className="text-sm font-medium text-red-700">{submitError}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full border-4 border-black bg-black py-4 text-xs font-black uppercase tracking-[0.2em] text-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit RSVP"}
            </button>
          </form>
        ) : null}

        {isAnon ? (
          <p className="mt-10 text-center">
            <Link
              href={`/login?next=${encodeURIComponent(`/events/${slug}${inviteToken ? `?invite=${inviteToken}` : ""}`)}`}
              className="inline-block border-4 border-black bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
            >
              Sign in to RSVP
            </Link>
          </p>
        ) : null}

        {canSeeResources ? (
          <section className="mt-12">
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
              Post-event resources
            </h2>
            {resources.length ? (
              <div className="space-y-3">
                {resources.map((r) => (
                  <article key={r.id} className="border-2 border-black bg-white p-4">
                    <p className="text-sm font-black uppercase">{r.title}</p>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        Open resource
                      </a>
                    ) : null}
                    {r.content ? <p className="mt-2 text-sm">{r.content}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">
                {bundle.is_host
                  ? "No resources uploaded yet."
                  : "The host has not uploaded resources yet."}
              </p>
            )}
          </section>
        ) : null}

        {bundle.is_host ? (
          <form
            onSubmit={(e) => void onUploadResource(e)}
            className="mt-10 space-y-3 border-2 border-black p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Upload post-event resource
            </p>
            <input
              required
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
              placeholder="Resource title"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
            <select
              value={resourceType}
              onChange={(e) =>
                setResourceType(e.target.value as EventResource["type"])
              }
              className="w-full border-2 border-black px-3 py-2 text-sm"
            >
              <option value="video_link">Video link</option>
              <option value="pdf">PDF</option>
              <option value="doc_link">Doc link</option>
              <option value="text_summary">Text summary</option>
            </select>
            {resourceType === "text_summary" ? (
              <textarea
                value={resourceContent}
                onChange={(e) => setResourceContent(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm"
                rows={4}
                placeholder="Summary text"
              />
            ) : (
              <input
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm"
                placeholder="https://..."
                type="url"
              />
            )}
            <button
              type="submit"
              className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white"
            >
              Add resource
            </button>
          </form>
        ) : null}
      </main>
    </div>
  );
}
