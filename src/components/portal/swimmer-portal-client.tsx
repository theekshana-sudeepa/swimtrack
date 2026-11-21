"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Waves,
  Clock,
  MapPin,
  Flame,
  CheckCircle2,
  Calendar,
  Sparkles,
  MessageSquare,
  Send,
  ShieldCheck,
  ShieldAlert,
  Share2,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Users,
  Trophy,
  Award,
  LogOut,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Target,
  Crown,
  Camera,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Swimmer,
  SwimSession,
  SquadMessage,
  SquadMemory,
  SquadExpense,
  PoolVenue,
} from "@/types/database";
import {
  getSwimmerSquadRank,
  calculateSwimmerPoints,
  rankSquadLeaderboard,
  computeSquadCrowns,
  SQUAD_POINTS_RULES,
  buildPointsLedger,
  type CheckinImpactSummary,
} from "@/lib/squad-ranks";
import { formatTime, cn } from "@/lib/utils";
import {
  submitExcuseAction,
  postChalkboardMessageAction,
  deleteChalkboardMessageAction,
  logoutSwimmerAction,
} from "@/actions/portal-actions";
import { PoolRadarCheckin } from "./pool-radar-checkin";
import { CheckInCelebrationModal } from "./checkin-celebration-modal";
import { SquadMemoriesViewer } from "@/components/memories/squad-memories-viewer";
import { ReactionBar } from "@/components/social/reaction-bar";
import { SquadSplitsPanel } from "@/components/splits/squad-splits-panel";
import { AttendanceRecord } from "@/types/database";
import { toast } from "sonner";
import { SwimTrackLogo } from "@/components/brand/logo";

interface HistoryRecord {
  id: string;
  status: "not_marked" | "present" | "absent" | "late" | "excused";
  notes?: string | null;
  checkin_method?: "coach_manual" | "geofence_self" | "bulk" | null;
  marked_at?: string;
  session?: SwimSession | null;
}

interface SwimmerPortalClientProps {
  swimmer: Swimmer;
  token: string;
  nextSession: SwimSession | null;
  savedVenues?: PoolVenue[];
  history: HistoryRecord[];
  initialMessages: SquadMessage[];
  initialMemories?: SquadMemory[];
  initialExpenses?: SquadExpense[];
  attendeesByDate?: Record<string, string[]>;
  sessions?: SwimSession[];
  squadFriends?: Swimmer[];
  squadStats?: {
    overallRate: number;
    completedSessions: number;
    activeSwimmers: number;
  };
}

