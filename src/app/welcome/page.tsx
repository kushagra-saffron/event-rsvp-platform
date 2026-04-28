"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, PlusSquare, TrendingUp } from "lucide-react";

type DashboardStats = {
  hostedCount: number;
  rsvpCount: number;
};

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("Member");
  const [stats, setStats] = useState<DashboardStats>({
    hostedCount: 0,
    rsvpCount: 0,
  });

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/welcome");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const [hostedResult, rsvpResult] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
        supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setDisplayName(profile?.display_name || user.user_metadata?.full_name || "Member");
      setStats({
        hostedCount: hostedResult.count ?? 0,
        rsvpCount: rsvpResult.count ?? 0,
      });
      setLoading(false);
    })();
  }, [router]);

  async function signOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-black">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight">
              MoneyStage
            </span>
          </div>
          <button
            onClick={() => void signOut()}
            className="border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
          Signed In
        </p>
        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Welcome, {displayName}
        </h1>
        <p className="mt-5 max-w-2xl text-sm font-medium uppercase tracking-wide text-zinc-500">
          Your post sign-in workspace for hosting, discovering, and managing RSVPs.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-4 border-black bg-white p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              My Hosted Events
            </p>
            <p className="mt-3 text-5xl font-black">
              {loading ? "…" : stats.hostedCount}
            </p>
          </div>
          <div className="border-4 border-black bg-white p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              My RSVPs
            </p>
            <p className="mt-3 text-5xl font-black">
              {loading ? "…" : stats.rsvpCount}
            </p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-3 border-4 border-black bg-black px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-white hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <CalendarCheck className="h-4 w-4" />
            Discover Events
          </Link>
          <button
            type="button"
            className="flex items-center justify-center gap-3 border-4 border-black px-6 py-5 text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-100"
          >
            <PlusSquare className="h-4 w-4" />
            Create Event (Next)
          </button>
        </div>
      </section>
    </main>
  );
}
