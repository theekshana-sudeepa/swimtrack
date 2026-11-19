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
  Trash2,
} from "lucide-react";
import { SwimSession } from "@/types/database";
import dynamic from "next/dynamic";
import { SelectedLocationData } from "./map-location-picker";

const MapLocationPickerModal = dynamic(
  () => import("./map-location-picker").then((m) => m.MapLocationPickerModal),
  { ssr: false }
);
import {
  createSessionAction,
  createSeriesAction,
  cancelSessionAction,
  finalizeSessionAction,
  reopenSessionAction,
  deleteSessionAction,
  updateSessionLocationAction,
} from "@/actions/session-actions";
import { formatTime, cn } from "@/lib/utils";
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  DEFAULT_VENUE,
  PRESET_VENUES,
  getSessionVenueCoordinates,
  matchKnownVenueByName,
} from "@/lib/geo-fence";
import { toast } from "sonner";

export function SessionListClient({
  initialSessions,
  defaultPool = DEFAULT_VENUE.name,
  defaultPoolLatitude,
  defaultPoolLongitude,
  defaultPoolRadius,
  defaultDuration = 105,
}: {
  initialSessions: SwimSession[];
  defaultPool?: string;
  defaultPoolLatitude?: number;
  defaultPoolLongitude?: number;
  defaultPoolRadius?: number;
  defaultDuration?: number;
}) {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<SwimSession[]>(initialSessions);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateSingleModal, setShowCreateSingleModal] = React.useState(false);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = React.useState(false);
  const [actionPendingId, setActionPendingId] = React.useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = React.useState<SwimSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = React.useState(false);
  const [sessionToEditLocation, setSessionToEditLocation] = React.useState<SwimSession | null>(
    null
  );

  const resolvedDefaultGeo = React.useMemo<SelectedLocationData>(() => {
    const matched = matchKnownVenueByName(defaultPool);
    return {
      name: defaultPool || DEFAULT_VENUE.name,
      latitude:
        defaultPoolLatitude != null && Number.isFinite(Number(defaultPoolLatitude))
          ? Number(defaultPoolLatitude)
          : matched?.latitude ?? DEFAULT_VENUE.latitude,
      longitude:
        defaultPoolLongitude != null && Number.isFinite(Number(defaultPoolLongitude))
          ? Number(defaultPoolLongitude)
          : matched?.longitude ?? DEFAULT_VENUE.longitude,
      radiusMeters:
        defaultPoolRadius != null && Number.isFinite(Number(defaultPoolRadius))
          ? Number(defaultPoolRadius)
          : matched?.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
    };
  }, [defaultPool, defaultPoolLatitude, defaultPoolLongitude, defaultPoolRadius]);

  // Custom Map Location State for geofencing
  const [selectedGeo, setSelectedGeo] = React.useState<SelectedLocationData>(resolvedDefaultGeo);
  const [showMapPicker, setShowMapPicker] = React.useState(false);

  React.useEffect(() => {
    setSelectedGeo(resolvedDefaultGeo);
  }, [resolvedDefaultGeo]);

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

  async function handleDeleteSession() {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const res = await deleteSessionAction(sessionToDelete.id);
      if (res?.success) {
        toast.success(`Session "${sessionToDelete.title}" deleted.`);
        setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
        setSessionToDelete(null);
        router.refresh();
      } else {
        toast.error((res as { error?: string })?.error || "Failed to delete session.");
      }
    } catch {
      toast.error("An error occurred while deleting session.");
    } finally {
      setIsDeletingSession(false);
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
                      <button
                        type="button"
                        onClick={() => setSessionToEditLocation(session)}
                        title="Click to change pool location & geofence pin on map"
                        className="inline-flex items-center gap-1 hover:text-aqua transition-colors group text-left"
                      >
                        <MapPin className="w-3.5 h-3.5 text-coral group-hover:text-aqua transition-colors shrink-0" />
                        <span className="underline decoration-dotted underline-offset-2">
                          {session.location}
                        </span>
                        <span className="text-[10px] font-bold text-aqua px-1.5 py-0.2 rounded bg-aqua/10 border border-aqua/30 ml-0.5">
                          Change Pin
                        </span>
                      </button>
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
                    onClick={() => setSessionToEditLocation(session)}
                    title="Change pool location & GPS pin on map"
                    className="p-2 rounded-xl border border-aqua/30 bg-aqua/10 hover:bg-aqua/20 text-aqua text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="hidden sm:inline">Pool Pin</span>
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
                    title="View session report and details"
                    className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  <button
                    type="button"
                    disabled={actionPendingId === session.id || isDeletingSession}
                    onClick={() => setSessionToDelete(session)}
                    title="Delete session"
                    className="p-2 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold flex items-center transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
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
                    Pool / Venue Location *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-aqua hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Select on Map</span>
                  </button>
                </div>
                <input
                  name="location"
                  required
                  value={selectedGeo.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = matchKnownVenueByName(val);
                    setSelectedGeo((prev) => ({
                      ...prev,
                      name: val,
                      ...(matched
                        ? {
                            latitude: matched.latitude,
                            longitude: matched.longitude,
                            radiusMeters: matched.radiusMeters,
                          }
                        : {}),
                    }));
                  }}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />

                {/* Hidden inputs to submit custom GPS coordinates and geofence radius */}
                <input type="hidden" name="latitude" value={selectedGeo.latitude} />
                <input type="hidden" name="longitude" value={selectedGeo.longitude} />
                <input type="hidden" name="geofence_radius" value={selectedGeo.radiusMeters} />

                {/* Quick Presets & Map Selector Badge */}
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <MapPin className="w-3 h-3 text-aqua shrink-0" />
                      <span>
                        {selectedGeo.latitude.toFixed(4)}, {selectedGeo.longitude.toFixed(4)} ({selectedGeo.radiusMeters}m geofence)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="text-aqua font-bold text-[10px] hover:underline"
                    >
                      Change on Map &rarr;
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {PRESET_VENUES.map((venue) => (
                      <button
                        key={venue.key}
                        type="button"
                        onClick={() =>
                          setSelectedGeo({
                            name: venue.name,
                            latitude: venue.latitude,
                            longitude: venue.longitude,
                            radiusMeters: venue.radiusMeters,
                          })
                        }
                        className={cn(
                          "px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all",
                          Math.abs(selectedGeo.latitude - venue.latitude) < 0.0002 &&
                            Math.abs(selectedGeo.longitude - venue.longitude) < 0.0002
                            ? "bg-aqua/20 text-aqua border-aqua/40"
                            : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {venue.shortName} ({venue.radiusMeters}m)
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="px-2 py-0.5 rounded-md border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-bold hover:bg-seafoam/20 transition-all flex items-center gap-1"
                    >
                      <span>🗺️ Pick on Map</span>
                    </button>
                  </div>
                </div>
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
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
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
                    Pool / Venue Location *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-aqua hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Select on Map</span>
                  </button>
                </div>
                <input
                  name="location"
                  required
                  value={selectedGeo.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = matchKnownVenueByName(val);
                    setSelectedGeo((prev) => ({
                      ...prev,
                      name: val,
                      ...(matched
                        ? {
                            latitude: matched.latitude,
                            longitude: matched.longitude,
                            radiusMeters: matched.radiusMeters,
                          }
                        : {}),
                    }));
                  }}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />

                {/* Hidden inputs to submit custom GPS coordinates and geofence radius */}
                <input type="hidden" name="latitude" value={selectedGeo.latitude} />
                <input type="hidden" name="longitude" value={selectedGeo.longitude} />
                <input type="hidden" name="geofence_radius" value={selectedGeo.radiusMeters} />

                {/* Quick Presets & Map Selector Badge */}
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <MapPin className="w-3 h-3 text-aqua shrink-0" />
                      <span>
                        {selectedGeo.latitude.toFixed(4)}, {selectedGeo.longitude.toFixed(4)} ({selectedGeo.radiusMeters}m geofence)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="text-aqua font-bold text-[10px] hover:underline"
                    >
                      Change on Map &rarr;
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {PRESET_VENUES.map((venue) => (
                      <button
                        key={venue.key}
                        type="button"
                        onClick={() =>
                          setSelectedGeo({
                            name: venue.name,
                            latitude: venue.latitude,
                            longitude: venue.longitude,
                            radiusMeters: venue.radiusMeters,
                          })
                        }
                        className={cn(
                          "px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all",
                          Math.abs(selectedGeo.latitude - venue.latitude) < 0.0002 &&
                            Math.abs(selectedGeo.longitude - venue.longitude) < 0.0002
                            ? "bg-aqua/20 text-aqua border-aqua/40"
                            : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {venue.shortName} ({venue.radiusMeters}m)
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="px-2 py-0.5 rounded-md border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-bold hover:bg-seafoam/20 transition-all flex items-center gap-1"
                    >
                      <span>🗺️ Pick on Map</span>
                    </button>
                  </div>
                </div>
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
      {/* Interactive Map Location Picker Modal (Create / Series) */}
      {showMapPicker && (
        <MapLocationPickerModal
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onSelectLocation={(data) => {
            setSelectedGeo(data);
            toast.success(`Location set: ${data.name} (${data.radiusMeters}m geofence)`);
          }}
          initialLocation={{
            name: selectedGeo.name,
            latitude: selectedGeo.latitude,
            longitude: selectedGeo.longitude,
            radiusMeters: selectedGeo.radiusMeters,
          }}
        />
      )}

      {/* Edit Existing Session Pool Location Modal */}
      {sessionToEditLocation && (
        <MapLocationPickerModal
          isOpen={!!sessionToEditLocation}
          onClose={() => setSessionToEditLocation(null)}
          title={`Change Pool Location — ${sessionToEditLocation.title}`}
          confirmLabel="Save Session Pool Location"
          initialLocation={(() => {
            const venue = getSessionVenueCoordinates(sessionToEditLocation);
            return {
              name: sessionToEditLocation.location || venue.name,
              latitude: sessionToEditLocation.latitude ?? venue.latitude,
              longitude: sessionToEditLocation.longitude ?? venue.longitude,
              radiusMeters: sessionToEditLocation.geofence_radius ?? venue.radiusMeters,
            };
          })()}
          onSelectLocation={async (data) => {
            const target = sessionToEditLocation;
            if (!target) return false;
            const res = await updateSessionLocationAction(target.id, {
              location: data.name,
              latitude: data.latitude,
              longitude: data.longitude,
              geofence_radius: data.radiusMeters,
            });
            if (!res.success) {
              toast.error(res.error || "Failed to update session pool location.");
              return false;
            }
            setSessions((prev) =>
              prev.map((s) =>
                s.id === target.id
                  ? {
                      ...s,
                      location: data.name,
                      latitude: data.latitude,
                      longitude: data.longitude,
                      geofence_radius: data.radiusMeters,
                    }
                  : s
              )
            );
            toast.success(
              `Updated pool location for "${target.title}" to ${data.name} (${data.radiusMeters}m)!`
            );
            router.refresh();
            return true;
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
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
                onClick={() => setSessionToDelete(null)}
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
                &ldquo;{sessionToDelete.title}&rdquo; &bull; {sessionToDelete.date}
              </p>
              <p className="text-[11px] text-muted-foreground">
                All swimmer attendance logs, audit history, and associated data for this session will be permanently erased.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/80">
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={() => setSessionToDelete(null)}
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
