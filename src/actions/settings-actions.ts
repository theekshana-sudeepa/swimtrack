"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { getSupabaseAdminClient } from "@/lib/supabase-client";

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
