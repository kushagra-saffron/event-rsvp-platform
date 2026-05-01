export type EventAccessMode = "open" | "approval_required" | "invite_only";

export type EventPublicationStatus =
  | "draft"
  | "published"
  | "cancelled"
  | "completed";

export type RsvpGuestStatus = "pending" | "confirmed" | "cancelled" | "rejected";

export type EventViewerState = "A" | "B" | "C" | "D" | "E" | "F";

export type RsvpFormField = {
  label: string;
  type?: string;
  required?: boolean;
};

export type EventSpeaker = {
  name: string;
  title?: string | null;
  organisation?: string | null;
  bio?: string | null;
};

export type EventBundle = {
  id: string;
  slug: string;
  title: string;
  event_type: "physical" | "digital";
  access_mode: EventAccessMode;
  publication_status: EventPublicationStatus;
  start_datetime: string;
  end_datetime: string;
  timezone: string;
  max_capacity: number | null;
  confirmed_count: number;
  organizer: { id: string; display_name: string | null };
  viewer: EventViewerState;
  is_host: boolean;
  short_description: string;
  full_description: string | null;
  speakers: EventSpeaker[] | null;
  city: string | null;
  venue_name: string | null;
  venue_address: string | null;
  meeting_platform: string | null;
  meeting_link: string | null;
  rsvp_form_fields: RsvpFormField[] | null;
  rsvp: {
    status: RsvpGuestStatus | null;
    response_data: Record<string, unknown>;
    updated_at: string | null;
  } | null;
};

export type PublishedEventRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  event_type: "physical" | "digital";
  access_mode: EventAccessMode;
  start_datetime: string;
  end_datetime: string;
  timezone: string;
  location_city: string | null;
  max_capacity: number | null;
  confirmed_count: number;
  creator_display_name: string | null;
};

export type SubmitRsvpResult =
  | {
      ok: true;
      status: RsvpGuestStatus;
      slug: string;
      title: string;
      access_mode: string;
      start_datetime: string;
      end_datetime: string;
    }
  | {
      ok: false;
      error: string;
      status?: string;
    };
