"use client";

import { createClient } from "@/lib/supabase/client";
import { makeUniqueSlug } from "@/lib/slug";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Plus, TrendingUp, X } from "lucide-react";
import type { EventAccessMode } from "@/lib/events/types";

type EventType = "physical" | "digital";

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("physical");
  const [locationCity, setLocationCity] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingPlatform, setMeetingPlatform] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [accessMode, setAccessMode] = useState<EventAccessMode>("open");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customFieldInput, setCustomFieldInput] = useState("");
  const [customFields, setCustomFields] = useState<string[]>([]);

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const supabase = getSupabaseClient();
    const hasDemoCookie = document.cookie.includes("moneystage_demo_auth=1");
    if (hasDemoCookie && process.env.NODE_ENV === "development") {
      setMessage("Demo mode: event submission simulated successfully.");
      setSubmitting(false);
      setTimeout(() => router.push("/welcome"), 700);
      return;
    }

    if (!supabase) {
      setMessage("Supabase keys are missing. Please set env vars in Vercel.");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      if (hasDemoCookie && process.env.NODE_ENV === "development") {
        setMessage("Demo mode: event submission simulated successfully.");
        setSubmitting(false);
        setTimeout(() => router.push("/welcome"), 700);
        return;
      }
      router.push("/login?next=/create");
      return;
    }

    const startDatetime = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endDatetime = new Date(`${endDate}T${endTime}:00`).toISOString();
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      setMessage("End time must be after start time.");
      setSubmitting(false);
      return;
    }

    const teaser =
      shortDescription.trim() ||
      fullDescription.trim().replace(/\s+/g, " ").slice(0, 280);
    const slug = makeUniqueSlug(title);

    const capRaw = maxCapacity.trim();
    let maxCapNum: number | null = null;
    if (capRaw !== "") {
      const parsed = Number.parseInt(capRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setMessage("Max attendees must be a positive number or left blank.");
        setSubmitting(false);
        return;
      }
      maxCapNum = parsed;
    }

    const { error } = await supabase.from("events").insert({
      creator_id: user.id,
      title,
      description: fullDescription.trim() || teaser,
      slug,
      short_description: teaser,
      full_description: fullDescription.trim() || teaser,
      event_type: eventType,
      location_city: eventType === "physical" ? locationCity.trim() : null,
      venue_name: eventType === "physical" ? venueName.trim() || null : null,
      venue_address: eventType === "physical" ? venueAddress.trim() || null : null,
      meeting_link: eventType === "digital" ? meetingLink.trim() : null,
      meeting_platform:
        eventType === "digital" ? meetingPlatform.trim() || null : null,
      timezone,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      access_mode: accessMode,
      publication_status: "published",
      max_capacity: maxCapNum,
      rsvp_form_fields: customFields.map((label) => ({
        label,
        type: "text",
        required: false,
      })),
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Event created successfully.");
    setSubmitting(false);
    router.push("/welcome");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between px-6">
          <Link
            href="/welcome"
            className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-black"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-black">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight">
              MoneyStage
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-14">
        <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
          Create Event
        </h1>
        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Step-by-step event setup for physical and digital sessions.
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-10 space-y-6 border-4 border-black bg-white p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Title
            </label>
            <input
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em]">
                Start Date
              </label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em]">
                Start Time
              </label>
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em]">
                End Date
              </label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em]">
                End Time
              </label>
              <input
                required
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            >
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              RSVP access mode
            </label>
            <select
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value as EventAccessMode)}
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            >
              <option value="open">Open (auto-confirm)</option>
              <option value="approval_required">Approval required</option>
              <option value="invite_only">Invite only</option>
            </select>
          </div>

          {eventType === "physical" ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em]">
                  City
                </label>
                <input
                  required
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em]">
                  Venue name
                </label>
                <input
                  required
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em]">
                  Full address
                </label>
                <input
                  required
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em]">
                  Platform (Zoom, Meet, etc.)
                </label>
                <input
                  required
                  value={meetingPlatform}
                  onChange={(e) => setMeetingPlatform(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em]">
                  Meeting Link
                </label>
                <input
                  required
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Timezone
            </label>
            <input
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Short description (public teaser)
            </label>
            <textarea
              rows={2}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Shown before sign-in on listing cards."
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Full description
            </label>
            <textarea
              required
              rows={5}
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em]">
              Max attendees (optional)
            </label>
            <input
              type="number"
              min={1}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full border-2 border-black px-4 py-3 text-sm focus:outline-none"
            />
          </div>

          <div className="space-y-3 border-2 border-black bg-zinc-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Extra RSVP Questions
            </p>
            <p className="text-xs text-zinc-500">
              Collect extra attendee details (for example: phone, company,
              dietary preference).
            </p>
            <div className="flex gap-2">
              <input
                value={customFieldInput}
                onChange={(e) => setCustomFieldInput(e.target.value)}
                placeholder="Field label"
                className="flex-1 border-2 border-black px-3 py-2 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const value = customFieldInput.trim();
                  if (!value) return;
                  setCustomFields((prev) => [...prev, value]);
                  setCustomFieldInput("");
                }}
                className="inline-flex items-center gap-1 border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.15em] hover:bg-black hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {customFields.length ? (
              <div className="flex flex-wrap gap-2">
                {customFields.map((field, idx) => (
                  <div
                    key={`${field}-${idx}`}
                    className="inline-flex items-center gap-2 border-2 border-black bg-white px-2 py-1 text-xs font-semibold"
                  >
                    {field}
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields((prev) =>
                          prev.filter((_, currentIdx) => currentIdx !== idx),
                        )
                      }
                      className="text-zinc-500 hover:text-black"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full border-4 border-black bg-black px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Event"}
          </button>

          {message ? (
            <p className="text-sm font-medium text-zinc-600">{message}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
