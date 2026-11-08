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
  Share2,
  Copy,
  PartyPopper,
  UserPlus,
  Plus,
  RefreshCw,
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
  addSwimmerToSessionAction,
  syncAllActiveSwimmersToSessionAction,
} from "@/actions/attendance-actions";
import { finalizeSessionAction, reopenSessionAction } from "@/actions/session-actions";
import { formatTime, getInitials, cn } from "@/lib/utils";
import {
  calculateMinutesLate,
  calculateArrivalTime,
  getCurrentColomboTime,
  formatLateNote,
  parseLateInfo,
  minutesToTime12,
  minutesToTime24,
  parseTimeToMinutes,
} from "@/lib/attendance-calculator";
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

  // Late Arrival Modal State
  const [activeLateRecord, setActiveLateRecord] = React.useState<{
    swimmerId: string;
    swimmerName: string;
    nickname?: string | null;
    currentNotes?: string | null;
  } | null>(null);
  const [lateArrivalTime, setLateArrivalTime] = React.useState("15:15");
  const [lateMinutes, setLateMinutes] = React.useState(15);
  const [lateReason, setLateReason] = React.useState("");

  function openLateModal(
    swimmerId: string,
    swimmerName: string,
    nickname?: string | null,
    existingNotes?: string | null
  ) {
    const parsed = parseLateInfo(existingNotes);
    if (parsed && parsed.minutesLate > 0) {
      setLateMinutes(parsed.minutesLate);
      if (parsed.arrivalTime) {
        setLateArrivalTime(minutesToTime24(parseTimeToMinutes(parsed.arrivalTime)));
      } else {
        const computed = calculateArrivalTime(session.start_time, parsed.minutesLate);
        setLateArrivalTime(computed.time24);
      }
      setLateReason(parsed.reason || "");
    } else {
      const colombo = getCurrentColomboTime();
      const minsDiff = calculateMinutesLate(session.start_time, colombo.time24);
      if (minsDiff > 0 && minsDiff <= 180) {
        setLateMinutes(minsDiff);
        setLateArrivalTime(colombo.time24);
      } else {
        setLateMinutes(15);
        const computed = calculateArrivalTime(session.start_time, 15);
        setLateArrivalTime(computed.time24);
      }
      setLateReason(parsed?.reason || "");
    }

    setActiveLateRecord({
      swimmerId,
      swimmerName,
      nickname,
      currentNotes: existingNotes,
    });
  }

  function handleSelectPreset(mins: number) {
    setLateMinutes(mins);
    const computed = calculateArrivalTime(session.start_time, mins);
    setLateArrivalTime(computed.time24);
  }

  function handleArrivedNow() {
    const colombo = getCurrentColomboTime();
    const mins = Math.max(1, calculateMinutesLate(session.start_time, colombo.time24));
    setLateMinutes(mins);
    setLateArrivalTime(colombo.time24);
  }

  function handleArrivalTimeChange(time24: string) {
    setLateArrivalTime(time24);
    const mins = calculateMinutesLate(session.start_time, time24);
    setLateMinutes(Math.max(1, mins));
  }

  function handleLateMinutesChange(mins: number) {
    const safeMins = Math.max(1, Math.min(360, mins));
    setLateMinutes(safeMins);
    const computed = calculateArrivalTime(session.start_time, safeMins);
    setLateArrivalTime(computed.time24);
  }

  async function handleConfirmLateArrival() {
    if (!activeLateRecord) return;
    const timeMinutes = parseTimeToMinutes(lateArrivalTime);
    const arr12 = minutesToTime12(timeMinutes);
    const note = formatLateNote(arr12, lateMinutes, lateReason);
    await handleStatusChange(activeLateRecord.swimmerId, "late", note);
    toast.success(
      `${activeLateRecord.swimmerName} marked Late (${lateMinutes}m late • Arrived ${arr12})`
    );
    setActiveLateRecord(null);
  }

  // Add Swimmer Modal State
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addFullName, setAddFullName] = React.useState("");
  const [addNickname, setAddNickname] = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [addPhone, setAddPhone] = React.useState("");
  const [addStatus, setAddStatus] = React.useState<AttendanceStatus>("present");
  const [addNotes, setAddNotes] = React.useState("");
  const [isAddingSwimmer, setIsAddingSwimmer] = React.useState(false);
  const [isSyncingSquad, setIsSyncingSquad] = React.useState(false);

  // Finalize Warning & Recap Modals
  const [showFinalizeWarning, setShowFinalizeWarning] = React.useState(false);
  const [showRecapModal, setShowRecapModal] = React.useState(false);
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

  // Add Swimmer One-by-One Directly to Session
  async function handleAddSwimmer(e: React.FormEvent) {
    e.preventDefault();
    if (!addFullName.trim() || addFullName.trim().length < 2) {
      toast.error("Please enter a valid swimmer name (at least 2 characters).");
      return;
    }

    setIsAddingSwimmer(true);
    try {
      const res = await addSwimmerToSessionAction(session.id, {
        full_name: addFullName.trim(),
        nickname: addNickname.trim() || undefined,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        status: addStatus,
        notes: addNotes.trim() || undefined,
      });

      if (res.success && res.record && res.swimmer) {
        const newRecord: AttendanceRecord = {
          ...res.record,
          swimmer: res.swimmer,
        };
        setAttendance((prev) => {
          const filtered = prev.filter((r) => r.swimmer_id !== res.swimmer.id);
          return [newRecord, ...filtered];
        });
        toast.success(`${res.swimmer.full_name} added and marked ${addStatus.toUpperCase()}!`);
        if (addStatus === "present") {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
        }
        setShowAddModal(false);
        setAddFullName("");
        setAddNickname("");
        setAddEmail("");
        setAddPhone("");
        setAddNotes("");
        setAddStatus("present");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to add swimmer.");
      }
    } catch {
      toast.error("Error adding swimmer to session.");
    } finally {
      setIsAddingSwimmer(false);
    }
  }

  // Enroll All Active Squad Members
  async function handleSyncAllSquad() {
    setIsSyncingSquad(true);
    try {
      const res = await syncAllActiveSwimmersToSessionAction(session.id);
      if (res.success) {
        toast.success(`Enrolled ${res.count} squad members into this session!`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to sync squad.");
      }
    } catch {
      toast.error("Error syncing squad swimmers.");
    } finally {
      setIsSyncingSquad(false);
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
      setShowRecapModal(true);
      router.refresh();
    } catch {
      toast.error("Failed to finalize session.");
    } finally {
      setIsFinalizing(false);
    }
  }

  function handleCopyWhatsAppRecap() {
    const presentList = attendance.filter((a) => a.status === "present");
    const lateList = attendance.filter((a) => a.status === "late");
    const absentList = attendance.filter((a) => a.status === "absent");
    const excusedList = attendance.filter((a) => a.status === "excused");

    const lines = [
      `🏊‍♂️ *SwimTrack Squad Recap — ${session.title}*`,
      `📅 ${session.date} • ${formatTime(session.start_time)} – ${formatTime(session.end_time)}`,
      `📍 ${session.location}`,
      ``,
      `⚡ *Attendance Rate: ${attendanceRate}%*`,
      `📊 ${presentCount} Present • ${lateCount} Late • ${absentCount} Absent • ${excusedCount} Excused`,
      ``,
    ];

    if (presentList.length > 0) {
      lines.push(`✅ *Chlorine Warriors (On-Time):*`);
      presentList.forEach((r) => lines.push(`• ${r.swimmer?.full_name || "Swimmer"}`));
      lines.push(``);
    }

    if (lateList.length > 0) {
      lines.push(`⏰ *Late Arrival Squad:*`);
      lateList.forEach((r) => {
        const info = parseLateInfo(r.notes);
        let detail = "";
        if (info && info.minutesLate > 0) {
          detail = ` (${info.minutesLate}m late${info.arrivalTime ? ` • Arrived ${info.arrivalTime}` : ""}${info.reason ? ` - ${info.reason}` : ""})`;
        } else if (r.notes) {
          detail = ` (${r.notes})`;
        }
        lines.push(`• ${r.swimmer?.full_name || "Swimmer"}${detail}`);
      });
      lines.push(``);
    }

    if (absentList.length > 0) {
      lines.push(`🌴 *Polla of the Day (MIA / Absent):*`);
      absentList.forEach((r) => lines.push(`• ${r.swimmer?.full_name || "Swimmer"}`));
      lines.push(``);
    }

    if (excusedList.length > 0) {
      lines.push(`🩹 *Excused:*`);
      excusedList.forEach((r) => lines.push(`• ${r.swimmer?.full_name || "Swimmer"}`));
      lines.push(``);
    }

    lines.push(`_Recorded with SwimTrack Aquatic Control Room_ 🌊`);

    const text = lines.join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Squad WhatsApp recap copied to clipboard!");
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
        activeLateRecord !== null ||
        showAddModal ||
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
        openLateModal(
          currentRecord.swimmer_id,
          currentRecord.swimmer?.full_name || "Swimmer",
          currentRecord.swimmer?.nickname,
          currentRecord.notes
        );
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
  }, [focusedIndex, filteredRecords, activeNoteSwimmer, activeLateRecord, showAddModal, showFinalizeWarning, lastAction]);

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
              onClick={() => setShowRecapModal(true)}
              aria-label="View session recap and share options"
              className="p-2 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-4 h-4 text-aqua" />
              <span className="hidden sm:inline">Squad Recap</span>
            </button>

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

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Swimmer</span>
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
            const lateInfo = record.status === "late" ? parseLateInfo(record.notes) : null;

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

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{swimmer?.attendance_stats?.rate || 0}% overall</span>
                      <span>&bull;</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">{rank.pollaTag}</span>
                      {record.status === "late" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLateModal(
                              record.swimmer_id,
                              swimmer?.full_name || "Swimmer",
                              swimmer?.nickname,
                              record.notes
                            );
                          }}
                          title="Click to edit late arrival time"
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30 transition-all cursor-pointer shadow-xs"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{lateInfo?.minutesLate ? `${lateInfo.minutesLate}m late` : "Late"}</span>
                          {lateInfo?.arrivalTime && (
                            <span className="opacity-90 font-mono text-[10px]">({lateInfo.arrivalTime})</span>
                          )}
                          {lateInfo?.reason && (
                            <span className="italic opacity-80 max-w-[120px] truncate">&bull; {lateInfo.reason}</span>
                          )}
                        </button>
                      )}
                      {record.notes && record.status !== "late" && (
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
                    onClick={() =>
                      openLateModal(
                        record.swimmer_id,
                        swimmer?.full_name || "Swimmer",
                        swimmer?.nickname,
                        record.notes
                      )
                    }
                    className={cn(
                      "flex-1 sm:flex-initial min-w-[65px] sm:min-w-[75px] h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95",
                      record.status === "late"
                        ? "bg-amber-400 text-ocean-950 shadow-md ring-2 ring-amber-400/40 font-extrabold"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-amber-400/10 hover:text-amber-400 hover:border-amber-400/30"
                    )}
                  >
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {record.status === "late" && lateInfo?.minutesLate
                        ? `${lateInfo.minutesLate}m Late`
                        : "Late"}
                    </span>
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
        ) : attendance.length === 0 ? (
          <div className="py-14 text-center rounded-3xl border border-dashed border-border/80 bg-card/60 p-8 space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-aqua/10 text-aqua flex items-center justify-center mx-auto border border-aqua/20 shadow-inner">
              <UserPlus className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                No Swimmers on This Register Yet
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                Add swimmers one by one to mark Present, Late, Absent, or Excused, or enroll all registered squad members.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Swimmer to Session</span>
              </button>
              <button
                type="button"
                onClick={handleSyncAllSquad}
                disabled={isSyncingSquad}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-aqua", isSyncingSquad && "animate-spin")} />
                <span>Enroll Active Squad Members</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">
              No swimmers match the current filter or search criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="text-xs text-aqua underline font-semibold"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Add Swimmer to Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-aqua" />
                <h3 className="text-base font-bold text-foreground">
                  Add Swimmer to Session
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSwimmer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="e.g. Laki Polla"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={addNickname}
                    onChange={(e) => setAddNickname(e.target.value)}
                    placeholder="e.g. Polla"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="e.g. +94 77 123 4567"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="e.g. lakipolla@pollamail.com"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Set Attendance Status:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAddStatus("present")}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all",
                      addStatus === "present"
                        ? "bg-seafoam text-ocean-950 shadow-md ring-2 ring-seafoam/40"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddStatus("late")}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all",
                      addStatus === "late"
                        ? "bg-amber-400 text-ocean-950 shadow-md ring-2 ring-amber-400/40"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Late</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddStatus("absent")}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all",
                      addStatus === "absent"
                        ? "bg-coral text-ocean-950 shadow-md ring-2 ring-coral/40"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Absent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddStatus("excused")}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all",
                      addStatus === "excused"
                        ? "bg-sky-400 text-ocean-950 shadow-md ring-2 ring-sky-400/40"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Excused</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Session Note (Optional)
                </label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="e.g. Arrived on time, lane 3"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSwimmer}
                  className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingSwimmer ? "Adding..." : "Add & Mark Swimmer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Session Recap Modal */}
      {showRecapModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-aqua" />
                <h3 className="text-base font-bold text-foreground">
                  Session Recap: {session.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecapModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-xl bg-seafoam/10 border border-seafoam/20">
                <p className="text-xl font-black text-seafoam">{presentCount}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Present</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
                <p className="text-xl font-black text-amber-400">{lateCount}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Late</p>
              </div>
              <div className="p-3 rounded-xl bg-coral/10 border border-coral/20">
                <p className="text-xl font-black text-coral">{absentCount}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Absent</p>
              </div>
              <div className="p-3 rounded-xl bg-aqua/10 border border-aqua/20">
                <p className="text-xl font-black text-aqua">{attendanceRate}%</p>
                <p className="text-[11px] font-medium text-muted-foreground">Turnout</p>
              </div>
            </div>

            {absentCount > 0 && (
              <div className="p-3 rounded-xl border border-coral/30 bg-coral/5 space-y-1">
                <p className="text-xs font-bold text-coral flex items-center gap-1.5">
                  <span>🌴</span> Polla of the Day ({absentCount} absent)
                </p>
                <p className="text-xs text-muted-foreground">
                  {attendance
                    .filter((a) => a.status === "absent")
                    .map((a) => a.swimmer?.full_name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRecapModal(false);
                  window.print();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Print Register</span>
              </button>
              <button
                type="button"
                onClick={handleCopyWhatsAppRecap}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-seafoam text-ocean-950 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-seafoam/90 transition-all shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy WhatsApp Recap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Arrival Poolside Modal */}
      {activeLateRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-amber-400/40 bg-card p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Record Late Arrival
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {activeLateRecord.swimmerName} {activeLateRecord.nickname ? `(${activeLateRecord.nickname})` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLateRecord(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Context Banner */}
            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Session Start Time:</span>
              <span className="font-bold text-foreground font-mono bg-secondary px-2.5 py-1 rounded-lg border border-border">
                {formatTime(session.start_time)} ({session.start_time.slice(0, 5)})
              </span>
            </div>

            {/* Fast 1-Tap Presets */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                ⚡ Quick Presets (One Tap)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[5, 10, 15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={cn(
                      "py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center",
                      lateMinutes === mins
                        ? "bg-amber-400 text-ocean-950 border-amber-400 shadow-md ring-2 ring-amber-400/30 font-black"
                        : "bg-secondary/40 hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    +{mins}m late
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleArrivedNow}
                  className="col-span-3 sm:col-span-2 py-2 px-2 rounded-xl text-xs font-bold border border-aqua/30 bg-aqua/10 hover:bg-aqua/20 text-aqua transition-all flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Arrived Just Now</span>
                </button>
              </div>
            </div>

            {/* Synchronized Arrival Time & Minutes Late Stepper */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Arrival Time (24h)
                </label>
                <input
                  type="time"
                  value={lateArrivalTime}
                  onChange={(e) => handleArrivalTimeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-border bg-secondary/50 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Minutes Late
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLateMinutesChange(Math.max(1, lateMinutes - 5))}
                    className="h-10 w-9 rounded-xl border border-border bg-secondary/50 hover:bg-secondary font-bold text-sm text-foreground flex items-center justify-center active:scale-95"
                  >
                    -5
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={lateMinutes}
                    onChange={(e) => handleLateMinutesChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-10 px-2 text-center text-sm font-bold font-mono rounded-xl border border-border bg-secondary/50 text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleLateMinutesChange(lateMinutes + 5)}
                    className="h-10 w-9 rounded-xl border border-border bg-secondary/50 hover:bg-secondary font-bold text-sm text-foreground flex items-center justify-center active:scale-95"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            {/* Common Reason Chips + Optional Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Reason / Coach Note (Optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Traffic / Bus", "School / Tuition", "Kit / Goggles", "Rain / Weather", "Family"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setLateReason(lateReason === chip ? "" : chip)}
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all",
                      lateReason === chip
                        ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                        : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border"
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="e.g. Traffic near clock tower, delayed bus..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-secondary/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {/* Confirmation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                onClick={() => setActiveLateRecord(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLateArrival}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-ocean-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Clock className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm: {lateMinutes}m Late ({minutesToTime12(parseTimeToMinutes(lateArrivalTime))})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
