"use client";

import { memo } from "react";
import type { PublishedEventRow } from "@/lib/events/types";
import { ArrowUpRight, MapPin, User, Video } from "lucide-react";

export const EventCard = memo(function EventCard({
  event,
  onOpen,
}: {
  event: PublishedEventRow;
  onOpen: (slug: string) => void;
}) {
  const start = new Date(event.start_datetime);
  const access =
    event.access_mode === "open"
      ? "Open"
      : event.access_mode === "approval_required"
        ? "Approval"
        : "Invite";

  return (
    <button
      type="button"
      onClick={() => onOpen(event.slug)}
      className="group flex h-full flex-col overflow-hidden border-2 border-black bg-white text-left transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[14px_14px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className="relative aspect-square w-full shrink-0 overflow-hidden border-b-2 border-black bg-zinc-200">
        {event.thumbnail_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase URLs
          <img
            src={event.thumbnail_image_url}
            alt=""
            className="size-full object-cover"
          />
        ) : null}
        <span className="absolute left-3 top-3 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-800">
          {access}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="text-xl font-black uppercase leading-tight tracking-tight">
          {event.title}
        </span>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {event.creator_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.creator_avatar_url}
                alt=""
                className="size-8 shrink-0 border-2 border-black object-cover"
              />
            ) : (
              <User className="size-8 shrink-0 border-2 border-black bg-zinc-100 p-1.5 text-zinc-500" />
            )}
            <p className="truncate text-xs font-bold uppercase tracking-tight">
              {event.creator_display_name ?? "Host"}
            </p>
          </div>
          <div className="flex shrink-0 items-center bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase">
            {event.event_type === "digital" ? (
              <Video className="mr-1 h-3.5 w-3.5" />
            ) : (
              <MapPin className="mr-1 h-3.5 w-3.5" />
            )}
            {event.event_type === "digital" ? "Online" : "In person"}
          </div>
        </div>
        <p className="mt-3 line-clamp-3 text-sm text-zinc-600">{event.short_description}</p>
        <div className="mt-auto flex items-center justify-between border-t-2 border-black pt-4">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
            {start.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <ArrowUpRight className="h-5 w-5 text-zinc-400 group-hover:text-black" />
        </div>
        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
          {event.event_type === "physical"
            ? event.location_city ?? "City TBA"
            : "Online"}
          {event.max_capacity != null
            ? ` · ${event.confirmed_count}/${event.max_capacity}`
            : ` · ${event.confirmed_count} going`}
        </p>
      </div>
    </button>
  );
});
