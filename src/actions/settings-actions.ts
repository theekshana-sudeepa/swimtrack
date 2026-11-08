"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { sanitizeString, sanitizeEmail } from "@/lib/security";

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
  error?: string;
}> {
  await requireAdminSession();

  const group_name = sanitizeString(formData.get("group_name") as string, 100) || "SwimTrack Club";
  const default_pool =
    sanitizeString(formData.get("default_pool") as string, 150) ||
    "Bandaranayake College Swimming Pool Complex";
  const default_duration_minutes = Math.max(
    15,
    Math.min(
      360,
      parseInt((formData.get("default_duration_minutes") as string) || "105", 10) || 105
    )
  );
  const admin_email =
    sanitizeEmail(formData.get("admin_email") as string) || "theekshanasudeepa4@gmail.com";

  try {
    DataStore.updateAppSetting("general", {
      group_name,
      default_pool,
      default_duration_minutes,
      admin_email,
      timezone: "Asia/Colombo",
    });

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase.from("app_settings").upsert({
        key: "general",
        value: {
          group_name,
          default_pool,
          default_duration_minutes,
          admin_email,
          timezone: "Asia/Colombo",
        },
        updated_at: new Date().toISOString(),
      });
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/sessions");

    return { success: true };
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

