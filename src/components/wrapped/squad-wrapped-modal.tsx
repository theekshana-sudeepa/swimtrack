"use client";

import * as React from "react";
import {
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Share2,
  Trophy,
  Waves,
  Camera,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  SwimLog,
  SquadMemory,
} from "@/types/database";
import {
  computeSquadWrapped,
  getAvailableWrappedMonths,
} from "@/lib/squad-wrapped";
import { shareOrDownloadWrappedCard } from "@/lib/wrapped-card-generator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SquadWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  swimmers: Swimmer[];
  sessions: SwimSession[];
  attendance: AttendanceRecord[];
  swimLogs: SwimLog[];
  memories: SquadMemory[];
  currentSwimmerId?: string | null;
}

export function SquadWrappedModal({
  isOpen,
  onClose,
  swimmers,
  sessions,
  attendance,
  swimLogs,
  memories,
  currentSwimmerId = null,
}: SquadWrappedModalProps) {
  const monthOptions = React.useMemo(
    () => getAvailableWrappedMonths({ sessions, swimLogs, memories }),
    [sessions, swimLogs, memories]
  );

  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    monthOptions[0]?.key || "all"
  );
  const [slide, setSlide] = React.useState(0);
  const [isSharing, setIsSharing] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSlide(0);
      if (monthOptions.length > 0 && !monthOptions.some((m) => m.key === selectedMonth)) {
        setSelectedMonth(monthOptions[0].key);
      }
    }
  }, [isOpen, monthOptions, selectedMonth]);

  const wrapped = React.useMemo(
    () =>
      computeSquadWrapped({
        monthKey: selectedMonth,
        swimmers,
        sessions,
        attendance,
        swimLogs,
        memories,
        currentSwimmerId,
      }),
    [selectedMonth, swimmers, sessions, attendance, swimLogs, memories, currentSwimmerId]
  );

  if (!isOpen) return null;

  const totalSlides = 4;

  async function handleShareCard() {
    setIsSharing(true);
    try {
      const result = await shareOrDownloadWrappedCard(wrapped);
      toast.success(
        result === "shared"
          ? "Squad Wrapped card ready to share!"
          : "Squad Wrapped PNG saved — drop it in the WhatsApp group!"
      );
    } catch {
      toast.error("Could not generate Wrapped card.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-aqua/35 bg-gradient-to-br from-[#081320] via-[#0D1F33] to-[#07111C] text-white shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Story Progress Bar + Controls */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-white/10">
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx <= slide ? "bg-aqua" : "bg-white/15 hover:bg-white/30"
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-aqua" />
              <span className="text-xs font-black uppercase tracking-wider text-aqua">
                Squad Wrapped
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-aqua"
              >
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide Stage */}
        <div className="p-5 sm:p-6 min-h-[370px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {slide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 text-center"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-aqua/15 border border-aqua/35 text-aqua text-[11px] font-black font-mono">
                  {wrapped.monthLabel.toUpperCase()}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  Your Squad Showed Up{" "}
                  <span className="text-aqua">{wrapped.overallTurnoutPct}%</span>
                </h2>
                <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                  Across <strong className="text-white">{wrapped.sessionsHeld}</strong> weekend
                  practices with <strong className="text-white">{wrapped.totalCheckins}</strong>{" "}
                  total poolside check-ins.
                </p>

                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-black font-mono text-seafoam">
                      {wrapped.sessionsHeld}
                    </div>
                    <div className="text-[10px] text-white/60 uppercase font-bold mt-0.5">
                      Practices
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {wrapped.totalDistanceMeters >= 1000
                        ? `${(wrapped.totalDistanceMeters / 1000).toFixed(1)}k`
                        : `${wrapped.totalDistanceMeters}m`}
                    </div>
                    <div className="text-[10px] text-white/60 uppercase font-bold mt-0.5">
                      Distance
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-black font-mono text-aqua">
                      {wrapped.photosCount}
                    </div>
                    <div className="text-[10px] text-white/60 uppercase font-bold mt-0.5">
                      Memories 📸
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {slide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Hall of Fame &amp; Banter
                  </div>
                  <h3 className="text-xl font-black">Squad Awards · {wrapped.monthLabel}</h3>
                </div>

                {wrapped.awards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {wrapped.awards.map((aw) => (
                      <div
                        key={aw.id}
                        className={cn(
                          "p-3.5 rounded-2xl border space-y-1",
                          aw.tone === "gold"
                            ? "bg-amber-400/10 border-amber-400/35"
                            : aw.tone === "coral"
                            ? "bg-coral/10 border-coral/35"
                            : aw.tone === "seafoam"
                            ? "bg-seafoam/10 border-seafoam/35"
                            : "bg-aqua/10 border-aqua/35"
                        )}
                      >
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                          {aw.emoji} {aw.title}
                        </div>
                        <div className="text-base font-black text-white truncate">
                          {aw.winnerName}
                        </div>
                        <div className="text-[11px] font-mono text-aqua">{aw.metric}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/60 text-center py-8">
                    No attendance or swim data recorded for {wrapped.monthLabel} yet.
                  </p>
                )}
              </motion.div>
            )}

            {slide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-seafoam">
                    <Waves className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Podium &amp; Personal Spotlight
                  </div>
                  <h3 className="text-xl font-black">Top Performers</h3>
                </div>

                <div className="space-y-2">
                  {wrapped.topLeaderboard.slice(0, 4).map((entry, idx) => (
                    <div
                      key={entry.swimmerId}
                      className={cn(
                        "px-3.5 py-2.5 rounded-2xl border flex items-center justify-between text-xs",
                        entry.swimmerId === currentSwimmerId
                          ? "bg-aqua/15 border-aqua/45"
                          : "bg-white/5 border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2.5 font-bold">
                        <span className="font-mono text-amber-400 font-black w-6">#{idx + 1}</span>
                        <span>{entry.name}</span>
                      </div>
                      <div className="font-mono text-[11px] text-seafoam font-bold">
                        {entry.points} pts &bull; {entry.attended} swims
                      </div>
                    </div>
                  ))}
                </div>

                {wrapped.personalSummary && (
                  <div className="p-3.5 rounded-2xl bg-seafoam/10 border border-seafoam/30 text-xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-seafoam">
                        Your {wrapped.monthLabel}
                      </div>
                      <div className="font-black text-white mt-0.5">
                        Rank #{wrapped.personalSummary.rank} &bull;{" "}
                        {wrapped.personalSummary.attended} swims attended
                      </div>
                    </div>
                    <div className="font-mono font-black text-aqua text-base">
                      {wrapped.personalSummary.points} pts
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {slide === 3 && (
              <motion.div
                key="slide-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-aqua/15 border border-aqua/40 text-aqua flex items-center justify-center mx-auto">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-black">Drop It In The Group Chat!</h3>
                  <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                    Export your <strong className="text-white">{wrapped.monthLabel}</strong> Squad
                    Wrapped card as a crisp 1080&times;1350 recap image with all awards, turnout
                    stats, and leaderboard highlights.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-aqua">
                    Distance Milestone Progress
                  </div>
                  <div className="text-xs font-extrabold">{wrapped.milestone.label}</div>
                  <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, wrapped.milestone.progressPct)}%` }}
                      className="h-full bg-gradient-to-r from-aqua to-seafoam rounded-full"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSharing}
                  onClick={handleShareCard}
                  className="w-full py-3 rounded-2xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-black text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-aqua/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>Share / Download Wrapped Card</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Slide Controls */}
        <div className="px-5 py-3.5 border-t border-white/10 flex items-center justify-between text-xs">
          <button
            type="button"
            disabled={slide === 0}
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 font-bold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="font-mono text-[11px] text-white/60">
            {slide + 1} / {totalSlides}
          </span>

          {slide < totalSlides - 1 ? (
            <button
              type="button"
              onClick={() => setSlide((s) => Math.min(totalSlides - 1, s + 1))}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-aqua text-ocean-950 font-extrabold transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 font-bold"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
