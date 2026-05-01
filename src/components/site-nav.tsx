"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      typeof window !== "undefined" &&
      document.cookie.includes("moneystage_demo_auth=1"),
  );

  function getSupabaseClient() {
    try {
      return createClient();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (document.cookie.includes("moneystage_demo_auth=1")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });
  }, []);

  async function handleSignOut() {
    document.cookie =
      "moneystage_demo_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsLoggedIn(false);
    router.refresh();
  }

  const exploreActive = pathname === "/explore";
  const dashboardActive = pathname === "/welcome";
  const homeActive = pathname === "/";

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-white">
      <div className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center space-x-3"
          aria-current={homeActive ? "page" : undefined}
        >
          <div className="flex h-10 w-10 items-center justify-center bg-black transition group-hover:rotate-12">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black uppercase tracking-tight">
            MoneyStage
          </span>
        </Link>

        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/explore"
            className={`text-[11px] font-black uppercase tracking-[0.25em] ${
              exploreActive
                ? "text-black underline decoration-4 underline-offset-8"
                : "text-zinc-400 hover:text-black"
            }`}
          >
            Explore
          </Link>
          <Link
            href="/create"
            className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 hover:text-black"
          >
            Create
          </Link>
          <Link
            href="/welcome"
            className={`text-[11px] font-black uppercase tracking-[0.25em] ${
              dashboardActive ? "text-black" : "text-zinc-400 hover:text-black"
            }`}
          >
            Dashboard
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
