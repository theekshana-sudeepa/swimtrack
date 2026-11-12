"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Waves, ArrowRight, Search, ShieldCheck } from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import { toast } from "sonner";

export default function PortalLookupPage() {
  const router = useRouter();
  const [inputVal, setInputVal] = React.useState("");

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean) return;

    if (clean.toLowerCase().includes("admin")) {
      toast.error("Administrator access is restricted. Please sign in via the Admin Login page.");
      return;
    }

    // Direct redirect to /portal/[inputVal]
    router.push(`/portal/${encodeURIComponent(clean)}`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6">
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <Link href="/">
          <SwimTrackLogo size="md" />
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Admin Login &rarr;
        </Link>
      </header>

      <main className="max-w-md mx-auto w-full p-8 rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-aqua/10 border border-aqua/30 text-aqua flex items-center justify-center mx-auto">
          <Waves className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">
            Find Your Swimmer Pass 🏊
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your email address or your squad pass token from your welcome email to open your personal attendance dashboard.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 pt-2">
          <input
            type="text"
            required
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter your registered email address..."
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua text-center placeholder:text-muted-foreground/60"
          />

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 font-extrabold text-xs flex items-center justify-center gap-2 hover:opacity-95 shadow-md active:scale-95 transition-all"
          >
            <span>Open My Swimmer Pass</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-seafoam" />
          <span>Zero passwords needed &bull; Private squad roster</span>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground pb-4">
        SwimTrack &bull; The Aquatic Control Room
      </footer>
    </div>
  );
}

