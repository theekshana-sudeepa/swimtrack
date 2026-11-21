"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  Users,
  CheckCircle2,
  Mail,
  Zap,
  Lock,
  Unlock,
  Download,
  AlertTriangle,
  ShieldAlert,
  Share2,
  Printer,
  Copy,
  Flame,
  Award,
  BarChart3,
  ListOrdered,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AttendanceRecord, Swimmer, SwimSession, PoolVenue } from "@/types/database";
import dynamic from "next/dynamic";
import {
  finalizeSessionAction,
  reopenSessionAction,
  deleteSessionAction,
  updateSessionLocationAction,
} from "@/actions/session-actions";
import { generateSessionStateReport, SessionStateReport } from "@/lib/session-reports";
import { getSessionVenueCoordinates } from "@/lib/geo-fence";
import { formatTime, getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";

const MapLocationPickerModal = dynamic(
  () => import("./map-location-picker").then((m) => m.MapLocationPickerModal),
  { ssr: false }
);

interface SessionStateReportClientProps {
  session: SwimSession;
  attendance: AttendanceRecord[];
  swimmers: Swimmer[];
  eligibleRemindersCount: number;
  savedVenues?: PoolVenue[];
}

export function SessionStateReportClient({
  session: initialSession,
  attendance,
  swimmers,
  eligibleRemindersCount,
  savedVenues = [],
}: SessionStateReportClientProps) {
  const router = useRouter();
  const [session, setSession] = React.useState<SwimSession>(initialSession);
  const [venues, setVenues] = React.useState<PoolVenue[]>(savedVenues);
  const [activeTab, setActiveTab] = React.useState<"report" | "roster">("report");

  React.useEffect(() => {
    setVenues(savedVenues);
  }, [savedVenues]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isFinalized, setIsFinalized] = React.useState(initialSession.is_finalized);
  const [isActionPending, setIsActionPending] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeletingSession, setIsDeletingSession] = React.useState(false);
  const [showMapPicker, setShowMapPicker] = React.useState(false);

  React.useEffect(() => {
    setSession(initialSession);
    setIsFinalized(initialSession.is_finalized);
  }, [initialSession]);

  async function handleToggleFinalize() {
    setIsActionPending(true);
    try {
      if (isFinalized) {
        const res = await reopenSessionAction(session.id);
        if (res.success) {
          setIsFinalized(false);
          toast.info("Session reopened for attendance editing.");
        }
      } else {
        const res = await finalizeSessionAction(session.id);
        if (res.success) {
          setIsFinalized(true);
          toast.success("Session finalized & marked completed!");
        }
      }
    } catch {
      toast.error("Failed to update session finalization status.");
    } finally {
      setIsActionPending(false);
    }
  }

  async function handleDeleteSession() {
    setIsDeletingSession(true);
    try {
      const res = await deleteSessionAction(session.id);
      if (res?.success) {
        toast.success(`Session "${session.title}" deleted.`);
        setShowDeleteModal(false);
        router.push("/sessions");
        router.refresh();
      } else {
        toast.error((res as { error?: string })?.error || "Failed to delete session.");
        setIsDeletingSession(false);
      }
    } catch {
      toast.error("An error occurred while deleting session.");
      setIsDeletingSession(false);
    }
  }

  const report: SessionStateReport = React.useMemo(() => {
    return generateSessionStateReport(session, attendance, swimmers);
  }, [session, attendance, swimmers]);

  function handleCopyWhatsApp() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(report.whatsAppText);
      toast.success("Squad WhatsApp session report copied to clipboard!");
    } else {
      toast.error("Clipboard access not available in this browser.");
    }
  }

  function handlePrint() {
    window.print();
  }

  // Filter roster items
  const filteredRoster = React.useMemo(() => {
    return attendance.filter((rec) => {
      const sw = rec.swimmer;
      if (statusFilter !== "all" && rec.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = sw?.full_name?.toLowerCase().includes(query);
        const matchesNick = sw?.nickname?.toLowerCase().includes(query);
        const matchesNotes = rec.notes?.toLowerCase().includes(query);
        return matchesName || matchesNick || matchesNotes;
      }
      return true;
    });
  }, [attendance, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Sessions</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyWhatsApp}
            className="px-3 py-1.5 rounded-xl border border-seafoam/30 bg-seafoam/10 text-seafoam hover:bg-seafoam/20 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Copy formatted WhatsApp recap report"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Copy WhatsApp Recap</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl border border-border bg-secondary/40 text-foreground hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border",
                  isFinalized || session.status === "completed"
                    ? "bg-ocean-900 text-aqua border-aqua/30"
                    : session.status === "cancelled"
                    ? "bg-coral/10 text-coral border-coral/30"
                    : "bg-seafoam/10 text-seafoam border-seafoam/30"
                )}
              >
                {isFinalized ? "completed" : session.status}
              </span>

              {isFinalized && (
                <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-aqua" />
                  Finalized Attendance
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {session.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-seafoam" />
                <span>{session.date}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-aqua" />
                <span>
                  {formatTime(session.start_time)} – {formatTime(session.end_time)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                title="Click to change pool location & geofence pin on map"
                className="flex items-center gap-1.5 hover:text-aqua transition-colors group text-left"
              >
                <MapPin className="w-4 h-4 text-coral group-hover:text-aqua transition-colors shrink-0" />
                <span className="underline decoration-dotted underline-offset-2">
                  {session.location}
                </span>
                <span className="text-[10px] font-bold text-aqua px-2 py-0.5 rounded-full bg-aqua/10 border border-aqua/30">
                  Change Pool Pin
                </span>
              </button>
            </div>

            {session.notes && (
              <p className="mt-3 text-xs text-muted-foreground italic">
                &ldquo;{session.notes}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isActionPending}
              onClick={handleToggleFinalize}
              className={cn(
                "px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95",
                isFinalized
                  ? "border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                  : "bg-seafoam hover:bg-seafoam/90 text-ocean-950 font-extrabold"
              )}
            >
              {isFinalized ? (
                <>
                  <Unlock className="w-4 h-4 text-aqua" />
                  <span>Reopen Session</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Finalize Session</span>
                </>
              )}
            </button>

            <Link
              href={`/attendance?session=${session.id}`}
              className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Live Attendance</span>
            </Link>

            <Link
              href={`/reminders?session=${session.id}`}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Mail className="w-4 h-4 text-aqua" />
              <span>Reminders ({eligibleRemindersCount})</span>
            </Link>

            <button
              type="button"
              disabled={isActionPending || isDeletingSession}
              onClick={() => setShowDeleteModal(true)}
              title="Delete this session"
              className="px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Session</span>
            </button>
          </div>
        </div>

        {/* 5-Metric State Breakdown Strip */}
        <div className="pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-secondary/30 border border-border/50">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Turnout Rate</div>
            <div className="text-xl font-black text-aqua mt-0.5">{report.attendanceRate}%</div>
            <div className="text-[10px] text-muted-foreground">
              {report.breakdown.present.count + report.breakdown.late.count} of{" "}
              {report.breakdown.present.count + report.breakdown.late.count + report.breakdown.absent.count}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30 border border-border/50">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Punctuality</div>
            <div className="text-xl font-black text-seafoam mt-0.5">{report.punctualityRate}%</div>
            <div className="text-[10px] text-muted-foreground">On-Time Index</div>
          </div>

          <div className="p-3 rounded-2xl bg-seafoam/10 border border-seafoam/20">
            <div className="text-[10px] text-seafoam uppercase font-bold">Present</div>
            <div className="text-xl font-black text-seafoam mt-0.5">{report.breakdown.present.count}</div>
            <div className="text-[10px] text-muted-foreground">{report.breakdown.present.percentage}% squad</div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20">
            <div className="text-[10px] text-amber-400 uppercase font-bold">Late</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{report.breakdown.late.count}</div>
            <div className="text-[10px] text-muted-foreground">
              {report.breakdown.late.totalMinutes > 0 ? `+${report.breakdown.late.totalMinutes}m total` : "0m delay"}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-400/10 border border-sky-400/20">
            <div className="text-[10px] text-sky-400 uppercase font-bold">Excused</div>
            <div className="text-xl font-black text-sky-400 mt-0.5">{report.breakdown.excused.count}</div>
            <div className="text-[10px] text-muted-foreground">Exempt (0 Penalty)</div>
          </div>

          <div className="p-3 rounded-2xl bg-coral/10 border border-coral/20">
            <div className="text-[10px] text-coral uppercase font-bold">Absent (Polla)</div>
            <div className="text-xl font-black text-coral mt-0.5">{report.breakdown.absent.count}</div>
            <div className="text-[10px] text-muted-foreground">Unexcused MIA</div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("report")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
            activeTab === "report"
              ? "bg-aqua text-ocean-950 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Session State & Roles Report</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("roster")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
            activeTab === "roster"
              ? "bg-aqua text-ocean-950 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Participants Roster ({attendance.length})</span>
        </button>
      </div>

      {/* TAB 1: SESSION STATE & ROLES REPORT */}
      {activeTab === "report" && (
        <div className="space-y-6">
          {/* Session Honors & Squad Awards */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aqua" />
                <h2 className="font-extrabold text-sm text-foreground">
                  Session Honors & Squad Roles
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Decided from attendance state, streaks & punctuality
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Lane Captain */}
              <div className="p-4 rounded-2xl border border-seafoam/30 bg-seafoam/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🔱</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-seafoam">
                    Lane Captain
                  </span>
                </div>
                {report.awards.laneCaptain ? (
                  <div>
                    <div className="font-extrabold text-sm text-foreground">
                      {report.awards.laneCaptain.fullName}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {report.awards.laneCaptain.sessionRole.badge}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No active streak on deck</p>
                )}
              </div>

              {/* On-Time Pacesetter */}
              <div className="p-4 rounded-2xl border border-aqua/30 bg-aqua/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">⚡</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-aqua">
                    Session Pacesetter
                  </span>
                </div>
                {report.awards.pacesetter ? (
                  <div>
                    <div className="font-extrabold text-sm text-foreground">
                      {report.awards.pacesetter.fullName}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {report.awards.pacesetter.squadRank.title}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No pacesetter recorded</p>
                )}
              </div>

              {/* Warmup Dodger */}
              <div className="p-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">⏰</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Warmup Dodger
                  </span>
                </div>
                {report.awards.warmupDodger ? (
                  <div>
                    <div className="font-extrabold text-sm text-foreground">
                      {report.awards.warmupDodger.fullName}
                    </div>
                    <p className="text-[11px] text-amber-300 font-semibold">
                      +{report.awards.warmupDodger.minutesLate}m late
                      {report.awards.warmupDodger.reason ? ` (${report.awards.warmupDodger.reason})` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">100% on-time warmup! 🛡️</p>
                )}
              </div>

              {/* Polla of the Day */}
              <div className="p-4 rounded-2xl border border-coral/30 bg-coral/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🌴</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
                    Polla of the Day
                  </span>
                </div>
                {report.awards.pollaKing ? (
                  <div>
                    <div className="font-extrabold text-sm text-foreground">
                      {report.awards.pollaKing.fullName}
                    </div>
                    <p className="text-[11px] text-coral font-medium">
                      Unexcused MIA ({report.awards.pollaKing.totalCareerAbsences} total)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-seafoam font-semibold">Zero Polla today! 🎉</p>
                )}
              </div>
            </div>
          </div>

          {/* 4 State Quadrants: Breakdown Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Present Squad */}
            <div className="p-5 rounded-3xl border border-seafoam/20 bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏊‍♂️</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-seafoam">
                    Present & On Deck ({report.breakdown.present.count})
                  </h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {report.breakdown.present.percentage}% of squad
                </span>
              </div>

              {report.breakdown.present.swimmers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No present swimmers recorded.
                </p>
              ) : (
                <div className="divide-y divide-border/50 max-h-64 overflow-y-auto pr-1">
                  {report.breakdown.present.swimmers.map((item) => (
                    <div key={item.swimmerId} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-ocean-900 border border-seafoam/30 text-seafoam flex items-center justify-center font-bold text-[10px]">
                          {getInitials(item.fullName)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {item.fullName}
                            {item.nickname && (
                              <span className="text-[11px] text-muted-foreground font-normal ml-1">
                                ({item.nickname})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.squadRank.title}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                          item.sessionRole.colorClass
                        )}
                      >
                        <span>{item.sessionRole.emoji}</span>
                        <span>{item.sessionRole.role}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Late Arrivals */}
            <div className="p-5 rounded-3xl border border-amber-400/20 bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                    Late Arrivals ({report.breakdown.late.count})
                  </h3>
                </div>
                <span className="text-[10px] text-amber-300 font-bold font-mono">
                  Avg: {report.breakdown.late.avgMinutes}m delay
                </span>
              </div>

              {report.breakdown.late.swimmers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  Zero late arrivals. 100% punctuality! ⏱️
                </p>
              ) : (
                <div className="divide-y divide-border/50 max-h-64 overflow-y-auto pr-1">
                  {report.breakdown.late.swimmers.map((item) => (
                    <div key={item.swimmerId} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-ocean-900 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                          {getInitials(item.fullName)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {item.fullName}
                          </div>
                          <div className="text-[10px] text-amber-300">
                            +{item.minutesLate}m late
                            {item.arrivalTime && ` (${item.arrivalTime})`}
                            {item.reason && ` &bull; ${item.reason}`}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                          item.sessionRole.colorClass
                        )}
                      >
                        <span>{item.sessionRole.emoji}</span>
                        <span>{item.sessionRole.role}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Excused Absences */}
            <div className="p-5 rounded-3xl border border-sky-400/20 bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🩹</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-sky-400">
                    Excused Absences ({report.breakdown.excused.count})
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                  {report.breakdown.excused.categories.medical > 0 && (
                    <span className="px-1.5 py-0.5 bg-sky-400/10 text-sky-300 rounded">
                      🩺 {report.breakdown.excused.categories.medical} Med
                    </span>
                  )}
                  {report.breakdown.excused.categories.academic > 0 && (
                    <span className="px-1.5 py-0.5 bg-sky-400/10 text-sky-300 rounded">
                      📚 {report.breakdown.excused.categories.academic} Exam
                    </span>
                  )}
                </div>
              </div>

              {report.breakdown.excused.swimmers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No excused absences recorded for this practice.
                </p>
              ) : (
                <div className="divide-y divide-border/50 max-h-64 overflow-y-auto pr-1">
                  {report.breakdown.excused.swimmers.map((item) => (
                    <div key={item.swimmerId} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-ocean-900 border border-sky-400/30 text-sky-400 flex items-center justify-center font-bold text-[10px]">
                          {getInitials(item.fullName)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {item.fullName}
                          </div>
                          <div className="text-[10px] text-sky-300">
                            {item.cleanReason}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                          item.sessionRole.colorClass
                        )}
                      >
                        <span>{item.sessionRole.emoji}</span>
                        <span>{item.sessionRole.role}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unexcused Absences (Polla) */}
            <div className="p-5 rounded-3xl border border-coral/20 bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌴</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-coral">
                    Unexcused MIA ({report.breakdown.absent.count})
                  </h3>
                </div>
                <span className="text-[10px] text-coral font-bold">
                  Polla Meter Active 🚨
                </span>
              </div>

              {report.breakdown.absent.swimmers.length === 0 ? (
                <p className="text-xs text-seafoam font-semibold italic py-3 text-center">
                  Zero Polla! Entire squad showed up or excused! 🌊
                </p>
              ) : (
                <div className="divide-y divide-border/50 max-h-64 overflow-y-auto pr-1">
                  {report.breakdown.absent.swimmers.map((item) => (
                    <div key={item.swimmerId} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-ocean-900 border border-coral/30 text-coral flex items-center justify-center font-bold text-[10px]">
                          {getInitials(item.fullName)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {item.fullName}
                          </div>
                          <div className="text-[10px] text-coral">
                            {item.totalCareerAbsences} career unexcused absences
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                          item.sessionRole.colorClass
                        )}
                      >
                        <span>{item.sessionRole.emoji}</span>
                        <span>{item.sessionRole.role}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPLETE PARTICIPANTS ROSTER WITH ROLES */}
      {activeTab === "roster" && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-aqua" />
              <h2 className="font-bold text-sm text-foreground">
                Session Roster & Squad Roles ({filteredRoster.length})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search swimmers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-secondary/50 text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
              >
                <option value="all">All States ({attendance.length})</option>
                <option value="present">Present ({report.breakdown.present.count})</option>
                <option value="late">Late ({report.breakdown.late.count})</option>
                <option value="excused">Excused ({report.breakdown.excused.count})</option>
                <option value="absent">Absent ({report.breakdown.absent.count})</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredRoster.map((record) => {
              const swimmer = record.swimmer;
              const stats = swimmer?.attendance_stats;
              const rank = swimmer ? report.breakdown.present.swimmers.find(s => s.swimmerId === swimmer.id)?.squadRank
                || report.breakdown.late.swimmers.find(s => s.swimmerId === swimmer.id)?.squadRank
                || report.breakdown.excused.swimmers.find(s => s.swimmerId === swimmer.id)?.squadRank
                || report.breakdown.absent.swimmers.find(s => s.swimmerId === swimmer.id)?.squadRank
                : null;

              return (
                <div
                  key={record.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/10 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-ocean-900 border border-aqua/30 text-aqua flex items-center justify-center font-bold text-xs shrink-0">
                      {swimmer ? getInitials(swimmer.full_name) : "??"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">
                          {swimmer?.full_name}
                        </span>
                        {swimmer?.nickname && (
                          <span className="text-muted-foreground font-normal text-xs">
                            ({swimmer.nickname})
                          </span>
                        )}
                        {rank && (
                          <span
                            title={rank.description}
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.2 rounded-full border hidden md:inline-flex items-center gap-0.5",
                              rank.colorScheme.pillBg
                            )}
                          >
                            <span>{rank.emoji}</span>
                            <span>{rank.title}</span>
                          </span>
                        )}
                      </div>

                      {record.notes && (
                        <div className="text-[10px] text-aqua italic">
                          &ldquo;{record.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Attendance State Pill */}
                    <span
                      className={cn(
                        "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                        record.status === "present"
                          ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                          : record.status === "late"
                          ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                          : record.status === "absent"
                          ? "bg-coral/10 text-coral border-coral/30"
                          : record.status === "excused"
                          ? "bg-sky-400/10 text-sky-400 border-sky-400/30"
                          : "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      {record.status === "present" && (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-seafoam" />
                          <span>Present</span>
                        </>
                      )}
                      {record.status === "late" && (
                        <>
                          <Clock className="w-3 h-3 text-amber-400 stroke-[2.5]" />
                          <span>Late</span>
                        </>
                      )}
                      {record.status === "excused" && (
                        <>
                          <ShieldAlert className="w-3 h-3 text-sky-400 stroke-[2.5]" />
                          <span>Excused</span>
                        </>
                      )}
                      {record.status === "absent" && (
                        <>
                          <span>🌴 Absent</span>
                        </>
                      )}
                      {record.status === "not_marked" && <span>Unmarked</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Pool Location Pin Modal */}
      {showMapPicker && (
        <MapLocationPickerModal
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          title={`Change Pool Location — ${session.title}`}
          confirmLabel="Save Pool Location"
          savedVenues={venues}
          allowSaveAsVenue
          showApplyToSeries={Boolean(session.series_id)}
          initialLocation={(() => {
            const venue = getSessionVenueCoordinates(session, venues);
            return {
              name: session.location || venue.name,
              latitude: session.latitude ?? venue.latitude,
              longitude: session.longitude ?? venue.longitude,
              radiusMeters: session.geofence_radius ?? venue.radiusMeters,
              venueId: session.venue_id ?? null,
            };
          })()}
          onSelectLocation={async (data) => {
            const res = await updateSessionLocationAction(session.id, {
              location: data.name,
              latitude: data.latitude,
              longitude: data.longitude,
              geofence_radius: data.radiusMeters,
              venue_id: data.venueId ?? null,
              saveAsVenue: data.saveAsVenue,
              shortName: data.shortName,
              applyToSeries: data.applyToSeries,
            });
            if (!res.success) {
              toast.error(res.error || "Failed to update pool location.");
              return false;
            }
            setSession((prev) => ({
              ...prev,
              location: data.name,
              venue_id: res.session?.venue_id ?? data.venueId ?? null,
              latitude: data.latitude,
              longitude: data.longitude,
              geofence_radius: data.radiusMeters,
            }));
            if (res.venues) {
              setVenues(res.venues);
            }
            const extraMsg = [
              data.saveAsVenue ? "saved to My Swimming Places" : "",
              res.seriesUpdatedCount
                ? `updated ${res.seriesUpdatedCount} more upcoming session${res.seriesUpdatedCount === 1 ? "" : "s"} in series`
                : "",
            ]
              .filter(Boolean)
              .join(" • ");
            toast.success(
              `Pool location updated to ${data.name} (${data.radiusMeters}m)${extraMsg ? ` — ${extraMsg}` : ""}!`
            );
            router.refresh();
            return true;
          }}
        />
      )}

      {/* Delete Session Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-destructive/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Delete Swimming Session?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs space-y-2">
              <p className="font-semibold text-destructive">
                Are you sure you want to permanently delete:
              </p>
              <p className="font-bold text-foreground">
                &ldquo;{session.title}&rdquo; &bull; {session.date}
              </p>
              <p className="text-[11px] text-muted-foreground">
                All {attendance.length} attendance records, attendance rate statistics, and audit trails for this session will be permanently erased.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={() => setShowDeleteModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={handleDeleteSession}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                <span>{isDeletingSession ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

