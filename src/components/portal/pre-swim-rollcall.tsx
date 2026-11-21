"use client";

import * as React from "react";
import { Radio, X, Loader2 } from "lucide-react";
import type { RollCallStatus, SessionRollCall } from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS: {
  id: RollCallStatus;
  emoji: string;
  label: string;
  tone: string;
}[] = [
  {
    id: "awake",
    emoji: "☕",
    label: "Awake",
    tone: "bg-amber-400/15 border-amber-400/40 text-amber-300",
  },
  {
    id: "on_my_way",
    emoji: "🚗",
    label: "On My Way",
    tone: "bg-seafoam/15 border-seafoam/40 text-seafoam",
  },
  {
    id: "offering_ride",
    emoji: "🚘",
    label: "Offering Ride",
    tone: "bg-aqua/15 border-aqua/40 text-aqua",
  },
  {
    id: "need_ride",
    emoji: "🙋",
    label: "Need a Ride",
    tone: "bg-sky-400/15 border-sky-400/40 text-sky-300",
  },
  {
    id: "running_late",
    emoji: "⏰",
    label: "Running Late",
    tone: "bg-coral/15 border-coral/40 text-coral",
  },
];

interface PreSwimRollCallProps {
  sessionId: string;
  swimmerId: string;
  swimmerToken: string;
  initialRollCalls: SessionRollCall[];
}

export function PreSwimRollCall({
  sessionId,
  swimmerId,
  swimmerToken,
  initialRollCalls,
}: PreSwimRollCallProps) {
  const [rollCalls, setRollCalls] = React.useState<SessionRollCall[]>(initialRollCalls);
  const myCurrent = rollCalls.find((r) => r.swimmer_id === swimmerId) || null;
  const [noteInput, setNoteInput] = React.useState(myCurrent?.note || "");
  const [busyStatus, setBusyStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRollCalls(initialRollCalls);
  }, [initialRollCalls]);

  async function handleSelectStatus(status: RollCallStatus) {
    setBusyStatus(status);
    try {
      const res = await fetch("/api/rollcall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          status,
          note: noteInput.trim() || null,
          swimmer_token: swimmerToken,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rollCalls?: SessionRollCall[];
        error?: string;
      };
      if (!res.ok || !json.success || !json.rollCalls) {
        toast.error(json.error || "Could not update roll-call status.");
        return;
      }
      setRollCalls(json.rollCalls);
      const opt = STATUS_OPTIONS.find((o) => o.id === status);
      toast.success(`Live ping set: ${opt?.emoji} ${opt?.label}!`);
    } catch {
      toast.error("Network error updating roll-call.");
    } finally {
      setBusyStatus(null);
    }
  }

  async function handleClear() {
    setBusyStatus("clear");
    try {
      const res = await fetch(
        `/api/rollcall?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(swimmerToken)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rollCalls?: SessionRollCall[];
      };
      if (res.ok && json.success && json.rollCalls) {
        setRollCalls(json.rollCalls);
        setNoteInput("");
        toast.info("Roll-call ping cleared.");
      }
    } finally {
      setBusyStatus(null);
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/80 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
          <Radio className="w-3.5 h-3.5 text-aqua animate-pulse" />
          <span>Pre-Swim Roll-Call &amp; Rides</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {rollCalls.length} ping{rollCalls.length === 1 ? "" : "s"} live
          </span>
          {myCurrent && (
            <button
              type="button"
              disabled={busyStatus !== null}
              onClick={handleClear}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground hover:text-coral transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 1-Tap Status Chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = myCurrent?.status === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={busyStatus !== null}
              onClick={() => handleSelectStatus(opt.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95",
                isSelected
                  ? cn(opt.tone, "ring-1 ring-current shadow-xs")
                  : "bg-card/80 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {busyStatus === opt.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span>{opt.emoji}</span>
              )}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Optional Ride / ETA Note */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          maxLength={140}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Optional note (e.g. Leaving Dehiwala, 2 seats free / ETA 6:20 AM)..."
          className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background/60 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
        />
        {myCurrent && noteInput.trim() !== (myCurrent.note || "") && (
          <button
            type="button"
            disabled={busyStatus !== null}
            onClick={() => handleSelectStatus(myCurrent.status)}
            className="px-2.5 py-1.5 rounded-xl bg-aqua text-ocean-950 font-extrabold text-[10px] shrink-0"
          >
            Update Note
          </button>
        )}
      </div>

      {/* Live Squad Roll-Call Feed */}
      {rollCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
          {rollCalls.map((rc) => {
            const opt = STATUS_OPTIONS.find((o) => o.id === rc.status) || STATUS_OPTIONS[0];
            return (
              <div
                key={rc.id}
                className={cn(
                  "px-2.5 py-1 rounded-xl border text-[10px] flex items-center gap-1.5",
                  opt.tone
                )}
              >
                <span>{opt.emoji}</span>
                <span className="font-extrabold text-foreground">{rc.swimmer_name}</span>
                <span className="opacity-85">&bull; {opt.label}</span>
                {rc.note && (
                  <span className="text-muted-foreground italic truncate max-w-[160px]">
                    &ldquo;{rc.note}&rdquo;
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
