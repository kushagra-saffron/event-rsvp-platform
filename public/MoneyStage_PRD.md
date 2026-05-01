# MoneyStage — Product Requirements Document

**Version:** v1.0  
**Status:** Draft — Internal Review  
**Date:** April 2026  
**Platform:** Next.js + Supabase + Vercel  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Types & States](#3-user-types--states)
4. [Content Visibility Framework](#4-content-visibility-framework)
5. [Event Lifecycle States](#5-event-lifecycle-states)
6. [RSVP Access Modes](#6-rsvp-access-modes)
7. [Feature Specifications](#7-feature-specifications)
8. [Notification System](#8-notification-system)
9. [Data Model](#9-data-model)
10. [Row-Level Security](#10-row-level-security-supabase-rls)
11. [Open Questions](#11-open-questions)
12. [Phased Delivery](#12-phased-delivery)
13. [Appendix — Attendee State Transitions](#appendix--attendee-state-transitions)

---

## 1. Overview

MoneyStage is a finance-native event RSVP platform — analogous to Luma but purpose-built for India's retail investor and financial education community. It enables organizers (educators, fund houses, fintech communities, independent analysts) to host high-signal events, and gives attendees a curated discovery feed to find and join them.

This document covers the complete product scope including the **content visibility and access control framework**, which is a core differentiator. Unlike generic event platforms, MoneyStage enforces a **progressive disclosure model**: what you see depends on who you are, whether your RSVP is confirmed, and whether the event has happened yet.

---

## 2. Goals & Non-Goals

### Goals

- Enable discovery, RSVP, and attendance management for physical and digital finance events
- Enforce progressive content visibility — gate sensitive information (links, locations, speakers, recordings) behind auth and confirmation states
- Give hosts full control over attendee lists, RSVP approval, and post-event resource distribution
- Build organizer identity pages that accumulate credibility over repeated events
- Be shareable and SEO-indexable at the event level without leaking gated information

### Non-Goals (v1)

- Payment processing or ticketing (paid events display price info only; payment happens off-platform)
- Live streaming or in-app video hosting
- Mobile native apps (web-responsive only)
- Social graph / following feed (organizer follow is tracked but no algorithmic feed)

---

## 3. User Types & States

Every user interaction exists in one of these states. The content visibility system is built on top of these states.

| State | Label | Description |
|-------|-------|-------------|
| **A** | Anonymous visitor | Not signed in. Arrived via direct link or organic search. Can view limited public event info only. |
| **B** | Authenticated user | Signed in via Google OAuth. Has a profile. Has not yet RSVPed to this event. |
| **C** | RSVP submitted | Has submitted an RSVP form. Waiting for host confirmation (if approval-gated) or auto-confirmed (if open event). |
| **D** | RSVP confirmed | Host has confirmed the attendee, or event is open-access (auto-confirm). Full pre-event access granted. |
| **E** | Past attendee | Event is marked complete. Confirmed attendee. Post-event resources unlocked. |
| **F** | Host / Organizer | Creator of the event. Sees all states simultaneously. Full admin access at all times. |

---

## 4. Content Visibility Framework

This is the core design constraint of MoneyStage. Every piece of information on an event page maps to a minimum required state before it is shown. Anything not yet unlocked is replaced by a contextual prompt explaining what is needed to see it.

### 4.1 Master Visibility Matrix

| Content element | A: Anon | B: Auth | C: Pending | D: Confirmed | E: Post-event | F: Host |
|----------------|:-------:|:-------:|:----------:|:------------:|:-------------:|:-------:|
| Event title | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Event date & time | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Event type & format | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Short description / teaser | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Organizer name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Capacity / RSVP count | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RSVP / access type badge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full event description | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Speaker list (names + titles) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| City (physical events) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exact venue / address (physical) | — | — | — | ✓ | ✓ | ✓ |
| Meeting link / platform (digital) | — | — | — | ✓ | ✓ | ✓ |
| RSVP submission form | — | ✓ | — | — | — | ✓ |
| RSVP status tracker | — | — | ✓ | ✓ | ✓ | ✓ |
| Calendar export (.ics / GCal) | — | — | — | ✓ | ✓ | ✓ |
| Post-event: recording / video | — | — | — | — | ✓ | ✓ |
| Post-event: slides / deck | — | — | — | — | ✓ | ✓ |
| Post-event: summary notes | — | — | — | — | ✓ | ✓ |
| Attendee list (host view) | — | — | — | — | — | ✓ |
| RSVP form answers (host view) | — | — | — | — | — | ✓ |

> **Legend:** ✓ = Visible · — = Hidden (replaced by contextual gate prompt)
> All host (F) access is elevated only for their own events; hosts are regular attendees on others' events.

### 4.2 Gate Prompts

When content is hidden, it must never just disappear — that creates confusion about whether content exists at all. Each gate state shows a specific prompt instead of a blank section.

| Hidden content | Trigger state | Gate prompt shown |
|----------------|---------------|-------------------|
| Full description, Speaker list | Anonymous (A) | *"Sign in to see full event details and speaker profiles"* |
| City (physical) | Anonymous (A) | *"Sign in to see event location"* |
| Exact address / Meeting link | Auth, not confirmed (B or C) | *"Location and joining details are shared once your RSVP is confirmed"* |
| Meeting link (digital) | Auth, not confirmed (B or C) | *"Meeting link will appear here after your RSVP is confirmed by the host"* |
| Post-event resources | Event not yet complete | *"Recording and materials will be available here once the event concludes"* |
| Post-event resources | Confirmed but event ongoing | *"Check back after the event ends. Resources will be uploaded within 24 hours"* |
| Post-event resources | Event done, not uploaded yet | *"The host hasn't uploaded resources yet. Check back soon"* |

---

## 5. Event Lifecycle States

An event itself has a separate state machine from the attendee. These two state machines combine to determine what is visible.

| Event state | Definition & behaviour |
|-------------|------------------------|
| **Draft** | Not publicly visible. Only host can see it. RSVP not open. |
| **Published** | Publicly discoverable. RSVP form active. All attendee state gating applies. |
| **Cancelled** | Publicly shown as cancelled. RSVP form closed. Confirmed attendees notified by email. All gated content hidden. |
| **Ongoing** | Event date/time has started but host has not marked complete. Location/link visible to confirmed attendees. No post-event resources shown yet. |
| **Completed** | Host has manually marked event as done (or auto-triggered 4 hours post end-time). Post-event resources become uploadable and visible to confirmed attendees. |

> **Important rule:** Post-event resources are **never** shown during Ongoing state, even if pre-uploaded. Resources become visible only after the event transitions to Completed state.

---

## 6. RSVP Access Modes

Hosts choose one of three access modes when creating an event. This affects how the attendee moves through states C → D.

| Mode | Behaviour | Use case |
|------|-----------|----------|
| **Open** | RSVP is auto-confirmed immediately on submission. State jumps C → D instantly. | Public webinars, large open sessions, free events |
| **Approval required** | RSVP moves to Pending (C). Host reviews and approves/rejects each attendee manually. Attendee moves to D on approval. | Closed workshops, peer circles, curated cohorts |
| **Invite only** | RSVP form is hidden on public event page. Only users with a host-generated invite link can access the RSVP form. | Private fund sessions, portfolio review circles, institutional events |

---

## 7. Feature Specifications

### 7.1 Event Discovery (Public)

**What it is:** The landing/explore page. Publicly accessible without login. Shows event cards with only the information allowed at state A.

**Requirements:**

- Each event card shows: title, date/time, event type badge, access mode badge (Free / Paid / Invite only), RSVP count vs capacity, and city OR "Online" label
- Event cards must **not** show: exact address, meeting link, speaker names, full description
- Search: full-text across event title and type
- Filters: city (multi-select), event type (Workshop / AMA / Webinar / Meetup), access type (Free / Paid), format (Physical / Online)
- City filter persists across sessions via URL param (`?city=Delhi+NCR`) for shareability and SEO
- Event pages at `/events/[slug]` are publicly indexable by search engines, but only state-A content is in the rendered HTML

---

### 7.2 Event Detail Page

**What it is:** The canonical page for a single event. Primary entry point from external shares. Adapts its content based on the viewer's attendee state.

#### Always visible (state A+)

- Shareable URL in format `/events/[readable-slug]`
- Event title, date/time with timezone, format badge, access mode badge
- Organizer name and link to organizer profile page
- Capacity bar (X of Y spots filled)
- Copy-link button at top of page

#### Visible after sign-in (state B+)

- Full event description
- Speaker list: name, title, organisation, optional bio
- City name for physical events
- RSVP submission form (with custom fields defined by host)

#### Visible after RSVP confirmed (state D+)

- Exact venue address with map link (physical events)
- Meeting link + platform name (digital events) — shown in a highlighted confirmation box
- Add to Google Calendar button
- Download .ics file button

#### Visible after event completion (state E+)

- Recording link or embedded player
- Slides / deck PDF download
- Summary notes (host-authored text or uploaded document)
- All post-event resources are gated to confirmed attendees only — not visible to state A/B/C visitors even after event ends

> **Design note:** For approval-gated events, state C must show a visible status tracker: *"Your RSVP is under review. The host will confirm within X days."* This prevents duplicate submissions and reassures the user the form wasn't lost.

---

### 7.3 RSVP Submission Flow

**What it is:** The form that an authenticated user fills out to request a spot at the event.

**Requirements:**

- Only shown to state B users (authenticated, not yet RSVPed to this event)
- Always-present fields: name (pre-filled from profile), email (pre-filled), consent checkbox
- Host-defined custom fields: text, dropdown, multi-select, or yes/no — created during event setup
- On submission: attendee moves to state C. If event is Open access, immediately auto-confirms to state D
- Duplicate submission prevention: if state C or D, show RSVP status instead of form
- RSVP cancellation: attendee can withdraw their RSVP from dashboard up to 2 hours before event start

---

### 7.4 Post-RSVP Confirmation Screen

**What it is:** The screen shown immediately after a successful RSVP submission.

**Requirements:**

- Visual confirmation: event name, date, RSVP status (Confirmed or Pending Review)
- If Confirmed (Open events): show Add to Google Calendar and Download .ics immediately
- If Pending (Approval events): show status message and estimated response time if set by host
- Shareable event link with copy button
- Email confirmation sent to attendee (see Section 8 — Notifications)

---

### 7.5 Create Event

**What it is:** The host-facing form to create and publish a new event.

#### Required fields

- Event name, type (Workshop / AMA / Webinar / Meetup), format (Physical / Online)
- Date, start time, end time, timezone (default: `Asia/Kolkata`)
- Short description (public teaser — shown at state A) and full description (shown at state B+)
- For Physical: city, venue name, full address
- For Online: platform name, meeting link
- Cover image (optional — defaults to type-based illustration)
- Max attendees (optional — leave blank for unlimited)
- Access mode: Open / Approval required / Invite only
- Custom RSVP questions (label, type, required/optional)
- Speakers (optional): name, title, organisation, bio — added from search or created inline

#### Post-publish actions

- **Edit event:** all fields editable until 1 hour before start. After that, only description and resources are editable
- **Duplicate event:** copies all settings into a new draft with a new date
- **Cancel event:** sets `cancelled_at`, triggers attendee notification emails, closes RSVP form

---

### 7.6 Host Dashboard

**What it is:** The primary management surface for event creators.

**Requirements:**

- Summary stats: events hosted, total attendees across all events, upcoming events count
- Hosted events list: bucketed as Upcoming, Ongoing, Past, Draft, Cancelled
- Per-event actions: Edit, Duplicate, View attendees, Export CSV, Cancel, Add resources (past events only)
- Attending events list: bucketed as Upcoming, Past
- Per-attending-event actions: View confirmation, Download .ics, Cancel RSVP (if > 2 hours before start)

---

### 7.7 Host Attendee Panel

**What it is:** The host's view of who has RSVPed to their event.

**Requirements:**

- Stats bar: total RSVPs, confirmed, pending, cancelled
- Attendee table: name, email, RSVP status, submitted answers to each custom RSVP field, RSVP timestamp
- Filter by status (confirmed / pending / cancelled)
- Search by name or email
- Approve / Reject individual RSVPs for approval-gated events
- Bulk approve / reject
- Export to CSV: all columns including custom RSVP answers
- For invite-only events: generate and copy invite links

---

### 7.8 Organizer Profile Pages

**What it is:** A public page at `/organizers/[handle]` representing an individual or community host.

**Requirements:**

- Name, avatar/logo, short bio, city/format tags
- Follower count and Follow button (follow is tracked; no algorithmic feed in v1)
- Total events hosted, total attendees across all events
- Upcoming events list (visible to all)
- Past events list with attendance numbers
- Public page — no login required to view organizer profiles

---

### 7.9 Post-Event Resource Management

**What it is:** The host-facing flow to upload and manage resources after an event is completed.

**Requirements:**

- Only accessible after event is in Completed state
- Uploadable resource types: video link (YouTube / Loom), PDF file, document link, text summary (rich text)
- Per-resource visibility: host can mark any resource as "All confirmed attendees" or "Specific attendees"
- Resources become visible on the event detail page only after upload — no auto-publish from draft
- Attendees receive an email notification when resources are uploaded

---

## 8. Notification System

| Trigger | Recipient | Content |
|---------|-----------|---------|
| RSVP submitted (Open event) | Attendee | Confirmation email with event details, calendar links, and joining info (address or meeting link) |
| RSVP submitted (Approval event) | Attendee | Pending confirmation email. Estimated response time if set by host. |
| RSVP submitted (Approval event) | Host | New RSVP notification with attendee name and answers. Link to approve/reject. |
| Host approves RSVP | Attendee | Confirmation email with full joining details (address or meeting link) now included. |
| Host rejects RSVP | Attendee | Rejection email with optional host-written reason. |
| 48 hours before event | Confirmed attendees | Reminder email with joining details. |
| 2 hours before event | Confirmed attendees | Final reminder. Meeting link or address repeated prominently. |
| Event cancelled by host | All RSVPed attendees | Cancellation email with reason (if provided by host). |
| Attendee cancels own RSVP | Host | RSVP cancellation notice with attendee name. |
| Resources uploaded post-event | Confirmed attendees | Email with links to recording, deck, and notes. |

> **Critical rule:** Joining details (exact address for physical events, meeting link for digital events) must **never** appear in any email notification until the attendee is in state D (RSVP confirmed). For approval-gated events, the approval confirmation email is the first email to include these details.

---

## 9. Data Model

### `profiles`
- `id` (uuid), `email`, `display_name`, `avatar_url`, `created_at`

### `events`
- `id`, `slug` (unique), `host_id` (FK profiles), `title`, `type`, `format` (physical | digital)
- `short_description`, `full_description`, `cover_image_url`
- `city`, `venue_name`, `address` (physical only)
- `meeting_link`, `meeting_platform` (digital only)
- `starts_at`, `ends_at`, `timezone`
- `max_capacity`, `access_mode` (open | approval | invite_only)
- `rsvp_form_fields` (JSONB: `[{label, type, required}]`)
- `status` (draft | published | cancelled | completed), `cancelled_at`, `completed_at`
- `created_at`, `updated_at`

### `event_speakers`
- `id`, `event_id` (FK), `name`, `title`, `organisation`, `bio`, `avatar_url`, `display_order`

### `rsvps`
- `id`, `event_id` (FK), `user_id` (FK), `status` (pending | confirmed | cancelled | rejected)
- `response_data` (JSONB: custom RSVP field answers)
- `confirmed_at`, `cancelled_at`, `created_at`

### `event_resources`
- `id`, `event_id` (FK), `type` (video_link | pdf | doc_link | text_summary)
- `title`, `url`, `content` (for text type), `visibility` (all_confirmed | specific)
- `uploaded_by` (FK profiles), `created_at`

### `organizer_follows`
- `follower_id` (FK profiles), `organizer_id` (FK profiles), `created_at`

---

## 10. Row-Level Security (Supabase RLS)

All access control is enforced at the database layer via Supabase RLS policies. Frontend visibility rules are a UX layer on top — not a security layer.

| Table | Operation | Policy |
|-------|-----------|--------|
| `events` | SELECT (full_description, address, meeting_link) | User must be authenticated AND (event is open OR user has confirmed RSVP). Hosts always pass. |
| `events` | SELECT (post-event resources) | Event status must be `completed` AND user must have a confirmed RSVP. |
| `rsvps` | SELECT | User can only read their own RSVP rows. Host can read all RSVPs for their events. |
| `rsvps` | INSERT | User must be authenticated and not have an existing active RSVP for the event. |
| `rsvps` | UPDATE (status) | Only host of the parent event can update status to confirmed/rejected. |
| `event_resources` | SELECT | Event must be completed. User must have confirmed RSVP or be the host. |
| `event_resources` | INSERT / UPDATE | Only host of the parent event. |

> **Critical:** The `meeting_link` and `address` fields must be excluded from the public `events` SELECT policy. These fields should only be returned by a dedicated RPC function (`get_event_joining_details`) that enforces the confirmation check server-side. Never return these fields in a generic events query.

---

## 11. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| 1 | Should city be visible to anonymous users for physical events? | Current spec says no (sign-in required). But this hurts discoverability for location-based search. Consider showing city but not venue name at state A. |
| 2 | Auto-complete vs manual for event completion | Auto-complete after 4 hours post end-time reduces host overhead. But some events run long. Recommend: auto-trigger with host ability to manually complete early or delay. |
| 3 | Waitlist behaviour | If max_capacity is hit, does RSVP form close entirely? Or does a waitlist open? Waitlist adds complexity (position tracking, auto-promotion on cancellation). |
| 4 | Recording visibility for non-attendees | Should past recordings ever be made public (e.g. host chooses to unlock for all)? Adds a content archive dimension to the product. |
| 5 | Email provider | Supabase Auth handles transactional emails for auth. A separate provider (Resend / Postmark) is needed for RSVP notifications. Confirm before sprint. |

---

## 12. Phased Delivery

| Phase | Target | Scope |
|-------|--------|-------|
| **Phase 1** | MVP close | Event detail page, RSVP form submission, confirmation screen, auto-confirm for Open events, email notifications (RSVP confirm + reminder). Close the core loop. |
| **Phase 2** | Host control | Approval-gated RSVP flow, host attendee panel with approve/reject, RSVP cancellation by attendee, event edit and cancel flows, CSV export. |
| **Phase 3** | Polish & growth | Post-event resource upload, organizer profile pages, calendar export, public shareable URL optimisation, duplicate event flow. |
| **Phase 4** | Finance vertical | Speaker profile depth, invite-only events with link generation, capacity + waitlist, post-event resource visibility controls. |

---

## Appendix — Attendee State Transitions

| From state | Trigger | To state | Side effect |
|------------|---------|----------|-------------|
| A — Anonymous | Signs in | B — Authenticated | Profile created if first login |
| B — Authenticated | Submits RSVP (Open event) | D — Confirmed | Confirmation email with full details sent |
| B — Authenticated | Submits RSVP (Approval event) | C — Pending | Pending email to attendee; notification to host |
| C — Pending | Host approves | D — Confirmed | Confirmation email with joining details sent |
| C — Pending | Host rejects | B — Authenticated | Rejection email sent; RSVP row marked rejected |
| D — Confirmed | Event completes | E — Past attendee | Post-event resources unlocked; resource notification when uploaded |
| C or D | Attendee cancels | B — Authenticated | Cancellation recorded; host notified; spot freed |
| Any | Event cancelled by host | — (event void) | Cancellation email sent to all RSVPed attendees |
