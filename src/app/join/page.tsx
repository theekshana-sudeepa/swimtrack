"use client";

import * as React from "react";
import Link from "next/link";
import {
  Waves,
  Mail,
  User,
  Phone,
  Sparkles,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Award,
} from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import { joinSquadAction } from "@/actions/swimmer-actions";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export default function JoinSquadPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [joinedSwimmer, setJoinedSwimmer] = React.useState<{
    name: string;
    nickname?: string;
    email?: string;
    isExisting?: boolean;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await joinSquadAction(formData);
      if (!res.success || !res.swimmer) {
        toast.error(res.error || "Failed to join squad. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setJoinedSwimmer({
        name: res.swimmer.full_name,
        nickname: res.swimmer.nickname || undefined,
        email: res.swimmer.email || undefined,
        isExisting: res.isExisting,
      });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success(
        res.isExisting
          ? "Squad credentials updated successfully!"
          : "Welcome to the squad! You are on the roster."
      );
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-aqua selection:text-ocean-950">
      {/* Top Navigation */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <SwimTrackLogo size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/80"
          >
            Admin Sign In &rarr;
          </Link>
        </div>
      </header>

      {/* Main Join Container */}
      <main className="w-full max-w-lg mx-auto px-4 py-8">
        {!joinedSwimmer ? (
          <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient Aquatic Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-aqua/15 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-seafoam/15 blur-3xl pointer-events-none" />

            <div className="relative space-y-5">
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aqua/10 border border-aqua/30 text-aqua text-xs font-bold uppercase tracking-wider">
                  <Waves className="w-3.5 h-3.5 animate-pulse" />
                  <span>Squad Self-Registration</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Join the SwimTrack Squad 🏊
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Add yourself to our swimming roster. Get automated morning reminders, track your attendance,
                  and earn your squad rank. No passwords or account creation needed!
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="full_name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-aqua" />
                    <span>Your Full Name *</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    placeholder="e.g. Kasun Perera"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Nickname / Squad Handle */}
                <div className="space-y-1.5">
                  <label htmlFor="nickname" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-seafoam" />
                      <span>Squad Nickname / Call-sign</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                  </label>
                  <input
                    id="nickname"
                    name="nickname"
                    type="text"
                    placeholder="e.g. Torpedo, Sharky, KP"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400" />
                      <span>Email Address</span>
                    </span>
                    <span className="text-[10px] text-aqua font-semibold">For session reminders</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="e.g. kasun@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      <span>Phone / WhatsApp</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="e.g. +94 77 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Reminder Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/80 cursor-pointer hover:bg-secondary/60 transition-colors">
                    <input
                      type="checkbox"
                      name="email_reminders_enabled"
                      defaultChecked
                      className="mt-0.5 w-4 h-4 rounded text-aqua focus:ring-aqua accent-aqua"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-aqua" />
                        <span>Send morning reminders (~8:00 AM)</span>
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Automated alerts before scheduled swim days with location & start time. 1-click opt-out anytime.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 text-sm font-extrabold flex items-center justify-center gap-2 hover:opacity-95 shadow-md shadow-aqua/20 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-ocean-950 border-t-transparent rounded-full animate-spin" />
                      <span>Adding to Roster...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Swim Squad</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Privacy Footer Callout */}
              <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground justify-center">
                <ShieldCheck className="w-4 h-4 text-seafoam" />
                <span>Zero spam &bull; Private squad use &bull; 100% Non-commercial</span>
              </div>
            </div>
          </div>
        ) : (
          /* Welcome Success Card */
          <div className="rounded-3xl border border-seafoam/40 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-seafoam/15 border border-seafoam/40 text-seafoam flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">
                You&apos;re Officially on Deck! 🌊
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Welcome, <strong className="text-foreground">{joinedSwimmer.name}</strong>
                {joinedSwimmer.nickname ? ` ("${joinedSwimmer.nickname}")` : ""}. Your squad registration is confirmed.
              </p>
            </div>

            {/* Initial Squad Persona Card */}
            <div className="p-5 rounded-2xl bg-ocean-900 border border-aqua/30 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-aqua text-[11px] font-extrabold uppercase tracking-wider">
                <Award className="w-3.5 h-3.5" />
                <span>Assigned Squad Persona</span>
              </div>
              <p className="text-xl font-extrabold text-aqua">Eager Cadet 🏊</p>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-seafoam/20 text-seafoam text-xs font-bold border border-seafoam/30">
                Zero-Polla Status &bull; 100% Clean Slate
              </div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto pt-1">
                Show up to upcoming sessions to maintain your title. One missed session and the Polla Meter activates!
              </p>
            </div>

            {joinedSwimmer.email && (
              <p className="text-xs text-muted-foreground">
                A welcome pack has been sent to{" "}
                <span className="font-semibold text-foreground">{joinedSwimmer.email}</span>.
              </p>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border hover:bg-secondary text-xs font-bold text-foreground transition-all"
              >
                View SwimTrack Showcase
              </Link>
              <button
                type="button"
                onClick={() => setJoinedSwimmer(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-aqua text-ocean-950 text-xs font-bold hover:bg-aqua-hover transition-all"
              >
                Register Another Swimmer
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-muted-foreground border-t border-border/40">
        <p>&copy; {new Date().getFullYear()} SwimTrack &bull; Non-commercial Open-Source Swimming Project</p>
      </footer>
    </div>
  );
}

