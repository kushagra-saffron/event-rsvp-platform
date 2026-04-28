"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";
import { Lock, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const nextPath =
        new URLSearchParams(window.location.search).get("next") ?? "/welcome";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setMessage("Could not start sign-in.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-black">
      <header className="border-b-2 border-black bg-white">
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-black"
          >
            ← Back
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

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <div className="w-full max-w-xl border-4 border-black bg-white p-10 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-8 flex h-14 w-14 items-center justify-center bg-black">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-4xl font-black uppercase leading-tight tracking-tight">
            Sign in to
            <br />
            MoneyStage
          </h1>
          <p className="mt-4 max-w-md text-sm font-medium uppercase tracking-wide text-zinc-500">
            Continue with Google to RSVP, host events, and access your dashboard.
          </p>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={loading}
            className="mt-10 w-full border-4 border-black bg-black px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] disabled:opacity-60"
          >
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>
          {message ? (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {message}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
