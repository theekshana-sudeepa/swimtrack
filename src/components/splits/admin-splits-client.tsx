"use client";

import * as React from "react";
import { Wallet, AlertTriangle, CheckCircle2, Clock, Coins } from "lucide-react";
import { SquadExpense, Swimmer, SwimSession } from "@/types/database";
import { SquadSplitsPanel } from "./squad-splits-panel";

function fmtLkr(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safe * 100) % 100 !== 0;
  return `LKR ${safe.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

interface AdminSplitsClientProps {
  initialExpenses: SquadExpense[];
  swimmers: Swimmer[];
  sessions: SwimSession[];
  attendeesByDate: Record<string, string[]>;
  migrationNeeded: boolean;
}

export function AdminSplitsClient({
  initialExpenses,
  swimmers,
  sessions,
  attendeesByDate,
  migrationNeeded,
}: AdminSplitsClientProps) {
  const [expenses, setExpenses] = React.useState<SquadExpense[]>(initialExpenses);

  const stats = React.useMemo(() => {
    let totalLogged = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let openSplits = 0;
    for (const exp of expenses) {
      totalLogged += exp.total_amount;
      let hasUnpaid = false;
      for (const sh of exp.shares) {
        if (sh.is_paid) totalCollected += sh.share_amount;
        else {
          totalPending += sh.share_amount;
          hasUnpaid = true;
        }
      }
      if (hasUnpaid) openSplits++;
    }
    return { totalLogged, totalCollected, totalPending, openSplits };
  }, [expenses]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
          <Wallet className="w-6 h-6 text-amber-400" />
          <span>Squad Kitty &amp; Bill Splits</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Track pool entry tickets, post-swim coffee bills, and who has settled up — synced live with every Swimmer Pass.
        </p>
      </div>

      {migrationNeeded && (
        <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-foreground">
              One-Time Supabase SQL Setup Required
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Run{" "}
              <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-aqua">
                supabase/migrations/20260106000000_tier1_social_and_splits.sql
              </code>{" "}
              in your Supabase SQL Editor to enable persistent Chalkboard messages, emoji reactions, and Squad Bill Splits.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-aqua" />
            <span>Total Logged</span>
          </div>
          <div className="text-lg font-black font-mono text-foreground mt-1">
            {fmtLkr(stats.totalLogged)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-seafoam/25 bg-seafoam/5">
          <div className="text-[11px] font-semibold text-seafoam flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settled / Paid</span>
          </div>
          <div className="text-lg font-black font-mono text-seafoam mt-1">
            {fmtLkr(stats.totalCollected)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-coral/25 bg-coral/5">
          <div className="text-[11px] font-semibold text-coral flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Collection</span>
          </div>
          <div className="text-lg font-black font-mono text-coral mt-1">
            {fmtLkr(stats.totalPending)}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground">Open Splits</div>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.openSplits}
          </div>
        </div>
      </div>

      <SquadSplitsPanel
        initialExpenses={expenses}
        swimmers={swimmers}
        sessions={sessions}
        attendeesByDate={attendeesByDate}
        isAdmin
        onExpensesChange={setExpenses}
      />
    </div>
  );
}
