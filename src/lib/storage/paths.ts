/** Supabase Storage bucket IDs (matches migration). */
export const STORAGE_BUCKETS = {
  avatars: "avatars",
  eventImages: "event_images",
} as const;

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar`;
}

export function eventImageObjectPath(
  userId: string,
  eventId: string,
  variant: "thumbnail" | "banner",
  extFromFilename: string,
): string {
  const ext = extFromFilename.includes(".")
    ? extFromFilename.slice(extFromFilename.lastIndexOf("."))
    : ".webp";
  return `${userId}/${eventId}/${variant}${ext}`;
}
