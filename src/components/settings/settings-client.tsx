"use client";

import * as React from "react";
import {
  Settings,
  Shield,
  Bell,
  Database,
  Palette,
  Download,
  RotateCcw,
  CheckCircle2,
  Lock,
  LogOut,
  Mail,
  Activity,
  Trash2,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/actions/auth-actions";
import {
  wipeAllDataAction,
  updateGeneralPreferencesAction,
  updateReminderPreferencesSettingAction,
  exportDatabaseBackupAction,
  resetToDemoAction,
} from "@/actions/settings-actions";
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  DEFAULT_VENUE,
  PRESET_VENUES,
  matchKnownVenueByName,
} from "@/lib/geo-fence";
import { cn } from "@/lib/utils";
import { AppSetting } from "@/types/database";
import { toast } from "sonner";

const MapLocationPickerModal = dynamic(
  () => import("@/components/sessions/map-location-picker").then((m) => m.MapLocationPickerModal),
  { ssr: false }
);

interface SettingsClientProps {
  initialSettings?: Record<string, AppSetting>;
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const generalVal = initialSettings?.general?.value as Record<string, unknown> | undefined;
  const reminderVal = initialSettings?.reminders?.value as Record<string, unknown> | undefined;

  const [groupName, setGroupName] = React.useState(
    (generalVal?.group_name as string) || "SwimTrack Club"
  );
  const [defaultPool, setDefaultPool] = React.useState(
    (generalVal?.default_pool as string) || DEFAULT_VENUE.name
  );
  const initialMatchedVenue = matchKnownVenueByName(
    (generalVal?.default_pool as string) || DEFAULT_VENUE.name
  );
  const [defaultPoolLat, setDefaultPoolLat] = React.useState<number>(
    typeof generalVal?.default_pool_latitude === "number"
      ? (generalVal.default_pool_latitude as number)
      : initialMatchedVenue?.latitude ?? DEFAULT_VENUE.latitude
  );
  const [defaultPoolLng, setDefaultPoolLng] = React.useState<number>(
    typeof generalVal?.default_pool_longitude === "number"
      ? (generalVal.default_pool_longitude as number)
      : initialMatchedVenue?.longitude ?? DEFAULT_VENUE.longitude
  );
  const [defaultPoolRadius, setDefaultPoolRadius] = React.useState<number>(
    typeof generalVal?.default_pool_radius === "number"
      ? (generalVal.default_pool_radius as number)
      : initialMatchedVenue?.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS
  );
  const [applyToUpcoming, setApplyToUpcoming] = React.useState(true);
  const [showMapPicker, setShowMapPicker] = React.useState(false);
  const [duration, setDuration] = React.useState(
    String(generalVal?.default_duration_minutes || "60")
  );
  const [adminEmail, setAdminEmail] = React.useState(
    (generalVal?.admin_email as string) || ""
  );
  const [lateThreshold, setLateThreshold] = React.useState(
    String(generalVal?.late_threshold_minutes ?? "10")
  );
  const [excuseCutoff, setExcuseCutoff] = React.useState(
    String(generalVal?.excuse_cutoff_minutes ?? "60")
  );
  const [timezone] = React.useState("Asia/Colombo (UTC+05:30)");
  const [autoReminders, setAutoReminders] = React.useState(
    reminderVal?.auto_reminders_enabled !== false
  );
  const [isSavingGeneral, setIsSavingGeneral] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isResettingDemo, setIsResettingDemo] = React.useState(false);

  React.useEffect(() => {
    if (initialSettings?.general?.value) {
      const g = initialSettings.general.value as Record<string, unknown>;
      if (g.group_name) setGroupName(g.group_name as string);
      if (g.default_pool !== undefined) {
        const poolStr = g.default_pool as string;
        setDefaultPool(poolStr);
        const matched = matchKnownVenueByName(poolStr);
        if (typeof g.default_pool_latitude === "number") {
          setDefaultPoolLat(g.default_pool_latitude);
        } else if (matched) {
          setDefaultPoolLat(matched.latitude);
        }
        if (typeof g.default_pool_longitude === "number") {
          setDefaultPoolLng(g.default_pool_longitude);
        } else if (matched) {
          setDefaultPoolLng(matched.longitude);
        }
        if (typeof g.default_pool_radius === "number") {
          setDefaultPoolRadius(g.default_pool_radius);
        } else if (matched) {
          setDefaultPoolRadius(matched.radiusMeters);
        }
      }
      if (g.default_duration_minutes) setDuration(String(g.default_duration_minutes));
      if (g.admin_email) setAdminEmail(g.admin_email as string);
      if (g.late_threshold_minutes !== undefined) setLateThreshold(String(g.late_threshold_minutes));
      if (g.excuse_cutoff_minutes !== undefined) setExcuseCutoff(String(g.excuse_cutoff_minutes));
    }
  }, [initialSettings]);

  // Full JSON Database Backup Export from live server
  async function handleExportJSON() {
    setIsExporting(true);
    try {
      const res = await exportDatabaseBackupAction();
      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to export database backup.");
        return;
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(res.data, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute(
        "download",
        `swimtrack_backup_${new Date().toISOString().split("T")[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Full JSON database backup downloaded from live server.");
    } catch {
      toast.error("Failed to generate backup.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveGeneral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSavingGeneral(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await updateGeneralPreferencesAction(formData);
      if (res.success) {
        toast.success("Facility and club preferences updated successfully!");
      } else {
        toast.error(res.error || "Failed to update preferences.");
      }
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setIsSavingGeneral(false);
    }
  }

  async function handleResetDemo() {
    if (confirm("Reset database to initial demonstration dataset?")) {
      setIsResettingDemo(true);
      try {
        const res = await resetToDemoAction();
        if (res.success) {
          toast.info("Database reset to demo state.");
          window.location.reload();
        } else {
          toast.error(res.error || "Failed to reset demo dataset.");
        }
      } catch {
        toast.error("Failed to reset demo dataset.");
      } finally {
        setIsResettingDemo(false);
      }
    }
  }

  async function handleWipeAllData() {
    const confirmation = prompt(
      'Type "WIPE" to permanently delete all sample swimmers, sessions, and attendance records for a fresh production start:'
    );
    if (confirmation === "WIPE") {
      const res = await wipeAllDataAction();
      if (res.success) {
        toast.success("Database wiped clean! Starting fresh production slate.");
        window.location.href = "/dashboard";
      } else {
        toast.error(res.error || "Failed to wipe data.");
      }
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          System & Club Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure pool preferences, email automation, security credentials, and data backups.
        </p>
      </div>

      {/* Connection & Service Health Status */}
      <div className="p-5 rounded-3xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Activity className="w-4 h-4 text-aqua" />
          <h2 className="font-bold text-sm text-foreground">Platform Infrastructure Health</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between">
            <div>
              <div className="text-muted-foreground font-medium">Database Store</div>
              <div className="font-bold text-foreground mt-0.5">PostgreSQL / Supabase</div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-seafoam animate-pulse" />
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between">
            <div>
              <div className="text-muted-foreground font-medium">Email Dispatch</div>
              <div className="font-bold text-foreground mt-0.5">Resend + React Email</div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-seafoam animate-pulse" />
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between">
            <div>
              <div className="text-muted-foreground font-medium">Cron Scheduler</div>
              <div className="font-bold text-foreground mt-0.5">Vercel Cron (Daily)</div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-seafoam animate-pulse" />
          </div>
        </div>
      </div>

      {/* General Settings Section */}
      <form onSubmit={handleSaveGeneral} className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Settings className="w-4 h-4 text-aqua" />
          <h2 className="font-bold text-sm text-foreground">General Preferences</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Swimming Group / Club Name
            </label>
            <input
              type="text"
              name="group_name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-foreground">
                Default Facility / Pool
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
              type="text"
              name="default_pool"
              value={defaultPool}
              onChange={(e) => {
                const val = e.target.value;
                setDefaultPool(val);
                const matched = matchKnownVenueByName(val);
                if (matched) {
                  setDefaultPoolLat(matched.latitude);
                  setDefaultPoolLng(matched.longitude);
                  setDefaultPoolRadius(matched.radiusMeters);
                }
              }}
              placeholder={`e.g. ${DEFAULT_VENUE.name}`}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
            <input type="hidden" name="default_pool_latitude" value={defaultPoolLat} />
            <input type="hidden" name="default_pool_longitude" value={defaultPoolLng} />
            <input type="hidden" name="default_pool_radius" value={defaultPoolRadius} />

            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <MapPin className="w-3 h-3 text-aqua shrink-0" />
                  <span>
                    {defaultPoolLat.toFixed(4)}, {defaultPoolLng.toFixed(4)} ({defaultPoolRadius}m geofence)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="text-aqua font-bold text-[10px] hover:underline"
                >
                  Change Pin &rarr;
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {PRESET_VENUES.map((venue) => (
                  <button
                    key={venue.key}
                    type="button"
                    onClick={() => {
                      setDefaultPool(venue.name);
                      setDefaultPoolLat(venue.latitude);
                      setDefaultPoolLng(venue.longitude);
                      setDefaultPoolRadius(venue.radiusMeters);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all",
                      Math.abs(defaultPoolLat - venue.latitude) < 0.0002 &&
                        Math.abs(defaultPoolLng - venue.longitude) < 0.0002
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

              <label className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="apply_to_upcoming_sessions"
                  checked={applyToUpcoming}
                  onChange={(e) => setApplyToUpcoming(e.target.checked)}
                  className="rounded border-border text-aqua focus:ring-aqua"
                />
                <span>Also update pool location &amp; GPS pin on all upcoming scheduled sessions</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Default Practice Duration (minutes)
            </label>
            <input
              type="number"
              name="default_duration_minutes"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Timezone (Configured in Vercel & Supabase)
            </label>
            <input
              type="text"
              disabled
              value={timezone}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/20 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Late After (minutes past start)
            </label>
            <input
              type="number"
              name="late_threshold_minutes"
              min={0}
              max={120}
              value={lateThreshold}
              onChange={(e) => setLateThreshold(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              A GPS check-in later than this counts as Late instead of Present.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Excuse Cut-off (minutes before start)
            </label>
            <input
              type="number"
              name="excuse_cutoff_minutes"
              min={0}
              max={1440}
              value={excuseCutoff}
              onChange={(e) => setExcuseCutoff(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Swimmers can self-report an excuse until this long before practice. You get an email each time.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-foreground mb-1">
              Admin Alert Email (New Swimmer Registration Notifications)
            </label>
            <input
              type="email"
              name="admin_email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Instant email notification dispatched to this address whenever a swimmer self-registers via the invite portal or joins the squad.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSavingGeneral}
            className="px-5 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingGeneral ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-ocean-950 border-t-transparent rounded-full animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>
      </form>

      {/* Appearance & Themes */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Palette className="w-4 h-4 text-aqua" />
          <h2 className="font-bold text-sm text-foreground">Theme & Visual Experience</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-foreground">Theme Selection</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose between the signature &ldquo;Aquatic Dark Control Room&rdquo;, light pool theme, or system sync.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Security & Administrator Account */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Shield className="w-4 h-4 text-aqua" />
          <h2 className="font-bold text-sm text-foreground">Single-Administrator Security</h2>
        </div>

        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            SwimTrack strictly operates as a single-admin application. Swimmers do not need passwords or accounts.
          </p>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border font-mono text-[11px] text-foreground">
            Allowlisted Admin: <strong>admin@example.com</strong>
          </div>
        </div>

        <div className="pt-2">
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Administrator Session</span>
            </button>
          </form>
        </div>
      </div>

      {/* Data Backups & Reset */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Database className="w-4 h-4 text-aqua" />
          <h2 className="font-bold text-sm text-foreground">Data Management & Backups</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-xs font-bold text-foreground">Full JSON Database Backup</div>
            <p className="text-xs text-muted-foreground">
              Download complete structured export of swimmers, session occurrences, attendance, and reminders.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-opacity"
          >
            <Download className="w-4 h-4 text-aqua" />
            <span>{isExporting ? "Exporting Backup..." : "Export Full Backup"}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
          <div>
            <div className="text-xs font-bold text-foreground">Reset Local Demo Data</div>
            <p className="text-xs text-muted-foreground">
              Restore initial synthetic demo dataset for evaluation.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isResettingDemo}
            className="px-3.5 py-2 rounded-xl border border-coral/30 bg-coral/10 hover:bg-coral/20 text-coral font-semibold text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isResettingDemo ? "Resetting..." : "Reset Demo Store"}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-destructive/20 bg-destructive/5 -mx-6 -mb-4 p-6 rounded-b-3xl">
          <div>
            <div className="text-xs font-bold text-destructive">Wipe All Data (Fresh Clean Slate)</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete all sample swimmers, sessions, and attendance records so you can start 100% fresh.
            </p>
          </div>

          <button
            type="button"
            onClick={handleWipeAllData}
            className="px-4 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe All Data & Start Fresh</span>
          </button>
        </div>
      </div>
      {/* Interactive Default Pool Map Picker Modal */}
      {showMapPicker && (
        <MapLocationPickerModal
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          title="Select Default Facility / Pool on Map"
          confirmLabel={`Set Default Pool (${defaultPoolRadius}m)`}
          initialLocation={{
            name: defaultPool,
            latitude: defaultPoolLat,
            longitude: defaultPoolLng,
            radiusMeters: defaultPoolRadius,
          }}
          onSelectLocation={(data) => {
            setDefaultPool(data.name);
            setDefaultPoolLat(data.latitude);
            setDefaultPoolLng(data.longitude);
            setDefaultPoolRadius(data.radiusMeters);
            toast.success(
              `Default pool pin set to ${data.name} (${data.radiusMeters}m). Click "Save Preferences" to apply!`
            );
          }}
        />
      )}
    </div>
  );
}

