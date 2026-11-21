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
} from "lucide-react";
import { Swimmer, SwimSession, SquadMessage, PoolVenue } from "@/types/database";
import {
  getSwimmerSquadRank,
  calculateSwimmerPoints,
  rankSquadLeaderboard,
  computeSquadCrowns,
  SQUAD_POINTS_RULES,
} from "@/lib/squad-ranks";
import { formatTime, cn } from "@/lib/utils";
import {
  submitExcuseAction,
  postChalkboardMessageAction,
  logoutSwimmerAction,
} from "@/actions/portal-actions";
import { PoolRadarCheckin } from "./pool-radar-checkin";
import { AttendanceRecord } from "@/types/database";
import { toast } from "sonner";
import { SwimTrackLogo } from "@/components/brand/logo";

interface HistoryRecord {
  id: string;
  status: "not_marked" | "present" | "absent" | "late" | "excused";
  notes?: string | null;
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
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
            onCheckedIn={(record) => {
              setCurrentAttendance(record);
              router.refresh();
            }}
          />
        )}

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
                  <div className="flex items-center justify-between">
                    <span className={cn("font-bold text-[11px]", msg.is_admin ? "text-aqua" : "text-foreground")}>
                      {msg.author_name} {msg.is_admin && "👑"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">{msg.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                No chalkboard messages yet. Be the first to post!
              </p>
            )}
          </div>
        </div>

        {/* Squad Friends & Power Rankings Leaderboard */}
        {rankedFriends.length > 0 && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
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

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {rankedFriends.map((entry) => {
                  const { swimmer: friend, rank: pos, isTied, points, squadRank: friendRank, roastLine, crowns } = entry;
                  const isCurrent = friend.id === swimmer.id;
                  const friendName = friend.nickname
                    ? `${friend.full_name} ("${friend.nickname}")`
                    : friend.full_name;
                  const recentForm = friend.attendance_stats?.recentForm || [];

                  return (
                    <div
                      key={friend.id}
                      title={points.breakdownText}
                      className={cn(
                        "p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 transition-all",
                        isCurrent
                          ? "bg-aqua/10 border-aqua/40 ring-1 ring-aqua/30 shadow-sm"
                          : "bg-secondary/25 border-border/60"
                      )}
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
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-black text-sm text-aqua">
                            {points.points}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">pts</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                          <span>
                            {points.attendedCount}/{points.sessionsCount}
                          </span>
                          <span className="flex items-center gap-0.5 font-bold text-amber-400">
                            <Flame className="w-3 h-3 fill-amber-400" />
                            <span>{friend.attendance_stats?.currentStreak || 0}</span>
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* My Past Attendance Timeline */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="font-extrabold text-base text-foreground">
              My Attendance History
            </h2>
            <span className="text-xs text-muted-foreground">
              {history.length} sessions logged
            </span>
          </div>

          <div className="divide-y divide-border/60">
            {history.length > 0 ? (
              history.map((record) => {
                const session = record.session;
                return (
                  <div key={record.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground">
                        {session?.title || "Swimming Practice"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {session?.date} &bull; {session?.location}
                      </p>
                      {record.notes && (
                        <p className="text-[10px] text-ocean-300 italic mt-0.5">
                          {record.notes}
                        </p>
                      )}
                    </div>

                    <div>
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
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