export function SwimmerPortalClient({
  swimmer,
  token,
  nextSession,
  savedVenues = [],
  history,
  initialMessages,
  initialMemories = [],
  initialExpenses = [],
  attendeesByDate = {},
  sessions = [],
  squadFriends = [],
  squadStats,
}: SwimmerPortalClientProps) {
  const router = useRouter();
  // Friends Leaderboard ranked strictly by Aqua Points (with true shared ties & crowns)
  const rankedFriends = React.useMemo(
    () => rankSquadLeaderboard(squadFriends || []),
    [squadFriends]
  );
  const squadCrowns = React.useMemo(
    () => computeSquadCrowns(rankedFriends),
    [rankedFriends]
  );
  const myRanking = React.useMemo(
    () => rankedFriends.find((r) => r.swimmer.id === swimmer.id) || null,
    [rankedFriends, swimmer.id]
  );
  const myStats = myRanking?.swimmer.attendance_stats ?? swimmer.attendance_stats;
  const myPoints = React.useMemo(
    () => myRanking?.points ?? calculateSwimmerPoints(myStats),
    [myRanking, myStats]
  );
  const [showPointsGuide, setShowPointsGuide] = React.useState(false);
  const [expandedFriendId, setExpandedFriendId] = React.useState<string | null>(null);
  const [celebrationImpact, setCelebrationImpact] = React.useState<CheckinImpactSummary | null>(null);
  const [highlightMyRank, setHighlightMyRank] = React.useState(false);
  const [rankShiftBanner, setRankShiftBanner] = React.useState<{
    direction: "up" | "down";
    headline: string;
    detail: string;
  } | null>(null);
  const pointsLedger = React.useMemo(() => buildPointsLedger(history), [history]);

  // Compute Next-Target Chase Meter or Solo/Joint #1 lead
  const chaseStatus = React.useMemo(() => {
    if (!myRanking || rankedFriends.length < 2) return null;
    const labelOf = (s: Swimmer) => s.nickname?.trim() || s.full_name.split(" ")[0];
    if (myRanking.rank === 1 && !myRanking.isTied) {
      const second = rankedFriends.find((r) => r.swimmer.id !== swimmer.id);
      return {
        mode: "solo_first" as const,
        leadPts: second ? Math.max(0, myPoints.points - second.points.points) : 0,
        otherName: second ? labelOf(second.swimmer) : "the squad",
      };
    }
    if (myRanking.rank === 1 && myRanking.isTied) {
      const coLeaders = rankedFriends
        .filter((r) => r.rank === 1 && r.swimmer.id !== swimmer.id)
        .map((r) => labelOf(r.swimmer));
      return {
        mode: "tied_first" as const,
        coLeaders: coLeaders.slice(0, 2).join(" & "),
      };
    }
    const ahead = [...rankedFriends]
      .reverse()
      .find((r) => r.rank < myRanking.rank && r.points.points > myPoints.points);
    if (!ahead) return null;
    const gap = Math.max(1, ahead.points.points - myPoints.points);
    const pct = ahead.points.points > 0
      ? Math.min(96, Math.max(8, Math.round((myPoints.points / ahead.points.points) * 100)))
      : 0;
    return {
      mode: "chasing" as const,
      targetName: labelOf(ahead.swimmer),
      targetRank: ahead.rank,
      gap,
      pct,
    };
  }, [myRanking, rankedFriends, swimmer.id, myPoints.points]);

  // Helper to persist latest rank snapshot to localStorage (used to detect overtakes/drops between visits)
  const persistRankSnapshot = React.useCallback(
    (snap: { points: number; rank: number; isTied: boolean }) => {
      try {
        localStorage.setItem(
          `swimtrack_rank_snap_v1_${swimmer.id}`,
          JSON.stringify({ ...snap, savedAt: Date.now() })
        );
      } catch {
        // localStorage unavailable (private browsing)
      }
    },
    [swimmer.id]
  );

  // Detect rank/point changes since last visit (e.g. a friend overtook you, or coach marked attendance/polla)
  const checkedSnapshotRef = React.useRef(false);
  React.useEffect(() => {
    if (checkedSnapshotRef.current || !myRanking) return;
    checkedSnapshotRef.current = true;

    const currentSnap = {
      points: myPoints.points,
      rank: myRanking.rank,
      isTied: myRanking.isTied,
    };

    try {
      const raw = localStorage.getItem(`swimtrack_rank_snap_v1_${swimmer.id}`);
      if (!raw) {
        persistRankSnapshot(currentSnap);
        return;
      }
      const prev = JSON.parse(raw) as { points?: number; rank?: number; isTied?: boolean };
      if (typeof prev.points !== "number" || typeof prev.rank !== "number") {
        persistRankSnapshot(currentSnap);
        return;
      }

      const pointsDiff = currentSnap.points - prev.points;
      const fmt = (r: number, t?: boolean) => (t ? `=${r}` : `#${r}`);
      const brokeTieUp = prev.rank === 1 && prev.isTied && currentSnap.rank === 1 && !currentSnap.isTied;
      const lostSoloFirst = prev.rank === 1 && !prev.isTied && (currentSnap.rank > 1 || currentSnap.isTied);
      const climbed = currentSnap.rank < prev.rank || brokeTieUp;
      const dropped = currentSnap.rank > prev.rank || lostSoloFirst;

      if (dropped || pointsDiff < 0) {
        const ahead = [...rankedFriends]
          .reverse()
          .find((r) => r.rank <= currentSnap.rank && r.swimmer.id !== swimmer.id);
        const aheadName = ahead
          ? ahead.swimmer.nickname?.trim() || ahead.swimmer.full_name.split(" ")[0]
          : null;
        setRankShiftBanner({
          direction: "down",
          headline: dropped
            ? `Heads up! Your rank shifted ${fmt(prev.rank, prev.isTied)} → ${fmt(currentSnap.rank, currentSnap.isTied)}`
            : `Points dropped by ${Math.abs(pointsDiff)} pts (${prev.points} → ${currentSnap.points} pts)`,
          detail:
            pointsDiff < 0
              ? `You lost ${Math.abs(pointsDiff)} pts since last visit${aheadName ? ` — ${aheadName} is ahead now` : ""}. Hit the next swim to bounce back!`
              : aheadName
              ? `${aheadName} just checked in and moved ahead of you! Show up early next session to reclaim your spot.`
              : "A squad mate climbed past you on Aqua Points — time to splash back!",
        });
      } else if (climbed || pointsDiff > 0) {
        setRankShiftBanner({
          direction: "up",
          headline: climbed
            ? `Rank Up since last visit! ${fmt(prev.rank, prev.isTied)} → ${fmt(currentSnap.rank, currentSnap.isTied)}`
            : `+${pointsDiff} Aqua Points added since last visit!`,
          detail: `Your balance grew from ${prev.points} → ${currentSnap.points} pts${
            climbed ? " and you moved up the squad leaderboard!" : "."
          }`,
        });
      }

      persistRankSnapshot(currentSnap);
    } catch {
      persistRankSnapshot(currentSnap);
    }
  }, [myRanking, myPoints.points, rankedFriends, swimmer.id, persistRankSnapshot]);

  // Squad Persona Rank Calculation
  const squadRank = myRanking?.squadRank ?? getSwimmerSquadRank(myStats);

  // Attendance & Excuse State for Next Practice
  const initialRecord = nextSession
    ? history.find((h) => h.session?.id === nextSession.id)
    : null;

  const [currentAttendance, setCurrentAttendance] = React.useState<AttendanceRecord | null>(
    initialRecord
      ? ({
          id: initialRecord.id,
          session_id: nextSession?.id || "",
          swimmer_id: swimmer.id,
          status: initialRecord.status,
          notes: initialRecord.notes,
          marked_at: initialRecord.marked_at,
        } as AttendanceRecord)
      : null
  );

  React.useEffect(() => {
    const record = nextSession
      ? history.find((h) => h.session?.id === nextSession.id)
      : null;
    if (record) {
      setCurrentAttendance({
        id: record.id,
        session_id: nextSession?.id || "",
        swimmer_id: swimmer.id,
        status: record.status,
        notes: record.notes,
        marked_at: record.marked_at,
      } as AttendanceRecord);
    } else {
      setCurrentAttendance(null);
    }
  }, [history, nextSession, swimmer.id]);

  const isCheckedIn =
    currentAttendance?.status === "present" ||
    currentAttendance?.status === "late";
  const isExcused = currentAttendance?.status === "excused";
  // Only an excuse the swimmer created themselves can be cleared by them
  const isSelfExcuse = isExcused && Boolean(currentAttendance?.notes?.startsWith("RSVP:"));

  const [isSubmittingExcuse, setIsSubmittingExcuse] = React.useState(false);
  const [showDeclineModal, setShowDeclineModal] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");

  // Report or clear an excused absence. This can never mark the swimmer present -
  // attendance is granted only by the on-location Pool Radar check-in below.
  async function handleExcuse(action: "declare" | "clear", reason?: string) {
    if (!nextSession || isSubmittingExcuse) return;
    setIsSubmittingExcuse(true);

    try {
      const res = await submitExcuseAction(token, nextSession.id, action, reason);
      if (res.success && res.record) {
        setCurrentAttendance(res.record as AttendanceRecord);
        if (action === "declare") {
          toast.info("Excused absence recorded for this practice.");
          setShowDeclineModal(false);
          setDeclineReason("");
        } else {
          toast.info("Excuse cleared. Use the Pool Radar when you arrive.");
        }
        router.refresh();
      } else if ((res as { needsLogin?: boolean }).needsLogin) {
        toast.error("Please sign in with your PIN again.");
        router.push("/portal");
      } else {
        toast.error((res as { error?: string })?.error || "Failed to update excuse.");
      }
    } catch {
      toast.error("Failed to update excuse. Please try again.");
    } finally {
      setIsSubmittingExcuse(false);
    }
  }

  // Squad Memories state (shared with Attendance History 📸 badges)
  const [memories, setMemories] = React.useState<SquadMemory[]>(initialMemories);
  const [memoryDateJump, setMemoryDateJump] = React.useState<{
    date: string;
    nonce: number;
  } | null>(null);
  React.useEffect(() => {
    setMemories(initialMemories);
  }, [initialMemories]);
  const memoriesByDate = React.useMemo(() => {
    const map = new Map<string, SquadMemory>();
    for (const m of memories) {
      map.set(m.memory_date, m);
    }
    return map;
  }, [memories]);

  // Chalkboard Messages State
  const [messages, setMessages] = React.useState<SquadMessage[]>(initialMessages);
  const [messageInput, setMessageInput] = React.useState("");
  const [isPostingMsg, setIsPostingMsg] = React.useState(false);

  // Handle Posting to Chalkboard
  async function handlePostMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim()) return;

    setIsPostingMsg(true);
    const content = messageInput.trim();

    try {
      const res = await postChalkboardMessageAction(token, content);
      if (res.success && res.message) {
        setMessages((prev) => [res.message!, ...prev]);
        setMessageInput("");
        toast.success("Posted to Squad Chalkboard!");
      } else if ((res as { needsLogin?: boolean }).needsLogin) {
        toast.error("Please sign in with your PIN again.");
        router.push("/portal");
      } else {
        toast.error(res.error || "Failed to post message.");
      }
    } catch {
      toast.error("Failed to post message. Please try again.");
    } finally {
      setIsPostingMsg(false);
    }
  }

  const displayName = swimmer.nickname
    ? `${swimmer.full_name} ("${swimmer.nickname}")`
    : swimmer.full_name;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 selection:bg-aqua selection:text-ocean-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <SwimTrackLogo size="sm" />
        </Link>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aqua/10 text-aqua font-bold border border-aqua/30 text-[11px]">
            <Waves className="w-3.5 h-3.5 animate-pulse" />
            <span>Squad Pass</span>
          </span>

          <button
            type="button"
            onClick={async () => {
              try {
                await logoutSwimmerAction();
                localStorage.removeItem("swimtrack_swimmer_token");
              } catch {
                // ignore
              }
              toast.info("Swimmer Pass signed out.");
              router.push("/portal");
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-all active:scale-95"
            title="Switch swimmer profile"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Switch Profile</span>
          </button>
        </div>
      </header>

      {/* Main Portal Content */}
      <main className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-5 sm:pt-6 space-y-6">
        {/* Since Last Visit Rank Shift Alert (Shows rank overtakes OR rank drops!) */}
        {rankShiftBanner && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn(
              "p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-md",
              rankShiftBanner.direction === "up"
                ? "bg-seafoam/10 border-seafoam/35 text-foreground"
                : "bg-coral/10 border-coral/35 text-foreground"
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  rankShiftBanner.direction === "up"
                    ? "bg-seafoam/20 text-seafoam"
                    : "bg-coral/20 text-coral"
                )}
              >
                {rankShiftBanner.direction === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-foreground">
                  {rankShiftBanner.headline}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {rankShiftBanner.detail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRankShiftBanner(null)}
              aria-label="Dismiss rank movement alert"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Personal Persona & Credentials Hero */}
        <div className="p-6 sm:p-8 rounded-3xl border border-border bg-gradient-to-br from-card via-card to-ocean-950/40 shadow-xl relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-ocean-900 border-2 border-aqua/40 text-aqua flex items-center justify-center font-extrabold text-xl shadow-inner shrink-0">
                {swimmer.nickname ? swimmer.nickname.slice(0, 2).toUpperCase() : swimmer.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  {displayName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Member since {swimmer.join_date} &bull; Personal Squad Pass
                </p>
              </div>
            </div>

            {/* Persona Badge */}
            <div className={cn("px-4 py-2 rounded-2xl border text-center", squadRank.colorScheme.bg, squadRank.colorScheme.border)}>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Squad Persona
              </div>
              <div className={cn("text-base font-black flex items-center justify-center gap-1.5", squadRank.colorScheme.text)}>
                <span>{squadRank.emoji}</span>
                <span>{squadRank.title}</span>
              </div>
            </div>
          </div>

          {/* Description & Polla Tag */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/80 text-xs flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-muted-foreground leading-relaxed italic">
                &ldquo;{squadRank.description}&rdquo;
              </p>
              <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 border self-start sm:self-auto", squadRank.colorScheme.pillBg)}>
                {squadRank.pollaTag}
              </span>
            </div>
            <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
              <strong className="text-foreground">How your title was decided:</strong> {squadRank.decisionReason}
            </div>
          </div>

          {/* Core Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
            <div
              className="p-3.5 rounded-2xl bg-aqua/10 border border-aqua/30"
              title={myPoints.breakdownText}
            >
              <div className="text-2xl font-black text-aqua font-mono">
                {myPoints.points}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Aqua Points {myRanking ? `(${myRanking.isTied ? `=${myRanking.rank}` : `#${myRanking.rank}`})` : ""}
              </div>
              <div className="text-[10px] text-aqua/90 mt-0.5 font-medium">
                {myPoints.attendedCount}/{myPoints.sessionsCount} swims · {myStats?.rate || 0}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 fill-amber-400" />
                <span>{myStats?.currentStreak || 0}</span>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Active Streak
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-seafoam">
                {(myStats?.present || 0) + (myStats?.late || 0)}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Practices Attended
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-coral">
                {myStats?.absent || 0}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Missed (Polla)
              </div>
              {(myStats?.excused || 0) > 0 && (
                <div className="text-[10px] text-sky-400 mt-0.5 font-medium">
                  +{myStats?.excused} excused
                </div>
              )}
            </div>
          </div>

          {/* Next-Target Chase Meter / Throne Lead Strip */}
          {chaseStatus && (
            <div className="p-3.5 rounded-2xl bg-secondary/35 border border-border/80 space-y-2">
              {chaseStatus.mode === "solo_first" && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Solo #1 Pool Boss</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    +{chaseStatus.leadPts} pts ahead of <strong className="text-foreground">{chaseStatus.otherName}</strong>
                  </span>
                </div>
              )}

              {chaseStatus.mode === "tied_first" && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Tied #1 with {chaseStatus.coLeaders}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Check in poolside first next swim to claim Solo #1!
                  </span>
                </div>
              )}

              {chaseStatus.mode === "chasing" && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-aqua shrink-0" />
                      <span>
                        <strong className="text-aqua font-mono">{chaseStatus.gap} pts</strong> to overtake{" "}
                        <strong>{chaseStatus.targetName}</strong> for #{chaseStatus.targetRank}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {chaseStatus.pct}% there
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${chaseStatus.pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-aqua to-seafoam"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Next Session & Practice Info */}
        <div className="p-6 rounded-3xl border border-aqua/30 bg-card shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-aqua" />
              <h2 className="font-extrabold text-base text-foreground">
                Next Swimming Practice
              </h2>
            </div>
            {isCheckedIn && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-seafoam/20 text-seafoam border border-seafoam/30 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Deck Checked-In</span>
              </span>
            )}
            {!isCheckedIn && isExcused && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Excused / Away</span>
              </span>
            )}
          </div>

          {nextSession ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {nextSession.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1 text-foreground font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-aqua" />
                    <span>{nextSession.date}</span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-aqua" />
                    <span>
                      {formatTime(nextSession.start_time)} – {formatTime(nextSession.end_time)}
                    </span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-coral" />
                    <span>{nextSession.location}</span>
                  </span>
                </div>
                {nextSession.notes && (
                  <p className="text-xs text-ocean-300 mt-2 bg-secondary/30 p-2.5 rounded-xl border border-border">
                    💡 {nextSession.notes}
                  </p>
                )}
              </div>

              {/* Status / Excuse Controls */}
              {isCheckedIn ? (
                <div className="pt-1 p-4 rounded-2xl bg-seafoam/10 border border-seafoam/30 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-seafoam/20 text-seafoam flex items-center justify-center shrink-0 border border-seafoam/40">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      You are checked in for this session!
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {currentAttendance?.status === "late"
                        ? "Late arrival recorded"
                        : "Marked present on time"}{" "}
                      &bull; Verified poolside on squad deck.
                    </p>
                  </div>
                </div>
              ) : isExcused ? (
                <div className="pt-1 p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/40">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Excused Absence Recorded
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {currentAttendance?.notes?.replace(/^RSVP:\s*Excused\s*-\s*/i, "") ||
                          "You reported an excused absence for this practice."}
                      </p>
                    </div>
                  </div>
                  {isSelfExcuse && (
                    <button
                      type="button"
                      onClick={() => handleExcuse("clear")}
                      disabled={isSubmittingExcuse}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all shrink-0 active:scale-95 disabled:opacity-50"
                    >
                      Clear Excuse
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-aqua/5 border border-aqua/20 text-xs text-muted-foreground">
                    <MapPin className="w-4 h-4 text-aqua shrink-0 mt-0.5" />
                    <span>
                      Attendance is marked <strong className="text-foreground">only on location</strong>.
                      Use the <strong className="text-foreground">Pool Geofence Radar</strong> below when you
                      are poolside - there is no way to check in from home.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={isSubmittingExcuse}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors disabled:opacity-50"
                  >
                    Can&apos;t make it? Report an excused absence
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">No upcoming practices scheduled right now.</p>
              <p>Check back soon or watch your inbox for our 8:00 AM session reminder.</p>
            </div>
          )}
        </div>

        {/* Autonomous Geofence Radar Check-in */}
        {nextSession && (
          <PoolRadarCheckin
            session={nextSession}
            savedVenues={savedVenues}
            token={token}
            existingAttendance={currentAttendance}
            onCheckedIn={(record, impact) => {
              setCurrentAttendance(record);
              if (impact) {
                setCelebrationImpact(impact);
                setRankShiftBanner(null);
                persistRankSnapshot({
                  points: impact.newPoints,
                  rank: impact.newRank,
                  isTied: impact.newIsTied,
                });
              }
              router.refresh();
            }}
          />
        )}

        {/* End-of-Day Squad Memories Photo Vault (1–3 photos per date) */}
        <SquadMemoriesViewer
          initialMemories={memories}
          sessions={sessions}
          swimmerToken={token}
          currentSwimmerId={swimmer.id}
          currentSwimmerName={swimmer.nickname?.trim() || swimmer.full_name}
          openDateRequest={memoryDateJump}
          onMemoriesChange={setMemories}
        />

        {/* Squad Chalkboard / Chat Wall */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-aqua" />
              <h2 className="font-extrabold text-base text-foreground">
                Squad Chalkboard & Banter 💬
              </h2>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Live Squad Wall
            </span>
          </div>

          {/* New Message Input */}
          <form onSubmit={handlePostMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Leave a message or banter for the squad..."
              maxLength={280}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
            <button
              type="submit"
              disabled={isPostingMsg || !messageInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Post</span>
            </button>
          </form>

          {/* Messages Feed */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "p-3 rounded-2xl border text-xs space-y-1",
                    msg.is_admin
                      ? "bg-ocean-900/60 border-aqua/30 text-ocean-100"
                      : "bg-secondary/30 border-border/70 text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("font-bold text-[11px]", msg.is_admin ? "text-aqua" : "text-foreground")}>
                      {msg.author_name} {msg.is_admin && "👑"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.author_swimmer_id === swimmer.id && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await deleteChalkboardMessageAction(token, msg.id);
                            if (res.success) {
                              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                              toast.info("Message deleted.");
                            } else {
                              toast.error(res.error || "Could not delete message.");
                            }
                          }}
                          title="Delete your post"
                          className="text-muted-foreground hover:text-coral transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">{msg.content}</p>
                  <div className="pt-1">
                    <ReactionBar
                      targetType="message"
                      targetId={msg.id}
                      initialReactions={msg.reactions || []}
                      currentReactorKey={`swimmer:${swimmer.id}`}
                      currentReactorName={swimmer.nickname?.trim() || swimmer.full_name}
                      swimmerToken={token}
                      compact
                      onReactionsUpdated={(updated) => {
                        setMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, reactions: updated } : m))
                        );
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                No chalkboard messages yet. Be the first to post!
              </p>
            )}
          </div>
        </div>

        {/* After-Swim Bill & Pool Ticket Splits (Squad Kitty) */}
        <SquadSplitsPanel
          initialExpenses={initialExpenses}
          swimmers={squadFriends}
          sessions={sessions}
          attendeesByDate={attendeesByDate}
          currentSwimmer={swimmer}
          swimmerToken={token}
        />

        {/* Squad Friends & Power Rankings Leaderboard */}
        {rankedFriends.length > 0 && (
          <div
            id="squad-rankings"
            className="scroll-mt-20 p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="font-extrabold text-base text-foreground">
                  Squad Power Rankings 🏆
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPointsGuide((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-aqua/30 bg-aqua/10 text-aqua hover:bg-aqua/20 text-[10px] font-bold transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showPointsGuide ? "Hide Points" : "How Points Work"}</span>
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {rankedFriends.length} Swimmers
                </span>
              </div>
            </div>

            {/* Collapsible Points Formula Guide */}
            {showPointsGuide && (
              <div className="p-3.5 rounded-2xl bg-secondary/40 border border-aqua/25 space-y-2 text-[11px] animate-in fade-in duration-150">
                <div className="font-bold text-foreground">
                  Ranked by Aqua Points — no 1/1 rookie or excused-leave loopholes. Exact ties share the same rank (=1).
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-seafoam/15 text-seafoam border border-seafoam/30">
                    On-Time +{SQUAD_POINTS_RULES.present}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    Late +{SQUAD_POINTS_RULES.lateBase} (-{SQUAD_POINTS_RULES.lateMinutePenalty}/min)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-400/15 text-sky-300 border border-sky-400/30">
                    Excused +{SQUAD_POINTS_RULES.excused}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-coral/15 text-coral border border-coral/30">
                    Polla {SQUAD_POINTS_RULES.absent}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30">
                    Streak +{SQUAD_POINTS_RULES.streakBonusPerSession}/wk
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-aqua/15 text-aqua border border-aqua/30">
                    GPS Check-in +{SQUAD_POINTS_RULES.gpsBonus}
                  </span>
                </div>
              </div>
            )}

            {/* Squad Overview Stats Pills */}
            {squadStats && (
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/70">
                  <div className="text-lg sm:text-xl font-black text-aqua">
                    {squadStats.overallRate}%
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                    Squad Attendance
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/70">
                  <div className="text-lg sm:text-xl font-black text-seafoam">
                    {squadStats.completedSessions}
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                    Practices Held
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/70">
                  <div className="text-lg sm:text-xl font-black text-foreground">
                    {squadStats.activeSwimmers}
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                    Active Friends
                  </div>
                </div>
              </div>
            )}

            {/* Exclusive Squad Crowns & Banter Strip */}
            {squadCrowns.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {squadCrowns.map((crown) => (
                  <div
                    key={crown.id}
                    className={cn(
                      "px-3 py-2.5 rounded-2xl border flex items-center gap-2.5",
                      crown.tone === "gold"
                        ? "bg-amber-400/10 border-amber-400/30"
                        : crown.tone === "aqua"
                        ? "bg-aqua/10 border-aqua/30"
                        : crown.tone === "coral"
                        ? "bg-coral/10 border-coral/30"
                        : "bg-seafoam/10 border-seafoam/30"
                    )}
                  >
                    <span className="text-lg shrink-0">{crown.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase font-extrabold tracking-wider text-muted-foreground">
                        {crown.title}
                      </div>
                      <div className="text-xs font-extrabold text-foreground truncate">
                        {crown.winnerNames.join(" & ")}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {crown.metricLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Leaderboard Cards Ranked by Aqua Points */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between px-1">
                <span>Rank &amp; Swimmer</span>
                <span>Points &bull; Form &bull; Streak</span>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {rankedFriends.map((entry) => {
                  const { swimmer: friend, rank: pos, isTied, points, squadRank: friendRank, roastLine, crowns } = entry;
                  const isCurrent = friend.id === swimmer.id;
                  const isExpanded = expandedFriendId === friend.id;
                  const friendName = friend.nickname
                    ? `${friend.full_name} ("${friend.nickname}")`
                    : friend.full_name;
                  const recentForm = friend.attendance_stats?.recentForm || [];
                  const fStats = friend.attendance_stats;
                  const friendLatePenalty = Math.max(
                    0,
                    (fStats?.late || 0) * SQUAD_POINTS_RULES.lateBase - points.latePts
                  );

                  return (
                    <motion.div
                      key={friend.id}
                      layout
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      className={cn(
                        "rounded-2xl border text-xs transition-all overflow-hidden",
                        isCurrent
                          ? highlightMyRank
                            ? "bg-seafoam/15 border-seafoam ring-2 ring-seafoam/50 shadow-lg"
                            : "bg-aqua/10 border-aqua/40 ring-1 ring-aqua/30 shadow-sm"
                          : "bg-secondary/25 border-border/60 hover:border-aqua/30"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFriendId((prev) => (prev === friend.id ? null : friend.id))
                        }
                        className="w-full text-left p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* True Competition Position Badge (=1 for shared ties!) */}
                          <div
                            className={cn(
                              "min-w-[28px] h-7 px-1.5 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5",
                              pos === 1
                                ? "bg-amber-400 text-ocean-950 shadow-xs"
                                : pos === 2
                                ? "bg-slate-300 text-ocean-950"
                                : pos === 3
                                ? "bg-amber-600/80 text-white"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {isTied ? `=${pos}` : pos}
                          </div>

                          {/* Name, Title, Roast & Form Dots */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "font-bold text-xs truncate",
                                  isCurrent ? "text-aqua" : "text-foreground"
                                )}
                              >
                                {friendName}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-aqua/20 text-aqua border border-aqua/30">
                                  You
                                </span>
                              )}
                              {crowns.map((c) => (
                                <span
                                  key={c}
                                  className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>

                            <div className="text-[11px] font-semibold text-foreground/90 flex items-center gap-1 mt-0.5">
                              <span>{friendRank.emoji}</span>
                              <span>{friendRank.title}</span>
                            </div>

                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                              {roastLine}
                            </p>
                          </div>
                        </div>

                        {/* Right Column: Aqua Points, Swims, Form Dots & Streak */}
                        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-baseline gap-1">
                              <span className="font-mono font-black text-sm text-aqua">
                                {points.points}
                              </span>
                              <span className="text-[10px] font-bold text-muted-foreground">pts</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-aqua" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                            <span>
                              {points.attendedCount}/{points.sessionsCount}
                            </span>
                            <span className="flex items-center gap-0.5 font-bold text-amber-400">
                              <Flame className="w-3 h-3 fill-amber-400" />
                              <span>{fStats?.currentStreak || 0}</span>
                            </span>
                          </div>

                          {recentForm.length > 0 && (
                            <div
                              className="flex items-center gap-1 pt-0.5"
                              title="Last 5 practices (oldest → newest)"
                            >
                              {recentForm.map((st, idx) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    st === "present"
                                      ? "bg-seafoam"
                                      : st === "late"
                                      ? "bg-amber-400"
                                      : st === "excused"
                                      ? "bg-sky-400"
                                      : "bg-coral"
                                  )}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Tap-to-Inspect Points Receipt (Gains vs Losses) */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-border/60 bg-background/40 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <span>Points Receipt (Gains &amp; Losses)</span>
                            <span className="font-mono text-aqua">Net: {points.points} pts</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                            {(fStats?.present || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-seafoam/15 text-seafoam border border-seafoam/30">
                                ✓ {fStats?.present}x On-Time +{points.presentPts}
                              </span>
                            )}
                            {(fStats?.late || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
                                ⏰ {fStats?.late}x Late +{points.latePts}
                                {friendLatePenalty > 0 ? ` (−${friendLatePenalty}m)` : ""}
                              </span>
                            )}
                            {(fStats?.excused || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-sky-400/15 text-sky-300 border border-sky-400/30">
                                🩹 {fStats?.excused}x Excused +{points.excusedPts}
                              </span>
                            )}
                            {points.streakBonus > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30">
                                🔥 {fStats?.currentStreak}x Streak +{points.streakBonus}
                              </span>
                            )}
                            {points.gpsBonus > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-aqua/15 text-aqua border border-aqua/30">
                                📡 {fStats?.gpsCheckins}x GPS +{points.gpsBonus}
                              </span>
                            )}
                            {(fStats?.absent || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-coral/15 text-coral border border-coral/30">
                                🌴 {fStats?.absent}x Polla {points.absentPts}
                              </span>
                            )}
                            {points.sessionsCount === 0 && (
                              <span className="text-muted-foreground font-normal">
                                No completed practices scored yet.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* My Points & Attendance History Ledger */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="font-extrabold text-base text-foreground">
                My Points &amp; Attendance History
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Every point gained and lost across each practice session
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-aqua/10 text-aqua border border-aqua/30">
              {pointsLedger.summary.netPoints} pts total
            </span>
          </div>

          {/* Gains vs Losses Visual Summary Strip */}
          {pointsLedger.summary.scoredSessionsCount > 0 && (
            <div className="p-4 rounded-2xl bg-secondary/35 border border-border/80 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-seafoam/10 border border-seafoam/25">
                  <div className="text-[10px] font-bold text-seafoam uppercase flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Gained</span>
                  </div>
                  <div className="font-mono font-black text-sm sm:text-base text-seafoam mt-0.5">
                    +{pointsLedger.summary.totalGained}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-coral/10 border border-coral/25">
                  <div className="text-[10px] font-bold text-coral uppercase flex items-center justify-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    <span>Lost</span>
                  </div>
                  <div className="font-mono font-black text-sm sm:text-base text-coral mt-0.5">
                    {pointsLedger.summary.totalLost > 0 ? `−${pointsLedger.summary.totalLost}` : "0"}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-aqua/10 border border-aqua/25">
                  <div className="text-[10px] font-bold text-aqua uppercase">
                    Net Balance
                  </div>
                  <div className="font-mono font-black text-sm sm:text-base text-aqua mt-0.5">
                    {pointsLedger.summary.netPoints} pts
                  </div>
                </div>
              </div>

              {/* Category Breakdown Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                {pointsLedger.summary.presentPts > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-seafoam/15 text-seafoam border border-seafoam/30">
                    ✓ On-Time +{pointsLedger.summary.presentPts}
                  </span>
                )}
                {pointsLedger.summary.latePts > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    ⏰ Late +{pointsLedger.summary.latePts}
                  </span>
                )}
                {pointsLedger.summary.excusedPts > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-sky-400/15 text-sky-300 border border-sky-400/30">
                    🩹 Excused +{pointsLedger.summary.excusedPts}
                  </span>
                )}
                {pointsLedger.summary.streakBonus > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30">
                    🔥 Active Streak +{pointsLedger.summary.streakBonus}
                  </span>
                )}
                {pointsLedger.summary.gpsBonus > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-aqua/15 text-aqua border border-aqua/30">
                    📡 GPS Bonus +{pointsLedger.summary.gpsBonus}
                  </span>
                )}
                {pointsLedger.summary.absentPts < 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-coral/15 text-coral border border-coral/30">
                    🌴 Polla {pointsLedger.summary.absentPts}
                  </span>
                )}
                {pointsLedger.summary.latePenaltyPts > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-coral/15 text-coral border border-coral/30">
                    ⏱️ Late Delay −{pointsLedger.summary.latePenaltyPts}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Session-by-Session Points Timeline */}
          <div className="divide-y divide-border/60">
            {pointsLedger.entries.length > 0 ? (
              pointsLedger.entries.map((item) => {
                const { record, isScored, isLive, delta, runningBalance, chips } = item;
                const session = record.session;
                return (
                  <div
                    key={record.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground">
                          {session?.title || "Swimming Practice"}
                        </p>
                        {isLive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-seafoam/20 text-seafoam border border-seafoam/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-seafoam animate-pulse" />
                            <span>Live</span>
                          </span>
                        )}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider",
                            record.status === "present"
                              ? "bg-seafoam/15 text-seafoam border-seafoam/30"
                              : record.status === "late"
                              ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                              : record.status === "absent"
                              ? "bg-coral/15 text-coral border-coral/30"
                              : record.status === "excused"
                              ? "bg-sky-400/15 text-sky-300 border-sky-400/30"
                              : "bg-secondary text-muted-foreground border-border"
                          )}
                        >
                          {record.status === "not_marked" ? "Pending" : record.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {session?.date} &bull; {session?.location}
                        </span>
                        {session?.date && memoriesByDate.get(session.date) && (
                          <button
                            type="button"
                            onClick={() =>
                              setMemoryDateJump({ date: session.date, nonce: Date.now() })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aqua/15 hover:bg-aqua/25 border border-aqua/35 text-aqua text-[10px] font-bold transition-colors"
                            title="View squad photos from this day"
                          >
                            <Camera className="w-2.5 h-2.5" />
                            <span>{memoriesByDate.get(session.date)!.photos.length}</span>
                          </button>
                        )}
                      </div>

                      {/* Per-Session Gain/Loss Micro-Chips */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {chips.map((chip, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "px-1.5 py-0.5 rounded-md text-[10px] font-bold border",
                              chip.tone === "gain"
                                ? "bg-seafoam/10 text-seafoam border-seafoam/25"
                                : chip.tone === "bonus"
                                ? "bg-aqua/10 text-aqua border-aqua/25"
                                : chip.tone === "loss"
                                ? "bg-coral/10 text-coral border-coral/25"
                                : "bg-secondary/60 text-muted-foreground border-border"
                            )}
                          >
                            {chip.label}
                            {chip.delta !== 0
                              ? ` ${chip.delta > 0 ? `+${chip.delta}` : `−${Math.abs(chip.delta)}`}`
                              : ""}
                          </span>
                        ))}
                      </div>

                      {record.notes && (
                        <p className="text-[10px] text-ocean-300 italic">
                          {record.notes}
                        </p>
                      )}
                    </div>

                    {/* Right Column: Session Points Delta & Running Balance */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      {isScored ? (
                        <>
                          <span
                            className={cn(
                              "font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border",
                              delta > 0
                                ? "bg-seafoam/15 text-seafoam border-seafoam/30"
                                : delta < 0
                                ? "bg-coral/15 text-coral border-coral/30"
                                : "bg-secondary text-muted-foreground border-border"
                            )}
                          >
                            {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"} pts
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Bal: {runningBalance} pts
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-secondary text-muted-foreground border border-border">
                          Not scored yet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No past practices recorded yet. Your journey starts at the next swim!
              </p>
            )}
          </div>
        </div>

        {/* Tip: Add to Phone Home Screen */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/80 flex items-center gap-3 text-xs text-muted-foreground">
          <Sparkles className="w-5 h-5 text-aqua shrink-0" />
          <p>
            <strong>Pro Tip:</strong> Tap your browser&apos;s share menu and select <em>&ldquo;Add to Home Screen&rdquo;</em> to keep your Swimmer Pass like a native phone app!
          </p>
        </div>
      </main>

      {/* Animated Poolside Check-In Celebration Modal */}
      <CheckInCelebrationModal
        impact={celebrationImpact}
        swimmerDisplayName={swimmer.nickname?.trim() || swimmer.full_name.split(" ")[0]}
        onClose={() => setCelebrationImpact(null)}
        onViewRankings={() => {
          setCelebrationImpact(null);
          setHighlightMyRank(true);
          window.setTimeout(() => {
            document
              .getElementById("squad-rankings")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 120);
          window.setTimeout(() => setHighlightMyRank(false), 3000);
        }}
      />

      {/* Decline / Excused Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">
                Excuse Next Session 🩹
              </h3>
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Let the coach know why you can&apos;t attend so you are marked as <strong>Excused</strong> instead of Absent (protecting your Polla rank!).
            </p>

            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Traveling out of Colombo, exam week, recovering from cold..."
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingExcuse}
                onClick={() => handleExcuse("declare", declineReason)}
                className="px-4 py-2 rounded-xl bg-aqua text-ocean-950 text-xs font-bold shadow-sm hover:bg-aqua-hover transition-colors disabled:opacity-50"
              >
                {isSubmittingExcuse ? "Submitting..." : "Confirm Excuse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

