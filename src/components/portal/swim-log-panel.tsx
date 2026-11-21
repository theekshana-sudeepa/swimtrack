"use client";

import * as React from "react";
import {
  Waves,
  Plus,
  Trophy,
  Timer,
  Trash2,
  X,
  Loader2,
  Flame,
  TrendingUp,
} from "lucide-react";
import type { SwimFeeling, SwimLog, SwimStroke, SwimSession } from "@/types/database";
import { computeDistanceMilestone, computeSwimmerPRs } from "@/lib/squad-wrapped";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STROKES: { id: SwimStroke; label: string }[] = [
  { id: "freestyle", label: "Freestyle" },
  { id: "breaststroke", label: "Breaststroke" },
  { id: "backstroke", label: "Backstroke" },
  { id: "butterfly", label: "Butterfly" },
  { id: "mixed", label: "Mixed / IM" },
];

const FEELINGS: { id: SwimFeeling; emoji: string; label: string }[] = [
  { id: "beast", emoji: "🔥", label: "Beast Mode" },
  { id: "strong", emoji: "💪", label: "Strong" },
  { id: "steady", emoji: "🌊", label: "Steady" },
  { id: "tired", emoji: "😮‍💨", label: "Tired" },
];

function getTodayColomboDate(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

interface SwimLogPanelProps {
  initialLogs: SwimLog[];
  swimmerId: string;
  swimmerToken: string;
  nextSession?: SwimSession | null;
  onLogsChange?: (logs: SwimLog[]) => void;
}

export function SwimLogPanel({
  initialLogs,
  swimmerId,
  swimmerToken,
  nextSession,
  onLogsChange,
}: SwimLogPanelProps) {
  const [logs, setLogs] = React.useState<SwimLog[]>(initialLogs);
  const [showModal, setShowModal] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Form state
  const [logDate, setLogDate] = React.useState(getTodayColomboDate());
  const [poolLength, setPoolLength] = React.useState<25 | 50>(25);
  const [lapsInput, setLapsInput] = React.useState("20");
  const [metersInput, setMetersInput] = React.useState("500");
  const [stroke, setStroke] = React.useState<SwimStroke>("freestyle");
  const [feeling, setFeeling] = React.useState<SwimFeeling>("strong");
  const [durationMin, setDurationMin] = React.useState("");
  const [best50m, setBest50m] = React.useState("");
  const [best100m, setBest100m] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const squadTotalMeters = React.useMemo(
    () => logs.reduce((sum, l) => sum + l.distance_meters, 0),
    [logs]
  );
  const milestone = React.useMemo(
    () => computeDistanceMilestone(squadTotalMeters),
    [squadTotalMeters]
  );
  const myPRs = React.useMemo(
    () => computeSwimmerPRs(logs, swimmerId),
    [logs, swimmerId]
  );

  const squadDistanceBoard = React.useMemo(() => {
    const totals = new Map<string, { id: string; name: string; meters: number; count: number }>();
    for (const log of logs) {
      const prev = totals.get(log.swimmer_id);
      if (prev) {
        prev.meters += log.distance_meters;
        prev.count++;
      } else {
        totals.set(log.swimmer_id, {
          id: log.swimmer_id,
          name: log.swimmer_name,
          meters: log.distance_meters,
          count: 1,
        });
      }
    }
    return Array.from(totals.values())
      .sort((a, b) => b.meters - a.meters)
      .slice(0, 5);
  }, [logs]);

  function handleLapsChange(val: string) {
    setLapsInput(val);
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n > 0) {
      setMetersInput(String(n * poolLength));
    }
  }

  function handlePoolLengthChange(len: 25 | 50) {
    setPoolLength(len);
    const n = parseInt(lapsInput, 10);
    if (Number.isFinite(n) && n > 0) {
      setMetersInput(String(n * len));
    }
  }

  async function handleSaveLog(e: React.FormEvent) {
    e.preventDefault();
    const dist = parseInt(metersInput, 10);
    if (!Number.isFinite(dist) || dist < 25) {
      toast.error("Enter at least 25m (or 1 lap).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/swim-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_date: logDate,
          distance_meters: dist,
          laps: parseInt(lapsInput, 10) || null,
          pool_length_meters: poolLength,
          stroke,
          feeling,
          duration_minutes: durationMin ? Number(durationMin) : null,
          best_50m_seconds: best50m ? Number(best50m) : null,
          best_100m_seconds: best100m ? Number(best100m) : null,
          notes: notes.trim() || null,
          session_id: nextSession?.date === logDate ? nextSession.id : null,
          swimmer_token: swimmerToken,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        log?: SwimLog;
        error?: string;
      };
      if (!res.ok || !json.success || !json.log) {
        toast.error(json.error || "Could not save swim log.");
        return;
      }

      const nextLogs = [json.log, ...logs];
      setLogs(nextLogs);
      onLogsChange?.(nextLogs);
      setShowModal(false);
      setNotes("");
      setBest50m("");
      setBest100m("");
      setDurationMin("");
      toast.success(`Logged ${dist.toLocaleString()}m! Squad distance updated 🌊`);
    } catch {
      toast.error("Network error saving swim log.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(logId: string) {
    if (!window.confirm("Remove this swim log entry?")) return;
    setDeletingId(logId);
    try {
      const res = await fetch(
        `/api/swim-logs/${logId}?token=${encodeURIComponent(swimmerToken)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not delete swim log.");
        return;
      }
      const nextLogs = logs.filter((l) => l.id !== logId);
      setLogs(nextLogs);
      onLogsChange?.(nextLogs);
      toast.info("Swim log removed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <section
        id="swim-distance-log"
        className="scroll-mt-20 p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-seafoam/15 border border-seafoam/35 text-seafoam flex items-center justify-center shrink-0">
              <Waves className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground leading-tight">
                Distance Challenge &amp; Swim PRs 🏊‍♂️
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Log laps in 3 seconds, track 50m/100m PRs &amp; push the squad distance goal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLogDate(getTodayColomboDate());
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-seafoam hover:bg-seafoam/90 text-ocean-950 text-[11px] font-extrabold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log My Swim</span>
          </button>
        </div>

        {/* Squad Distance Milestone Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-aqua/10 via-seafoam/10 to-secondary/40 border border-aqua/25 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-aqua">
                Squad Season Distance Goal
              </div>
              <div className="text-xs sm:text-sm font-black text-foreground mt-0.5">
                {milestone.label}
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-base font-black text-seafoam">
                {(squadTotalMeters / 1000).toFixed(2)} km
              </div>
              <div className="text-[10px] text-muted-foreground">
                {milestone.remainingKm} km to milestone
              </div>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              style={{ width: `${Math.max(4, milestone.progressPct)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-aqua to-seafoam transition-all duration-500"
            />
          </div>
        </div>

        {/* My Personal Records Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-secondary/35 border border-border/70">
            <div className="text-lg font-black font-mono text-aqua">
              {myPRs.totalMeters >= 1000
                ? `${(myPRs.totalMeters / 1000).toFixed(2)}k`
                : `${myPRs.totalMeters}m`}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">My Total Swam</div>
          </div>
          <div className="p-3 rounded-2xl bg-secondary/35 border border-border/70">
            <div className="text-lg font-black font-mono text-seafoam">
              {myPRs.longestSwimMeters > 0 ? `${myPRs.longestSwimMeters}m` : "—"}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">Longest Swim PR</div>
          </div>
          <div className="p-3 rounded-2xl bg-secondary/35 border border-border/70">
            <div className="text-lg font-black font-mono text-amber-400">
              {myPRs.fastest50mSeconds != null ? `${myPRs.fastest50mSeconds}s` : "—"}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">Fastest 50m PR</div>
          </div>
          <div className="p-3 rounded-2xl bg-secondary/35 border border-border/70">
            <div className="text-lg font-black font-mono text-foreground">
              {myPRs.fastest100mSeconds != null ? `${myPRs.fastest100mSeconds}s` : "—"}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">Fastest 100m PR</div>
          </div>
        </div>

        {/* Squad Distance Top Swimmers */}
        {squadDistanceBoard.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-seafoam" />
              <span>Top Distance Swimmers</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {squadDistanceBoard.map((entry, idx) => (
                <span
                  key={entry.id}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5",
                    entry.id === swimmerId
                      ? "bg-aqua/15 border-aqua/40 text-aqua"
                      : "bg-secondary/40 border-border text-foreground"
                  )}
                >
                  <span className="font-mono text-[10px] opacity-75">#{idx + 1}</span>
                  <span>{entry.name}</span>
                  <span className="font-mono text-seafoam">
                    {entry.meters >= 1000
                      ? `${(entry.meters / 1000).toFixed(2)}km`
                      : `${entry.meters}m`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Squad Swim Logs */}
        {logs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {logs.slice(0, 10).map((log) => {
              const feel = FEELINGS.find((f) => f.id === log.feeling) || FEELINGS[1];
              const isMine = log.swimmer_id === swimmerId;
              return (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl border border-border/70 bg-secondary/25 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-foreground">{log.swimmer_name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-seafoam/15 border border-seafoam/30 text-seafoam font-mono font-black text-[10px]">
                        {log.distance_meters.toLocaleString()}m
                      </span>
                      {log.laps && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({log.laps} laps &bull; {log.pool_length_meters}m pool)
                        </span>
                      )}
                      <span className="text-[10px] capitalize px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                        {log.stroke}
                      </span>
                      <span title={feel.label}>{feel.emoji}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-2">
                      <span className="font-mono">{log.log_date}</span>
                      {log.duration_minutes && <span>&bull; {log.duration_minutes} mins</span>}
                      {log.best_50m_seconds && (
                        <span className="text-amber-400 font-mono font-bold">
                          &bull; 50m: {log.best_50m_seconds}s
                        </span>
                      )}
                      {log.best_100m_seconds && (
                        <span className="text-aqua font-mono font-bold">
                          &bull; 100m: {log.best_100m_seconds}s
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="text-[10px] text-muted-foreground italic truncate">
                        &ldquo;{log.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {isMine && (
                    <button
                      type="button"
                      disabled={deletingId === log.id}
                      onClick={() => handleDelete(log.id)}
                      title="Delete swim log"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-coral transition-colors shrink-0"
                    >
                      {deletingId === log.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            No swim distances logged yet — tap <strong>Log My Swim</strong> after your next session to kick off the squad milestone!
          </p>
        )}
      </section>

      {/* Log My Swim Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isSaving && setShowModal(false)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-seafoam/15 border border-seafoam/35 text-seafoam flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Log Your Swim</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Counts toward your PRs &amp; the Squad Distance Challenge
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Swim Date</label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Pool Length</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([25, 50] as const).map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => handlePoolLengthChange(len)}
                        className={cn(
                          "py-2 rounded-xl border font-bold font-mono transition-colors",
                          poolLength === len
                            ? "bg-aqua/15 border-aqua/50 text-aqua"
                            : "bg-secondary/40 border-border text-muted-foreground"
                        )}
                      >
                        {len}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Laps</label>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={lapsInput}
                    onChange={(e) => handleLapsChange(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Distance (meters) *
                  </label>
                  <input
                    type="number"
                    min="25"
                    max="50000"
                    required
                    value={metersInput}
                    onChange={(e) => setMetersInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-seafoam font-mono font-black"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">Main Stroke</label>
                <div className="flex flex-wrap gap-1.5">
                  {STROKES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStroke(st.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl border text-[11px] font-bold",
                        stroke === st.id
                          ? "bg-aqua/15 border-aqua/50 text-aqua"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">How did it feel?</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {FEELINGS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFeeling(f.id)}
                      className={cn(
                        "py-1.5 px-1 rounded-xl border text-[10px] font-bold text-center",
                        feeling === f.id
                          ? "bg-seafoam/15 border-seafoam/50 text-seafoam"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      )}
                    >
                      <div>{f.emoji}</div>
                      <div className="truncate">{f.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    <span>Duration (m)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    placeholder="45"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-secondary/40 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">50m PR (sec)</label>
                  <input
                    type="number"
                    min="15"
                    max="600"
                    step="0.1"
                    value={best50m}
                    onChange={(e) => setBest50m(e.target.value)}
                    placeholder="34.5"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-secondary/40 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">100m PR (sec)</label>
                  <input
                    type="number"
                    min="35"
                    max="1200"
                    step="0.1"
                    value={best100m}
                    onChange={(e) => setBest100m(e.target.value)}
                    placeholder="78.0"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-secondary/40 font-mono"
                  />
                </div>
              </div>

              <input
                type="text"
                maxLength={240}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quick note (e.g. Felt fast on freestyle sprints!)"
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-seafoam hover:bg-seafoam/90 text-ocean-950 font-extrabold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Flame className="w-3.5 h-3.5" />
                  )}
                  <span>Save Swim Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
