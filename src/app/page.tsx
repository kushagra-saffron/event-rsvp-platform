"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

function AuthModal({
  isOpen,
  onClose,
  onLogin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md border-4 border-black bg-white p-10 text-center shadow-[18px_18px_0px_0px_rgba(0,0,0,1)]">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center bg-black">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h3 className="mb-3 text-2xl font-black uppercase tracking-tight">
          Verified Access
        </h3>
        <p className="mb-8 text-sm text-zinc-600">
          Please sign in with Google to RSVP or create events.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="w-full border-4 border-black px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      typeof window !== "undefined" &&
      document.cookie.includes("moneystage_demo_auth=1"),
  );
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  function handleLogin() {
    setShowAuthModal(false);
    router.push("/login?next=/welcome");
  }

  function handleCreateEventClick() {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    router.push("/create");
  }

  return (
    <div className="flex min-h-full flex-col bg-white text-black antialiased">
      <main className="flex flex-1 flex-col">
        <section className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="max-w-5xl">
            <div className="mb-10 inline-flex items-center border-2 border-black px-5 py-2">
              <span className="text-[11px] font-black uppercase tracking-[0.3em]">
                MoneyStage Event Series
              </span>
            </div>
            <h1 className="mb-8 text-6xl font-black uppercase leading-[0.9] tracking-tighter md:text-8xl">
              Manage
              <br />
              Your Money
            </h1>
            <p className="mx-auto mb-12 max-w-2xl text-lg font-bold uppercase tracking-tight text-zinc-500 md:text-2xl">
              High-calibre events for modern investors, with physical and digital
              sessions in one clean RSVP flow.
            </p>

            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              <Link
                href="/explore"
                className="w-full bg-black px-12 py-5 text-center text-sm font-black uppercase tracking-[0.25em] text-white transition hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:w-auto"
              >
                Explore Events
              </Link>
              <button
                type="button"
                onClick={handleCreateEventClick}
                className="w-full border-4 border-black px-12 py-5 text-sm font-black uppercase tracking-[0.25em] transition hover:bg-zinc-100 sm:w-auto"
              >
                Create Event
              </button>
            </div>
          </div>
        </section>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
      />

      <footer className="mt-auto border-t-2 border-black bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-start justify-between gap-4 px-6 py-8 text-xs font-black uppercase tracking-[0.15em] text-zinc-500 sm:flex-row sm:items-center">
          <span className="text-zinc-800">MoneyStage</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-black">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-black">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
