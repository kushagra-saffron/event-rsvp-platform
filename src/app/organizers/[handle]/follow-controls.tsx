"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FollowControls({ organizerId }: { organizerId: string }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);
        if (!user) return;
        const { data } = await supabase
          .from("organizer_follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("organizer_id", organizerId)
          .maybeSingle();
        setIsFollowing(Boolean(data));
      } catch {
        setUserId(null);
      }
    })();
  }, [organizerId]);

  async function toggle() {
    if (!userId) return;
    setLoading(true);
    const supabase = createClient();
    if (isFollowing) {
      await supabase.rpc("unfollow_organizer", { p_organizer_id: organizerId });
      setIsFollowing(false);
    } else {
      await supabase.rpc("follow_organizer", { p_organizer_id: organizerId });
      setIsFollowing(true);
    }
    setLoading(false);
  }

  if (!userId) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      className="mt-4 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white disabled:opacity-60"
    >
      {loading ? "Saving..." : isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}
