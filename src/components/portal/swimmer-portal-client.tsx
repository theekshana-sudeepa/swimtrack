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
import { Swimmer, SwimSession, SquadMessage } from "@/types/database";
import { getSwimmerSquadRank } from "@/lib/squad-ranks";
import { formatTime, cn } from "@/lib/utils";
import {
  submitRsvpAction,
  postChalkboardMessageAction,
  logoutSwimmerAction,
} from "@/actions/portal-actions";
import { PoolRadarCheckin } from "./pool-radar-checkin";
import { AttendanceRecord } from "@/types/database";
import confetti from "canvas-confetti";
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
  history,
  initialMessages,
  squadFriends = [],
  squadStats,
}: SwimmerPortalClientProps) {
  const router = useRouter();
  // Friends Leaderboard & Analytics (Ranked by attendance rate & active streak)
  const sortedFriends = React.useMemo(() => {
    if (!squadFriends || squadFriends.length === 0) return [];
    return [...squadFriends].sort((a, b) => {
      const rateA = a.attendance_stats?.rate ?? 0;
      const rateB = b.attendance_stats?.rate ?? 0;
      if (rateB !== rateA) return rateB - rateA;
      const streakA = a.attendance_stats?.currentStreak ?? 0;
      const streakB = b.attendance_stats?.currentStreak ?? 0;
      return streakB - streakA;
    });
  }, [squadFriends]);

  // Squad Persona Rank Calculation
  const squadRank = getSwimmerSquadRank(swimmer.attendance_stats);

  // RSVP State
  const existingRsvp = nextSession
    ? history.find((h) => h.session?.id === nextSession.id)
    : null;

  const initialRsvpState = existingRsvp
    ? existingRsvp.notes?.includes("Confirmed Attending")
      ? "attending"
      : existingRsvp.status === "excused"
      ? "declined"
      : null
    : null;

  const [currentRsvp, setCurrentRsvp] = React.useState<"attending" | "declined" | null>(
    initialRsvpState
  );
  const [isSubmittingRsvp, setIsSubmittingRsvp] = React.useState(false);
  const [showDeclineModal, setShowDeclineModal] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");

  // Chalkboard Messages State
  const [messages, setMessages] = React.useState<SquadMessage[]>(initialMessages);
  const [messageInput, setMessageInput] = React.useState("");
  const [isPostingMsg, setIsPostingMsg] = React.useState(false);

  // Handle RSVP
  async function handleRsvp(status: "attending" | "declined", reason?: string) {
    if (!nextSession) return;
    setIsSubmittingRsvp(true);

    try {
      const res = await submitRsvpAction(token, nextSession.id, status, reason);
      if (res.success) {
        setCurrentRsvp(status);
        if (status === "attending") {
          confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
          toast.success("RSVP Confirmed! See you at the pool 🏊");
        } else {
          toast.info("RSVP updated: Marked as excused.");
        }
        setShowDeclineModal(false);
      } else {
        toast.error(res.error || "Failed to update RSVP.");
      }
    } catch {
      toast.error("Failed to submit RSVP. Please try again.");
    } finally {
      setIsSubmittingRsvp(false);
    }
  }

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
            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-aqua">
                {swimmer.attendance_stats?.rate || 0}%
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Attendance Rate
              </div>
              {swimmer.attendance_stats?.total !== undefined && swimmer.attendance_stats.total > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                  {(swimmer.attendance_stats.present || 0) + (swimmer.attendance_stats.late || 0)} of {swimmer.attendance_stats.total} practices
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 fill-amber-400" />
                <span>{swimmer.attendance_stats?.currentStreak || 0}</span>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Active Streak
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-seafoam">
                {(swimmer.attendance_stats?.present || 0) + (swimmer.attendance_stats?.late || 0)}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Practices Attended
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/70">
              <div className="text-2xl font-black text-coral">
                {swimmer.attendance_stats?.absent || 0}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Missed (Polla)
              </div>
              {(swimmer.attendance_stats?.excused || 0) > 0 && (
                <div className="text-[10px] text-sky-400 mt-0.5 font-medium">
                  +{swimmer.attendance_stats?.excused} excused
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Session & 1-Tap RSVP */}
        <div className="p-6 rounded-3xl border border-aqua/30 bg-card shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-aqua" />
              <h2 className="font-extrabold text-base text-foreground">
                Next Swimming Practice
              </h2>
            </div>
            {currentRsvp === "attending" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-seafoam/20 text-seafoam border border-seafoam/30 text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Confirmed Attending</span>
              </span>
            )}
            {currentRsvp === "declined" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
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

              {/* RSVP Action Controls */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleRsvp("attending")}
                  disabled={isSubmittingRsvp}
                  className={cn(
                    "w-full sm:w-auto flex-1 py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95",
                    currentRsvp === "attending"
                      ? "bg-seafoam text-ocean-950 ring-2 ring-seafoam/50"
                      : "bg-aqua hover:bg-aqua-hover text-ocean-950"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{currentRsvp === "attending" ? "I'm In! (Confirmed 🏊)" : "I'm Coming Bro! 🏊"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeclineModal(true)}
                  disabled={isSubmittingRsvp}
                  className={cn(
                    "w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-bold border border-border text-foreground hover:bg-secondary transition-all",
                    currentRsvp === "declined" ? "bg-secondary text-amber-300 border-amber-400/40" : ""
                  )}
                >
                  <span>Can&apos;t Make It (Excused 🩹)</span>
                </button>
              </div>
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
            token={token}
            existingAttendance={
              existingRsvp
                ? ({
                    id: existingRsvp.id,
                    session_id: nextSession.id,
                    swimmer_id: swimmer.id,
                    status: existingRsvp.status,
                    notes: existingRsvp.notes,
                    marked_at: existingRsvp.marked_at,
                  } as AttendanceRecord)
                : null
            }
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

        {/* Squad Friends & Analytics Leaderboard */}
        {sortedFriends.length > 0 && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-aqua" />
                <h2 className="font-extrabold text-base text-foreground">
                  Squad Friends &amp; Analytics 📊
                </h2>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {sortedFriends.length} Squad Members
              </span>
            </div>

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

            {/* Leaderboard Table / Card List */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between px-1">
                <span>Rank &amp; Swimmer</span>
                <span>Streak &bull; Attendance</span>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {sortedFriends.map((friend, index) => {
                  const isCurrent = friend.id === swimmer.id;
                  const friendRank = getSwimmerSquadRank(friend.attendance_stats);
                  const friendName = friend.nickname
                    ? `${friend.full_name} ("${friend.nickname}")`
                    : friend.full_name;

                  return (
                    <div
                      key={friend.id}
                      className={cn(
                        "p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 transition-all",
                        isCurrent
                          ? "bg-aqua/10 border-aqua/40 ring-1 ring-aqua/30 shadow-sm"
                          : "bg-secondary/25 border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Position badge */}
                        <div
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0",
                            index === 0
                              ? "bg-amber-400 text-ocean-950 font-black"
                              : index === 1
                              ? "bg-slate-300 text-ocean-950"
                              : index === 2
                              ? "bg-amber-600/80 text-white"
                              : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {index + 1}
                        </div>

                        {/* Name & persona */}
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
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <span>{friendRank.emoji}</span>
                            <span>{friendRank.title}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats: Streak & Rate */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                          <Flame className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{friend.attendance_stats?.currentStreak || 0}</span>
                        </div>
                        <div className="min-w-[42px] text-right font-mono font-bold text-xs text-foreground">
                          {friend.attendance_stats?.rate || 0}%
                        </div>
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
                onClick={() => handleRsvp("declined", declineReason)}
                className="px-4 py-2 rounded-xl bg-aqua text-ocean-950 text-xs font-bold shadow-sm"
              >
                Confirm Excuse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

