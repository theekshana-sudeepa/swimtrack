"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import {
  X,
  Trophy,
  Flame,
  Sparkles,
  Copy,
  Check,
  TrendingUp,
  ArrowRight,
  Crown,
  Target,
  MapPin,
} from "lucide-react";
import type { CheckinImpactSummary } from "@/lib/squad-ranks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CheckInCelebrationModalProps {
  impact: CheckinImpactSummary | null;
  swimmerDisplayName: string;
  onClose: () => void;
  onViewRankings: () => void;
}

export function CheckInCelebrationModal({
  impact,
  swimmerDisplayName,
  onClose,
  onViewRankings,
}: CheckInCelebrationModalProps) {
  const [displayPoints, setDisplayPoints] = React.useState(0);
  const [showAfterBoard, setShowAfterBoard] = React.useState(false);
  const [copiedFlex, setCopiedFlex] = React.useState(false);

  // Trigger odometer animation, board slide transition, and celebratory confetti burst
  React.useEffect(() => {
    if (!impact) return;

    setDisplayPoints(impact.previousPoints);
    setShowAfterBoard(false);
    setCopiedFlex(false);

    // Extra gold confetti burst on rank overtake, title evolution, or first-on-deck!
    const isBigMoment =
      impact.overtakenNames.length > 0 ||
      impact.titleEvolved ||
      impact.isFirstOnDeck ||
      (impact.newRank === 1 && !impact.newIsTied);

    if (isBigMoment) {
      const burstTimer = window.setTimeout(() => {
        confetti({
          particleCount: 70,
          spread: 75,
          origin: { y: 0.55 },
          colors: ["#22C7D8", "#5BE6CD", "#FBBF24", "#FFFFFF"],
        });
      }, 650);
      // Cleanup registered below
      return () => window.clearTimeout(burstTimer);
    }
  }, [impact]);

  // Smooth cubic-out odometer counter from previousPoints -> newPoints
  React.useEffect(() => {
    if (!impact) return;
    const from = impact.previousPoints;
    const to = impact.newPoints;
    const durationMs = 1100;
    const startDelayMs = 220;
    let rafId = 0;
    let startTime: number | null = null;

    const timeoutId = window.setTimeout(() => {
      const tick = (now: number) => {
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        // Ease-out cubic for snappy slot-machine settle
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayPoints(Math.round(from + (to - from) * eased));
        if (progress < 1) {
          rafId = window.requestAnimationFrame(tick);
        }
      };
      rafId = window.requestAnimationFrame(tick);
    }, startDelayMs);

    // Trigger animated leaderboard slide right as points settle
    const boardTimer = window.setTimeout(() => {
      setShowAfterBoard(true);
    }, 820);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(boardTimer);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [impact]);

  // Escape key close
  React.useEffect(() => {
    if (!impact) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [impact, onClose]);

  if (!impact) return null;

  const formatRankLabel = (rank: number, isTied: boolean) =>
    isTied ? `=${rank}` : `#${rank}`;

  const brokeTieToSoloFirst =
    impact.previousRank === 1 &&
    impact.previousIsTied &&
    impact.newRank === 1 &&
    !impact.newIsTied;

  const climbedRank = impact.newRank < impact.previousRank || brokeTieToSoloFirst;
  const activeBoard = showAfterBoard ? impact.afterBoard : impact.beforeBoard;

  // Dynamic headline & funny subcopy
  let movementTitle = `Locked In at ${formatRankLabel(impact.newRank, impact.newIsTied)}`;
  let movementSubtitle = impact.nextTarget
    ? `Only ${impact.nextTarget.pointsGap} pts away from overtaking ${impact.nextTarget.name} for #${impact.nextTarget.targetRank}!`
    : "Points added live to your squad ledger!";

  if (climbedRank && impact.overtakenNames.length > 0) {
    const namesStr = impact.overtakenNames.slice(0, 2).join(" & ");
    movementTitle = brokeTieToSoloFirst
      ? `🚀 Solo #1! Broke the Tie!`
      : `🚀 RANK UP! ${formatRankLabel(impact.previousRank, impact.previousIsTied)} → ${formatRankLabel(impact.newRank, impact.newIsTied)}`;
    movementSubtitle = `You just overtook ${namesStr}! Enjoy the view while they're stuck in traffic.`;
  } else if (impact.newRank === 1 && !impact.newIsTied) {
    movementTitle = "👑 Throne Defended — Solo #1!";
    movementSubtitle = impact.leadOverSecond
      ? `${impact.leadOverSecond.pointsAhead} pts clear of ${impact.leadOverSecond.name}. Unstoppable.`
      : "Still the Pool Boss on deck!";
  } else if (impact.newRank === 1 && impact.newIsTied) {
    movementTitle = "👑 Joint #1 — Tied for Pool Boss!";
    movementSubtitle = "Neck and neck at the top of the squad!";
  }

  function handleCopyWhatsAppFlex() {
    if (!impact) return;
    const overtakeLine =
      impact.overtakenNames.length > 0
        ? `🚀 Overtaken ${impact.overtakenNames.slice(0, 2).join(" & ")} for ${
            impact.newRank === 1 && !impact.newIsTied
              ? "Solo #1"
              : formatRankLabel(impact.newRank, impact.newIsTied)
          }!`
        : impact.newRank === 1
        ? `👑 Holding ${impact.newIsTied ? "Joint #1" : "Solo #1"} on the squad board!`
        : `📈 Now ${formatRankLabel(impact.newRank, impact.newIsTied)} on the squad board!`;

    const firstBadge = impact.isFirstOnDeck ? " 🥇 First on deck!" : "";
    const text = `🏊‍♂️ ${swimmerDisplayName} just checked in poolside (${impact.distanceMeters}m from pool)!${firstBadge}\n⚡ +${impact.pointsDelta} Aqua Points (${impact.previousPoints} → ${impact.newPoints} pts · 🔥 ${impact.newStreak}x streak)\n${overtakeLine}\nWho's still in bed? 🌴`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedFlex(true);
        toast.success("WhatsApp flex copied! Paste it in the squad group 🔥");
        window.setTimeout(() => setCopiedFlex(false), 2500);
      });
    } else {
      toast.error("Clipboard not available on this browser.");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="checkin-celebration-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 40, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 30, scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="w-full max-w-md bg-card border-t sm:border border-aqua/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden relative"
        >
          {/* Ambient glow */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-aqua/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-seafoam/15 blur-3xl pointer-events-none" />

          {/* Sticky Header */}
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/80 flex items-center justify-between gap-2 relative z-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-seafoam/20 border border-seafoam/40 text-seafoam flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-foreground truncate">
                  {impact.status === "late" ? "Checked In (Late Splash) ⏰" : "Poolside Check-In Verified! 🏊‍♂️"}
                </h3>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-aqua shrink-0" />
                  <span className="truncate">
                    {impact.distanceMeters}m from pool &bull; {impact.sessionTitle}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close check-in celebration"
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Celebration Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 relative z-10">
            {/* First-on-Deck Badge */}
            {impact.isFirstOnDeck && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 360, damping: 22 }}
                className="mx-auto w-fit px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-black tracking-wide flex items-center gap-1.5 shadow-sm"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>🥇 FIRST ON POOL DECK TODAY!</span>
              </motion.div>
            )}

            {/* Animated Points Odometer */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-aqua/15 via-card to-seafoam/10 border border-aqua/30 text-center space-y-2">
              <div className="text-[10px] uppercase font-extrabold tracking-widest text-muted-foreground">
                Live Aqua Points
              </div>

              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-foreground tabular-nums">
                  {displayPoints}
                </span>
                <span className="text-sm font-bold text-muted-foreground self-end pb-1">pts</span>

                <motion.span
                  initial={{ y: 12, scale: 0.7, opacity: 0 }}
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
                  className="px-2.5 py-1 rounded-full bg-seafoam text-ocean-950 font-mono font-black text-xs shadow-md"
                >
                  +{impact.pointsDelta} pts
                </motion.span>
              </div>

              {/* Staggered Breakdown Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                {impact.chips.map((chip, idx) => (
                  <motion.span
                    key={`${chip.label}-${idx}`}
                    initial={{ y: 10, scale: 0.85, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.25 + idx * 0.14,
                      type: "spring",
                      stiffness: 380,
                      damping: 22,
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-extrabold border",
                      chip.tone === "gain"
                        ? "bg-seafoam/15 text-seafoam border-seafoam/35"
                        : chip.tone === "bonus"
                        ? "bg-aqua/15 text-aqua border-aqua/35"
                        : chip.tone === "loss"
                        ? "bg-coral/15 text-coral border-coral/35"
                        : "bg-secondary text-muted-foreground border-border"
                    )}
                  >
                    {chip.label}{" "}
                    {chip.delta > 0 ? `+${chip.delta}` : `−${Math.abs(chip.delta)}`}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Title Evolution Banner (if unlocked!) */}
            {impact.titleEvolved && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.75, type: "spring", stiffness: 320, damping: 24 }}
                className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/40 text-center space-y-1"
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-300 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Squad Title Evolved!</span>
                </div>
                <div className="text-xs font-extrabold text-foreground flex items-center justify-center gap-2 flex-wrap">
                  <span className="opacity-70 line-through">
                    {impact.previousEmoji} {impact.previousTitle}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300">
                    {impact.newEmoji} {impact.newTitle}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Live Animated Rank Movement & Mini-Leaderboard */}
            <div className="p-3.5 rounded-2xl bg-secondary/35 border border-border/80 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                    {climbedRank ? (
                      <TrendingUp className="w-3.5 h-3.5 text-seafoam shrink-0" />
                    ) : (
                      <Target className="w-3.5 h-3.5 text-aqua shrink-0" />
                    )}
                    <span className="truncate">{movementTitle}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {movementSubtitle}
                  </p>
                </div>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0",
                    showAfterBoard
                      ? "bg-seafoam/15 text-seafoam border-seafoam/35"
                      : "bg-secondary text-muted-foreground border-border"
                  )}
                >
                  {showAfterBoard ? "LIVE NOW" : "BEFORE"}
                </span>
              </div>

              {/* Animated FLIP Mini-Board */}
              {activeBoard.length > 0 && (
                <div className="space-y-1.5">
                  {activeBoard.map((row) => (
                    <motion.div
                      key={row.id}
                      layout
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      className={cn(
                        "px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs",
                        row.isMe
                          ? "bg-aqua/15 border-aqua/50 ring-1 ring-aqua/30 shadow-sm"
                          : "bg-card/80 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "min-w-[24px] h-6 px-1 rounded-md flex items-center justify-center font-black text-[10px] shrink-0",
                            row.rank === 1
                              ? "bg-amber-400 text-ocean-950"
                              : row.rank === 2
                              ? "bg-slate-300 text-ocean-950"
                              : row.rank === 3
                              ? "bg-amber-600/80 text-white"
                              : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {row.isTied ? `=${row.rank}` : row.rank}
                        </span>
                        <span className="text-xs shrink-0">{row.emoji}</span>
                        <span
                          className={cn(
                            "font-bold truncate",
                            row.isMe ? "text-aqua" : "text-foreground"
                          )}
                        >
                          {row.displayName}
                        </span>
                        {row.isMe && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-aqua/20 text-aqua border border-aqua/30 shrink-0">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                          <Flame className="w-3 h-3 fill-amber-400" />
                          {row.streak}
                        </span>
                        <span
                          className={cn(
                            "font-black text-xs tabular-nums",
                            row.isMe ? "text-seafoam" : "text-foreground"
                          )}
                        >
                          {row.points} pts
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions (Responsive mobile-first) */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-border/80 bg-card relative z-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsAppFlex}
              className="sm:flex-1 px-3.5 py-2.5 rounded-xl border border-seafoam/40 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              {copiedFlex ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied Flex!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy WhatsApp Flex</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onViewRankings}
              className="sm:flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 active:scale-95 transition-all"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>See Full Rankings</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
