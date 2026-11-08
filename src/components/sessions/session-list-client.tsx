"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  Repeat,
  Download,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Lock,
  Unlock,
} from "lucide-react";
import { SwimSession } from "@/types/database";
import {
  createSessionAction,
  createSeriesAction,
  cancelSessionAction,
  finalizeSessionAction,
  reopenSessionAction,
} from "@/actions/session-actions";
import { formatTime, cn } from "@/lib/utils";
import { toast } from "sonner";

export function SessionListClient({
  initialSessions,
  defaultPool = "Bandaranayake College Swimming Pool Complex",
  defaultDuration = 105,
}: {
  initialSessions: SwimSession[];
  defaultPool?: string;
  defaultDuration?: number;
}) {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<SwimSession[]>(initialSessions);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateSingleModal, setShowCreateSingleModal] = React.useState(false);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = React.useState(false);
  const [actionPendingId, setActionPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  async function handleToggleFinalize(session: SwimSession) {
    setActionPendingId(session.id);
    try {
      if (session.is_finalized) {
        const res = await reopenSessionAction(session.id);
        if (res.success) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === session.id
                ? { ...s, is_finalized: false, status: "scheduled" as const }
                : s
            )
          );
          toast.info(`Session "${session.title}" reopened for editing.`);
          router.refresh();
        }
      } else {
        const res = await finalizeSessionAction(session.id);
        if (res.success) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === session.id
                ? { ...s, is_finalized: true, status: "completed" as const }
                : s
            )
          );
          toast.success(`Session "${session.title}" finalized & marked completed!`);
          router.refresh();
        }
      }
    } catch {
      toast.error("Failed to update session status.");
    } finally {
      setActionPendingId(null);
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  // Download .ics Calendar File
  function downloadICS(session: SwimSession) {
    const startClean = session.date.replace(/-/g, "") + "T" + session.start_time.replace(/:/g, "").slice(0, 4) + "00";
    const endClean = session.date.replace(/-/g, "") + "T" + session.end_time.replace(/:/g, "").slice(0, 4) + "00";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SwimTrack//The Aquatic Control Room//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${session.id}@swimtrack.club`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${startClean}`,
      `DTEND:${endClean}`,
      `SUMMARY:${session.title}`,
      `LOCATION:${session.location}`,
      `DESCRIPTION:${session.notes || "SwimTrack squad session"}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `${session.title.replace(/\s+/g, "_")}_${session.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Calendar file (.ics) downloaded.");
  }

  // Create Single Session
  async function handleCreateSingle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createSessionAction(formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Session scheduled!");
      setShowCreateSingleModal(false);
      router.refresh();
    }
  }

  // Create Series
  async function handleCreateSeries(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createSeriesAction(formData);
    if (!res.success) {
      toast.error(res.error);
    } else {
      toast.success(`Recurring series created with ${res.createdSessionsCount} sessions!`);
      setShowCreateSeriesModal(false);
      router.refresh();
    }
  }

  async function handleCancel(id: string) {
    if (confirm("Cancel this swimming session? Participants will see it marked as Cancelled.")) {
      await cancelSessionAction(id);
      toast.info("Session cancelled.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Swimming Sessions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule practice sessions, configure recurring series, and download calendar invites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateSeriesModal(true)}
            className="px-3.5 py-2 rounded-xl border border-seafoam/30 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Recurring Series</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateSingleModal(true)}
            className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {["all", "scheduled", "completed", "cancelled"].map((filterKey) => (
          <button
            key={filterKey}
            type="button"
            onClick={() => setStatusFilter(filterKey)}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors",
              statusFilter === filterKey
                ? "bg-ocean-900 text-aqua border border-aqua/30"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {filterKey} ({filterKey === "all" ? sessions.length : sessions.filter((s) => s.status === filterKey).length})
          </button>
        ))}
      </div>

      {/* Session Cards List */}
      <div className="space-y-3">
        {filteredSessions.length > 0 ? (
          filteredSessions.map((session) => {
            const summary = session.attendance_summary;

            return (
              <div
                key={session.id}
                className="p-5 rounded-2xl border border-border bg-card hover:border-aqua/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-ocean-900 border border-aqua/30 text-aqua flex flex-col items-center justify-center font-bold text-xs shrink-0 leading-tight">
                    <span>{session.date.split("-")[2]}</span>
                    <span className="text-[9px] uppercase text-ocean-300">
                      {new Date(session.date).toLocaleString("en-US", { month: "short" })}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="font-bold text-base text-foreground hover:text-aqua transition-colors"
                      >
                        {session.title}
                      </Link>
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
                          session.status === "scheduled"
                            ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                            : session.status === "completed"
                            ? "bg-ocean-900 text-aqua border-aqua/30"
                            : "bg-coral/10 text-coral border-coral/30"
                        )}
                      >
                        {session.status}
                      </span>
                      {session.is_finalized && (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3 text-aqua" />
                          Finalized
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-aqua" />
                        <span>
                          {formatTime(session.start_time)} – {formatTime(session.end_time)}
                        </span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-coral" />
                        <span>{session.location}</span>
                      </span>
                    </div>

                    {summary && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                        <span className="text-seafoam font-semibold">
                          {summary.present} Present
                        </span>
                        <span>&bull;</span>
                        <span className="text-amber-400 font-semibold">
                          {summary.late} Late
                        </span>
                        <span>&bull;</span>
                        <span className="text-coral font-semibold">
                          {summary.absent} Absent
                        </span>
                        {summary.not_marked > 0 && (
                          <>
                            <span>&bull;</span>
                            <span className="text-muted-foreground">
                              {summary.not_marked} Unmarked
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={actionPendingId === session.id}
                    onClick={() => handleToggleFinalize(session)}
                    title={session.is_finalized ? "Reopen session for editing" : "Finalize attendance for this session"}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs",
                      session.is_finalized
                        ? "border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        : "border border-aqua/40 bg-aqua/10 text-aqua hover:bg-aqua/20"
                    )}
                  >
                    {session.is_finalized ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-aqua" />
                        <span className="hidden sm:inline">Reopen</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Finalize</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadICS(session)}
                    title="Download .ics Calendar File"
                    className="p-2 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">.ICS</span>
                  </button>

                  <Link
                    href={`/attendance?session=${session.id}`}
                    className="px-3.5 py-2 rounded-xl bg-aqua/20 text-aqua hover:bg-aqua/30 text-xs font-bold transition-all"
                  >
                    Attendance
                  </Link>

                  <Link
                    href={`/sessions/${session.id}`}
                    className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-card">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No sessions in this category</p>
          </div>
        )}
      </div>

      {/* Single Session Modal */}
      {showCreateSingleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Schedule Swimming Session</h3>
              <button
                type="button"
                onClick={() => setShowCreateSingleModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSingle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Session Title *
                </label>
                <input
                  name="title"
                  required
                  defaultValue="Evening Squad Lap Swim"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Date *</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Start Time * (3:00 PM)
                  </label>
                  <input
                    name="start_time"
                    type="time"
                    required
                    defaultValue="15:00"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    End Time * (4:45 PM)
                  </label>
                  <input
                    name="end_time"
                    type="time"
                    required
                    defaultValue="16:45"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-foreground">
                    Pool / Location *
                  </label>
                  <span className="text-[10px] text-aqua font-semibold">From Saved Settings</span>
                </div>
                <input
                  name="location"
                  required
                  defaultValue={defaultPool}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Session Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Aerobic endurance ladder, sprint drills..."
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateSingleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recurring Series Modal */}
      {showCreateSeriesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Create Recurring Series</h3>
              <button
                type="button"
                onClick={() => setShowCreateSeriesModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSeries} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Series Title *
                </label>
                <input
                  name="title"
                  required
                  defaultValue="Evening Squad Lap Swim"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Day of Week *
                </label>
                <select
                  name="day_of_week"
                  defaultValue="6"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Start Time * (3:00 PM)
                  </label>
                  <input
                    name="start_time"
                    type="time"
                    required
                    defaultValue="15:00"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    End Time * (4:45 PM)
                  </label>
                  <input
                    name="end_time"
                    type="time"
                    required
                    defaultValue="16:45"
                    className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Starting Date *
                </label>
                <input
                  name="start_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Occurrences to Generate (weeks)
                </label>
                <input
                  name="occurrences"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={6}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-foreground">
                    Pool / Location *
                  </label>
                  <span className="text-[10px] text-aqua font-semibold">From Saved Settings</span>
                </div>
                <input
                  name="location"
                  required
                  defaultValue={defaultPool}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateSeriesModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-seafoam hover:bg-seafoam-hover text-ocean-950 font-bold text-xs"
                >
                  Generate Series
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
