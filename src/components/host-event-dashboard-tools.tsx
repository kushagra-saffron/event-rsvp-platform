"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { eventImageObjectPath, STORAGE_BUCKETS } from "@/lib/storage/paths";
import type { EventResource } from "@/lib/events/types";

export type DashboardEventChip = {
  id: string;
  slug: string;
  title: string;
};

export function HostEventDashboardTools({
  event,
  userId,
  thumbnailUrl,
  bannerUrl,
  onUpdated,
}: {
  event: DashboardEventChip;
  userId: string;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  onUpdated: () => void | Promise<void>;
}) {
  const [thumbBusy, setThumbBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [resources, setResources] = useState<EventResource[]>([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceType, setResourceType] =
    useState<EventResource["type"]>("doc_link");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceContent, setResourceContent] = useState("");
  const [resourceMsg, setResourceMsg] = useState<string | null>(null);

  const reloadResources = useCallback(async () => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const { data, error } = await supabase.rpc("get_event_resources_by_slug", {
      p_slug: event.slug,
    });
    if (error) return;
    if (Array.isArray(data)) {
      setResources(data as EventResource[]);
      return;
    }
    setResources([]);
  }, [event.slug]);

  useEffect(() => {
    void reloadResources();
  }, [reloadResources]);

  async function uploadMarketingImage(
    file: File,
    variant: "thumbnail" | "banner",
  ) {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const path = eventImageObjectPath(userId, event.id, variant, file.name);
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKETS.eventImages)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
    if (upErr) {
      setResourceMsg(upErr.message);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKETS.eventImages).getPublicUrl(path);
    const patch =
      variant === "thumbnail"
        ? { thumbnail_image_url: publicUrl }
        : { banner_image_url: publicUrl };
    const { error: dbErr } = await supabase
      .from("events")
      .update(patch)
      .eq("id", event.id)
      .eq("creator_id", userId);
    if (dbErr) {
      setResourceMsg(dbErr.message);
      return;
    }
    setResourceMsg(null);
    await onUpdated();
  }

  async function onThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setThumbBusy(true);
    try {
      await uploadMarketingImage(f, "thumbnail");
    } finally {
      setThumbBusy(false);
    }
  }

  async function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBannerBusy(true);
    try {
      await uploadMarketingImage(f, "banner");
    } finally {
      setBannerBusy(false);
    }
  }

  async function onAddResource(ev: FormEvent) {
    ev.preventDefault();
    setResourceMsg(null);
    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const { data, error } = await supabase.rpc("upsert_event_resource", {
      p_event_id: event.id,
      p_type: resourceType,
      p_title: resourceTitle,
      p_url: resourceType === "text_summary" ? null : resourceUrl || null,
      p_content: resourceType === "text_summary" ? resourceContent || null : null,
      p_visibility: "all_confirmed",
      p_specific_user_ids: [],
    });
    if (error) {
      setResourceMsg(error.message);
      return;
    }
    if (!(data as { ok?: boolean })?.ok) {
      setResourceMsg("Could not add resource.");
      return;
    }
    setResourceTitle("");
    setResourceUrl("");
    setResourceContent("");
    await reloadResources();
  }

  return (
    <div className="mt-4 space-y-8 border-t border-zinc-200 pt-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          Event images (public)
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Square thumbnail for listings; wide banner for the event page header. Optional.
        </p>
        <div className="mt-3 flex flex-wrap gap-6">
          <label className="flex cursor-pointer flex-col gap-2 border-2 border-black bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] hover:bg-white">
            <span>Thumbnail {thumbBusy ? "…" : ""}</span>
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="size-20 border-2 border-black object-cover"
              />
            ) : (
              <span className="text-[10px] font-normal normal-case tracking-normal text-zinc-500">
                None yet
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={thumbBusy}
              onChange={(e) => void onThumbChange(e)}
            />
          </label>
          <label className="flex cursor-pointer flex-col gap-2 border-2 border-black bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] hover:bg-white">
            <span>Banner {bannerBusy ? "…" : ""}</span>
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt=""
                className="h-16 max-w-[200px] border-2 border-black object-cover"
              />
            ) : (
              <span className="text-[10px] font-normal normal-case tracking-normal text-zinc-500">
                None yet
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={bannerBusy}
              onChange={(e) => void onBannerChange(e)}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
          Post-event resources
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Shown to confirmed attendees once the host marks the event complete.
        </p>
        {resources.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {resources.map((r) => (
              <li key={r.id} className="border border-zinc-300 px-3 py-2">
                <span className="font-semibold">{r.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">None yet.</p>
        )}
        <form
          onSubmit={(e) => void onAddResource(e)}
          className="mt-4 space-y-2 border-2 border-dashed border-zinc-300 p-3"
        >
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
            <option value="pdf">PDF link</option>
            <option value="doc_link">Doc link</option>
            <option value="text_summary">Text summary</option>
          </select>
          {resourceType === "text_summary" ? (
            <textarea
              value={resourceContent}
              onChange={(e) => setResourceContent(e.target.value)}
              className="w-full border-2 border-black px-3 py-2 text-sm"
              rows={3}
              placeholder="Summary text"
            />
          ) : (
            <input
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              className="w-full border-2 border-black px-3 py-2 text-sm"
            />
          )}
          <button
            type="submit"
            className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-white"
          >
            Add resource
          </button>
        </form>
        {resourceMsg ? (
          <p className="mt-2 text-xs text-red-700">{resourceMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
