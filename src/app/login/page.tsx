"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
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
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-medium text-indigo-600">
            ← Home
          </Link>
          <span className="text-sm font-semibold tracking-tight text-zinc-800">
            MoneyStage
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use your Google account to create events or RSVP.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="mt-8 flex h-12 items-center justify-center rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
        {message ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {message}
          </p>
        ) : null}
      </main>
    </div>
  );
}
