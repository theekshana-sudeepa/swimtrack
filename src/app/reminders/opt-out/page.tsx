"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, MailCheck, ArrowLeft } from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";

export default function ReminderOptOutPage() {
  const [optedOut, setOptedOut] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-background text-foreground bg-control-grid">
      <div className="w-full max-w-md p-8 rounded-3xl border border-border bg-card shadow-xl text-center space-y-5">
        <SwimTrackLogo size="md" className="mx-auto" />

        <div className="pt-2">
          <h1 className="text-xl font-extrabold text-foreground">
            Reminder Preferences
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your personal swimming session email reminders.
          </p>
        </div>

        {optedOut ? (
          <div className="p-4 rounded-2xl bg-seafoam/10 border border-seafoam/30 text-xs text-foreground space-y-2">
            <CheckCircle2 className="w-6 h-6 text-seafoam mx-auto" />
            <div className="font-bold">Preferences Updated</div>
            <p className="text-muted-foreground">
              You will no longer receive automated email reminders for upcoming swimming sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs text-left">
            <p className="text-muted-foreground leading-relaxed">
              SwimTrack sends friendly session reminders approximately 24 hours prior to each swim practice.
              You can opt out anytime with one click.
            </p>

            <button
              type="button"
              onClick={() => setOptedOut(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-coral/10 hover:bg-coral/20 text-coral font-bold text-xs border border-coral/30 transition-all active:scale-95"
            >
              Opt Out of Email Reminders
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to SwimTrack Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
