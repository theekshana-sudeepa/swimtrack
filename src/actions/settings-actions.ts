"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { sanitizeString, sanitizeEmail } from "@/lib/security";
import { DEFAULT_GEOFENCE_RADIUS_METERS, DEFAULT_VENUE, matchKnownVenueByName } from "@/lib/geo-fence";
import {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  ReminderDelivery,
  AppSetting,
  SessionSeries,
  PoolVenue,
} from "@/types/database";

/**
 * Wipes all demo/test attendance records, sessions, and swimmers
 * to give the user a 100% fresh clean slate in production.
 */
export async function wipeAllDataAction(): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  try {
    // 1. Clear in-memory / local data store
    DataStore.clearAllData();

    // 2. Clear Supabase tables if connected
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      // Cascading clean
      await supabase.from("attendance_audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("reminder_deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("session_participants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("swim_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("session_series").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("reminder_preferences").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("swimmers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    revalidatePath("/dashboard");
    revalidatePath("/swimmers");
    revalidatePath("/sessions");
    revalidatePath("/attendance");
    revalidatePath("/analytics");
    revalidatePath("/calendar");
    revalidatePath("/reminders");
    revalidatePath("/settings");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to wipe database records";
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates General Preferences (Facility / Pool, Club Name, Duration).
 * Persists to DataStore and Supabase app_settings.
 */
export async function updateGeneralPreferencesAction(formData: FormData): Promise<{
  success: boolean;
  venues?: PoolVenue[];
  error?: string;
}> {
  await requireAdminSession();

  const group_name = sanitizeString(formData.get("group_name") as string, 100) || "SwimTrack Club";
  const default_pool =
    sanitizeString(formData.get("default_pool") as string, 150) ||
    DEFAULT_VENUE.name;
  const default_duration_minutes = Math.max(
    15,
    Math.min(
      360,
      parseInt((formData.get("default_duration_minutes") as string) || "105", 10) || 105
    )
  );
  const admin_email =
    sanitizeEmail(formData.get("admin_email") as string) ||
    process.env.ADMIN_EMAIL?.trim() ||
    "admin@example.com";
  const clampInt = (raw: FormDataEntryValue | null, fallback: number, min: number, max: number) => {
    const n = parseInt(String(raw ?? ""), 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const late_threshold_minutes = clampInt(formData.get("late_threshold_minutes"), 10, 0, 120);
  const excuse_cutoff_minutes = clampInt(formData.get("excuse_cutoff_minutes"), 60, 0, 24 * 60);
  const applyToUpcoming = formData.get("apply_to_upcoming_sessions") === "on";

  try {
    await DataStore.syncFromSupabase();

    const savedVenues = DataStore.getSavedVenues();
    const matchedVenue = matchKnownVenueByName(default_pool, savedVenues);
    const rawLat = parseFloat(String(formData.get("default_pool_latitude") ?? ""));
    const rawLng = parseFloat(String(formData.get("default_pool_longitude") ?? ""));

    if ((!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) && !matchedVenue) {
      return {
        success: false,
        error:
          'Please pin your new default pool on the map ("Select on Map") so its exact GPS coordinates are verified.',
      };
    }

    const default_pool_latitude = Number.isFinite(rawLat)
      ? Math.max(-90, Math.min(90, Number(rawLat.toFixed(6))))
      : matchedVenue!.latitude;
    const default_pool_longitude = Number.isFinite(rawLng)
      ? Math.max(-180, Math.min(180, Number(rawLng.toFixed(6))))
      : matchedVenue!.longitude;
    const default_pool_radius = clampInt(
      formData.get("default_pool_radius"),
      matchedVenue?.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
      25,
      250
    );

    const generalPayload = {
      group_name,
      default_pool,
      default_pool_latitude,
      default_pool_longitude,
      default_pool_radius,
      default_duration_minutes,
      admin_email,
      late_threshold_minutes,
      excuse_cutoff_minutes,
      timezone: "Asia/Colombo",
    };

    DataStore.updateAppSetting("general", generalPayload);

    // Keep the coach's saved swimming places synchronized with the selected default pool
    const defaultVenue = DataStore.ensureVenueSaved({
      name: default_pool,
      latitude: default_pool_latitude,
      longitude: default_pool_longitude,
      radius_meters: default_pool_radius,
      is_default: true,
    });
    const updatedVenues = DataStore.getSavedVenues();

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error: settingsError } = await supabase.from("app_settings").upsert({
        key: "general",
        value: generalPayload,
        updated_at: new Date().toISOString(),
      });
      if (settingsError) {
        console.error("[updateGeneralPreferencesAction] Supabase upsert error:", settingsError);
      }
    }
    await SupabaseDB.syncVenues(updatedVenues);

    if (applyToUpcoming) {
      const scheduledSessions = DataStore.getSessions({ status: "scheduled" }).filter(
        (s) => !s.is_finalized
      );
      for (const sess of scheduledSessions) {
        const updated = DataStore.updateSession(sess.id, {
          location: default_pool,
          venue_id: defaultVenue.id,
          latitude: default_pool_latitude,
          longitude: default_pool_longitude,
          geofence_radius: default_pool_radius,
        });
        if (updated) {
          await SupabaseDB.upsertSession(updated);
        }
      }
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/sessions");
    revalidatePath("/attendance");
    revalidatePath("/portal");

    return { success: true, venues: updatedVenues };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update preferences";
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates Reminder Automation Preferences.
 * Persists to DataStore and Supabase app_settings.
 */
export async function updateReminderPreferencesSettingAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdminSession();

  const auto_reminders_enabled = formData.get("auto_reminders_enabled") === "on";
  const reminder_hours_before = parseInt(
    (formData.get("reminder_hours_before") as string) || "24",
    10
  );
  const default_message = (formData.get("default_message") as string)?.trim() || "";

  try {
    DataStore.updateAppSetting("reminders", {
      auto_reminders_enabled,
      reminder_hours_before,
      default_message,
    });

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase.from("app_settings").upsert({
        key: "reminders",
        value: {
          auto_reminders_enabled,
          reminder_hours_before,
          default_message,
        },
        updated_at: new Date().toISOString(),
      });
    }

    revalidatePath("/settings");
    revalidatePath("/reminders");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update reminder settings";
    return { success: false, error: errorMsg };
  }
}

/**
 * Generates a full JSON database backup from the latest synchronized state.
 */
export async function exportDatabaseBackupAction(): Promise<{
  success: boolean;
  data?: {
    swimmers: Swimmer[];
    sessions: SwimSession[];
    series: SessionSeries[];
    attendance: AttendanceRecord[];
    reminders: ReminderDelivery[];
    venues: PoolVenue[];
    settings: Record<string, AppSetting>;
    exportedAt: string;
    version: string;
  };
  error?: string;
}> {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  try {
    const backup = {
      swimmers: DataStore.getSwimmers({ status: "all" }),
      sessions: DataStore.getSessions({ status: "all" }),
      series: DataStore.getSeries(),
      attendance: DataStore.getAllAttendance(),
      reminders: DataStore.getReminderDeliveries(100),
      venues: DataStore.getSavedVenues(),
      settings: DataStore.getAppSettings(),
      exportedAt: new Date().toISOString(),
      version: "3.0.0",
    };

    return { success: true, data: backup };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to export database backup.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Resets local database state to initial demo dataset.
 */
export async function resetToDemoAction(): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();

  try {
    DataStore.resetToDemo();

    revalidatePath("/dashboard");
    revalidatePath("/swimmers");
    revalidatePath("/sessions");
    revalidatePath("/attendance");
    revalidatePath("/analytics");
    revalidatePath("/calendar");
    revalidatePath("/reminders");
    revalidatePath("/settings");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset demo dataset.";
    return { success: false, error: errorMsg };
  }
}

