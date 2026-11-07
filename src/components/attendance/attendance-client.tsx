"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  X,
  ShieldAlert,
  HelpCircle,
  Search,
  CheckCheck,
  UserX,
  RotateCcw,
  MessageSquare,
  Lock,
  Unlock,
  AlertTriangle,
  Sparkles,
  Keyboard,
  Printer,
  ChevronDown,
} from "lucide-react";
import {
  AttendanceRecord,
  AttendanceStatus,
  SwimSession,
  AttendanceAuditLog,
} from "@/types/database";
import { getSwimmerSquadRank } from "@/lib/squad-ranks";
import {
  updateAttendanceStatusAction,
  markAllPresentAction,
  markRemainingAbsentAction,
} from "@/actions/attendance-actions";
import { finalizeSessionAction, reopenSessionAction } from "@/actions/session-actions";
import { formatTime, getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface AttendanceClientProps {
  session: SwimSession;
  allSessions: SwimSession[];
  initialAttendance: AttendanceRecord[];
  auditLogs: AttendanceAuditLog[];
}

export function AttendanceClient({
  session,
  allSessions,
  initialAttendance,
  auditLogs: initialLogs,
}: AttendanceClientProps) {
  const router = useRouter();

  // Attendance Records State
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>(initialAttendance);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");

  // Undo Stack
  const [lastAction, setLastAction] = React.useState<{
    swimmerId: string;
    previousStatus: AttendanceStatus;
  } | null>(null);

  // Note Modal State
  const [activeNoteSwimmer, setActiveNoteSwimmer] = React.useState<{
    swimmerId: string;
    swimmerName: string;
    currentNote: string;
  } | null>(null);
  const [noteInput, setNoteInput] = React.useState("");

  // Finalize Warning Modal
  const [showFinalizeWarning, setShowFinalizeWarning] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);

  // Active keyboard focus row index
  const [focusedIndex, setFocusedIndex] = React.useState<number>(0);

  // Keep state synced if initialAttendance changes
  React.useEffect(() => {
    setAttendance(initialAttendance);
  }, [initialAttendance]);

  // Attendance Summary Metrics
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const excusedCount = attendance.filter((a) => a.status === "excused").length;
  const notMarkedCount = attendance.filter((a) => a.status === "not_marked").length;
  const totalCount = attendance.length;

  const attended = presentCount + lateCount;
  const eligible = presentCount + lateCount + absentCount;
  const attendanceRate = eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;
  const progressPercent = totalCount > 0 ? Math.round(((totalCount - notMarkedCount) / totalCount) * 100) : 0;

  // Filtered List
  const filteredRecords = React.useMemo(() => {
    return attendance.filter((record) => {
      const swimmer = record.swimmer;
      if (!swimmer) return true;

      // Status filter
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = swimmer.full_name.toLowerCase().includes(q);
        const matchNick = swimmer.nickname && swimmer.nickname.toLowerCase().includes(q);
        return matchName || matchNick;
      }

      return true;
    });
  }, [attendance, statusFilter, searchQuery]);

  // Optimistic status update handler
  async function handleStatusChange(
    swimmerId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ) {
    const previous = attendance.find((a) => a.swimmer_id === swimmerId);
    if (!previous) return;
    const oldStatus = previous.status;

    // Record for undo
    setLastAction({ swimmerId, previousStatus: oldStatus });

    // Mark pending & optimistic update
    setPendingIds((prev) => new Set(prev).add(swimmerId));
    setAttendance((prev) =>
      prev.map((item) =>
        item.swimmer_id === swimmerId
          ? { ...item, status: newStatus, notes: notes !== undefined ? notes : item.notes }
          : item
      )
    );

    try {
      const res = await updateAttendanceStatusAction(
        session.id,
        swimmerId,
        newStatus,
        notes
      );

      if (!res.success) {
        throw new Error("Update failed");
      }
    } catch {
      // Rollback on failure
      setAttendance((prev) =>
        prev.map((item) =>
          item.swimmer_id === swimmerId
            ? { ...item, status: oldStatus }
            : item
        )
      );
      toast.error("Failed to save attendance change. Rolled back.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(swimmerId);
        return next;
      });
    }
  }

  // Undo action
  async function handleUndo() {
    if (!lastAction) return;
    await handleStatusChange(lastAction.swimmerId, lastAction.previousStatus);
    setLastAction(null);
    toast.info("Reverted last attendance change");
  }

  // Bulk: Mark All Present
  async function handleMarkAllPresent() {
    const count = attendance.filter((a) => a.status !== "present").length;
    if (count === 0) {
      toast.info("All swimmers are already marked present.");
      return;
    }

    setAttendance((prev) =>
      prev.map((item) => ({ ...item, status: "present" }))
    );

    try {
      await markAllPresentAction(session.id);
      toast.success(`Marked all ${totalCount} swimmers as present.`);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.85 } });
    } catch {
      router.refresh();
      toast.error("Failed to bulk update attendance.");
    }
  }

  // Bulk: Mark Remaining Absent
  async function handleMarkRemainingAbsent() {
    if (notMarkedCount === 0) {
      toast.info("No unmarked swimmers remaining.");
      return;
    }

    if (!confirm(`Mark remaining ${notMarkedCount} unmarked swimmer(s) as Absent?`)) {
      return;
    }

    setAttendance((prev) =>
      prev.map((item) =>
        item.status === "not_marked" ? { ...item, status: "absent" } : item
      )
    );

    try {
      await markRemainingAbsentAction(session.id);
      toast.success(`Marked ${notMarkedCount} remaining swimmers as absent.`);
    } catch {
      router.refresh();
      toast.error("Failed to mark remaining swimmers as absent.");
    }
  }

  // Finalize Session
  async function handleFinalizeClick() {
    if (notMarkedCount > 0) {
      setShowFinalizeWarning(true);
      return;
    }
    await executeFinalize();
  }

  async function executeFinalize() {
    setIsFinalizing(true);
    setShowFinalizeWarning(false);
    try {
      await finalizeSessionAction(session.id);
      toast.success("Attendance finalized for this session.");
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
      router.refresh();
    } catch {
      toast.error("Failed to finalize session.");
    } finally {
      setIsFinalizing(false);
    }
  }

  async function handleReopenSession() {
    try {
      await reopenSessionAction(session.id);
      toast.info("Session reopened for attendance corrections.");
      router.refresh();
    } catch {
      toast.error("Failed to reopen session.");
    }
  }

  // Note Modal Save
  async function handleSaveNote() {
    if (!activeNoteSwimmer) return;
    const current = attendance.find((a) => a.swimmer_id === activeNoteSwimmer.swimmerId);
    if (current) {
      await handleStatusChange(
        activeNoteSwimmer.swimmerId,
        current.status,
        noteInput.trim() || undefined
      );
      toast.success("Attendance note saved.");
    }
    setActiveNoteSwimmer(null);
  }

  // Desktop Keyboard Shortcuts (P, A, L, E, U, ArrowUp, ArrowDown)
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Do not trigger shortcuts when typing inside form inputs or textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        activeNoteSwimmer !== null ||
        showFinalizeWarning
      ) {
        return;
      }

      const currentRecord = filteredRecords[focusedIndex];
      if (!currentRecord) return;

      const key = e.key.toLowerCase();

      if (key === "arrowdown" || key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredRecords.length - 1));
      } else if (key === "arrowup" || key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (key === "p") {
        e.preventDefault();
        handleStatusChange(currentRecord.swimmer_id, "present");
      } else if (key === "a") {
        e.preventDefault();
        handleStatusChange(currentRecord.swimmer_id, "absent");
      } else if (key === "l") {
        e.preventDefault();
        handleStatusChange(currentRecord.swimmer_id, "late");
      } else if (key === "e") {
        e.preventDefault();
        handleStatusChange(currentRecord.swimmer_id, "excused");
      } else if (key === "u") {
        e.preventDefault();
        handleStatusChange(currentRecord.swimmer_id, "not_marked");
      } else if (key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, filteredRecords, activeNoteSwimmer, showFinalizeWarning, lastAction]);

  return (
    <div className="space-y-6">
      {/* Session Header Panel */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border",
                  session.is_finalized
                    ? "bg-ocean-900 text-aqua border-aqua/30"
                    : "bg-seafoam/10 text-seafoam border-seafoam/30"
                )}
              >
                {session.is_finalized ? "Finalized Session" : "Live Session Register"}
              </span>

              {/* Session Selector Dropdown */}
              <select
                aria-label="Select Swimming Session"
                value={session.id}
                onChange={(e) => router.push(`/attendance?session=${e.target.value}`)}
                className="text-xs font-semibold bg-secondary/80 text-foreground border border-border rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-aqua"
              >
                {allSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {s.title} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {session.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {session.date} &bull; {formatTime(session.start_time)} – {formatTime(session.end_time)} &bull; {session.location}
            </p>
          </div>

          {/* Quick Session State Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print attendance register sheet"
              className="p-2 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4 text-muted-foreground" />
              <span className="hidden sm:inline">Print Sheet</span>
            </button>

            {lastAction && (
              <button
                type="button"
                onClick={handleUndo}
                aria-label="Undo last attendance marking"
                className="px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-aqua" />
                <span>Undo</span>
              </button>
            )}

            {session.is_finalized ? (
              <button
                type="button"
                onClick={handleReopenSession}
                className="px-3.5 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Unlock className="w-3.5 h-3.5 text-aqua" />
                <span>Reopen Register</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalizeClick}
                disabled={isFinalizing}
                className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Finalize Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Attendance Progress & Breakdown */}
        <div className="pt-4 border-t border-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-foreground">
                Progress: {progressPercent}% marked ({totalCount - notMarkedCount}/{totalCount})
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="font-bold text-aqua">
                Attendance Rate: {attendanceRate}%
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <span className="text-seafoam font-bold">{presentCount} Present</span>
              <span className="text-amber-400 font-bold">{lateCount} Late</span>
              <span className="text-coral font-bold">{absentCount} Absent</span>
              <span className="text-sky-400 font-bold">{excusedCount} Excused</span>
              <span className="text-muted-foreground">{notMarkedCount} Unmarked</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden flex">
            <div
              className="bg-seafoam transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
              title={`${presentCount} Present`}
            />
            <div
              className="bg-amber-400 transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (lateCount / totalCount) * 100 : 0}%` }}
              title={`${lateCount} Late`}
            />
            <div
              className="bg-coral transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (absentCount / totalCount) * 100 : 0}%` }}
              title={`${absentCount} Absent`}
            />
            <div
              className="bg-sky-400 transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (excusedCount / totalCount) * 100 : 0}%` }}
              title={`${excusedCount} Excused`}
            />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Bulk Actions, Keyboard Hint */}
      <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search swimmers..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-secondary/40 text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
          </div>

          <select
            aria-label="Filter Swimmers by Attendance Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-border bg-secondary/40 text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-aqua"
          >
            <option value="all">All Statuses ({attendance.length})</option>
            <option value="not_marked">Unmarked Only ({notMarkedCount})</option>
            <option value="present">Present ({presentCount})</option>
            <option value="late">Late ({lateCount})</option>
            <option value="absent">Absent ({absentCount})</option>
            <option value="excused">Excused ({excusedCount})</option>
          </select>
        </div>

        {/* Bulk Action Buttons & Desktop Keyboard Hint */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3 py-1.5 rounded-xl border border-seafoam/30 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Present</span>
          </button>

          <button
            type="button"
            onClick={handleMarkRemainingAbsent}
            className="px-3 py-1.5 rounded-xl border border-coral/30 bg-coral/10 hover:bg-coral/20 text-coral text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Remaining Absent</span>
          </button>

          <div className="hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground ml-2 font-mono px-2 py-1 rounded bg-secondary/60">
            <Keyboard className="w-3.5 h-3.5 text-aqua mr-1" />
            <span>P: Present &bull; A: Absent &bull; L: Late &bull; E: Excused &bull; U: Reset</span>
          </div>
        </div>
      </div>

      {/* Attendee Register: Touch-friendly cards for mobile / high-speed cards for desktop */}
      <div className="space-y-3">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record, index) => {
            const swimmer = record.swimmer;
            const isPending = pendingIds.has(record.swimmer_id);
            const isFocused = index === focusedIndex;
            const rank = getSwimmerSquadRank(swimmer?.attendance_stats);

            return (
              <div
                key={record.id || record.swimmer_id}
                onClick={() => setFocusedIndex(index)}
                className={cn(
                  "p-4 rounded-2xl border transition-all duration-150 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm",
                  isFocused ? "border-aqua ring-1 ring-aqua/30" : "border-border hover:border-border/80",
                  isPending && "opacity-70 pointer-events-none"
                )}
              >
                {/* Swimmer Profile Info */}
                <div className="flex items-center gap-3.5 min-w-[200px]">
                  <div className="w-11 h-11 rounded-2xl bg-ocean-900 border border-aqua/30 text-aqua flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm">
                    {swimmer ? getInitials(swimmer.full_name) : "??"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {swimmer?.full_name || "Swimmer"}
                      </span>
                      {swimmer?.nickname && (
                        <span className="text-xs text-muted-foreground font-medium">
                          ({swimmer.nickname})
                        </span>
                      )}
                      {/* Funny Squad Rank Pill */}
                      <span
                        title={rank.description}
                        className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-help",
                          rank.colorScheme.pillBg
                        )}
                      >
                        <span>{rank.emoji}</span>
                        <span>{rank.title}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{swimmer?.attendance_stats?.rate || 0}% overall</span>
                      <span>&bull;</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">{rank.pollaTag}</span>
                      {record.notes && (
                        <span className="text-aqua italic truncate max-w-[180px]">
                          &bull; &ldquo;{record.notes}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Big Touch Controls for Attendance Status */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Present Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(record.swimmer_id, "present")}
                    className={cn(
                      "flex-1 sm:flex-initial min-w-[70px] sm:min-w-[80px] h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95",
                      record.status === "present"
                        ? "bg-seafoam text-ocean-950 shadow-md ring-2 ring-seafoam/40 font-extrabold"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-seafoam/10 hover:text-seafoam hover:border-seafoam/30"
                    )}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Present</span>
                  </button>

                  {/* Late Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(record.swimmer_id, "late")}
                    className={cn(
                      "flex-1 sm:flex-initial min-w-[65px] sm:min-w-[75px] h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95",
                      record.status === "late"
                        ? "bg-amber-400 text-ocean-950 shadow-md ring-2 ring-amber-400/40 font-extrabold"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-amber-400/10 hover:text-amber-400 hover:border-amber-400/30"
                    )}
                  >
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                    <span>Late</span>
                  </button>

                  {/* Absent Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(record.swimmer_id, "absent")}
                    className={cn(
                      "flex-1 sm:flex-initial min-w-[70px] sm:min-w-[80px] h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95",
                      record.status === "absent"
                        ? "bg-coral text-ocean-950 shadow-md ring-2 ring-coral/40 font-extrabold"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-coral/10 hover:text-coral hover:border-coral/30"
                    )}
                  >
                    <X className="w-4 h-4 stroke-[3]" />
                    <span>Absent</span>
                  </button>

                  {/* Excused Button */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(record.swimmer_id, "excused")}
                    className={cn(
                      "flex-1 sm:flex-initial min-w-[70px] sm:min-w-[80px] h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95",
                      record.status === "excused"
                        ? "bg-sky-400 text-ocean-950 shadow-md ring-2 ring-sky-400/40 font-extrabold"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-sky-400/10 hover:text-sky-400 hover:border-sky-400/30"
                    )}
                  >
                    <ShieldAlert className="w-4 h-4 stroke-[2]" />
                    <span>Excused</span>
                  </button>

                  {/* Reset to Not Marked Button */}
                  {record.status !== "not_marked" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(record.swimmer_id, "not_marked")}
                      title="Reset to Not Marked (U)"
                      className="p-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  {/* Add / Edit Note Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNoteSwimmer({
                        swimmerId: record.swimmer_id,
                        swimmerName: swimmer?.full_name || "Swimmer",
                        currentNote: record.notes || "",
                      });
                      setNoteInput(record.notes || "");
                    }}
                    title="Add attendance note"
                    className={cn(
                      "p-2.5 rounded-xl border transition-colors",
                      record.notes
                        ? "border-aqua/40 bg-aqua/10 text-aqua"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-card">
            <p className="text-sm font-semibold text-muted-foreground">
              No swimmers match the current filter or search criteria.
            </p>
          </div>
        )}
      </div>

      {/* Note Edit Modal */}
      {activeNoteSwimmer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground">
                Attendance Note: {activeNoteSwimmer.swimmerName}
              </h3>
              <button
                type="button"
                onClick={() => setActiveNoteSwimmer(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              autoFocus
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Arrived late due to school exam; completed 1500m set; feeling unwell..."
              rows={3}
              className="w-full p-3 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveNoteSwimmer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold transition-all shadow-sm"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning on Finalizing with Unmarked Swimmers */}
      {showFinalizeWarning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-coral/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-coral">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-foreground">
                Unmarked Swimmers Remaining
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              There are still <strong>{notMarkedCount} unmarked swimmers</strong> on the register.
              Finalizing will preserve their unmarked status without silently converting them to absent.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeWarning(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Review Register
              </button>
              <button
                type="button"
                onClick={executeFinalize}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-aqua text-ocean-950 text-xs font-bold"
              >
                Finalize Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
