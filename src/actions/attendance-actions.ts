"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { AttendanceStatus } from "@/types/database";
import { sanitizeString, sanitizeEmail, sanitizePhone } from "@/lib/security";

export async function updateAttendanceStatusAction(
  sessionId: string,
  swimmerId: string,
  status: AttendanceStatus,
  notes?: string
) {
  try {
    const admin = await requireAdminSession();
    const cleanNotes = notes ? sanitizeString(notes, 500) : undefined;

    // Ensure serverless lambda instance has fresh session & swimmer state from Supabase
    await DataStore.syncFromSupabase();

    const result = DataStore.updateAttendanceStatus(
      sessionId,
      swimmerId,
      status,
      cleanNotes,
      admin.id
    );

    // Persist directly to Supabase Postgres database & audit trail
    await SupabaseDB.upsertAttendance(result.record, admin.id, cleanNotes);

    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/swimmers/${swimmerId}`);
    revalidatePath("/dashboard");
    revalidatePath("/analytics");

    return { success: true, ...result };
  } catch (err) {
    console.error("[updateAttendanceStatusAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update attendance status.",
    };
  }
}

export async function markAllPresentAction(sessionId: string) {
  try {
    const admin = await requireAdminSession();
    await DataStore.syncFromSupabase();

    const count = DataStore.markAllPresent(sessionId, admin.id);

    // Batch sync updated records to Supabase in a single transaction
    const records = DataStore.getSessionAttendance(sessionId).filter((r) => r.status === "present");
    await SupabaseDB.bulkUpsertAttendance(records, admin.id, "Bulk marked present");

    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/dashboard");

    return { success: true, count };
  } catch (err) {
    console.error("[markAllPresentAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark all present.",
    };
  }
}

export async function markRemainingAbsentAction(sessionId: string) {
  try {
    const admin = await requireAdminSession();
    await DataStore.syncFromSupabase();

    const count = DataStore.markRemainingAbsent(sessionId, admin.id);

    // Batch sync updated records to Supabase in a single transaction
    const records = DataStore.getSessionAttendance(sessionId).filter((r) => r.status === "absent");
    await SupabaseDB.bulkUpsertAttendance(records, admin.id, "Bulk marked absent for remaining un-marked");

    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/dashboard");

    return { success: true, count };
  } catch (err) {
    console.error("[markRemainingAbsentAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark remaining absent.",
    };
  }
}

/**
 * Add a swimmer one by one directly from the attendance deck
 * and immediately set their attendance status (present, late, absent, excused).
 */
export async function addSwimmerToSessionAction(
  sessionId: string,
  swimmerData: {
    full_name: string;
    nickname?: string;
    email?: string;
    phone?: string;
    status: AttendanceStatus;
    notes?: string;
  }
) {
  try {
    const admin = await requireAdminSession();
    await DataStore.syncFromSupabase();

    const session = DataStore.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found." };
    }

    const cleanName = sanitizeString(swimmerData.full_name, 100);
    const cleanNickname = sanitizeString(swimmerData.nickname, 50) || undefined;
    const cleanEmail = sanitizeEmail(swimmerData.email) || undefined;
    const cleanPhone = sanitizePhone(swimmerData.phone) || undefined;
    const cleanNotes = sanitizeString(swimmerData.notes, 500) || undefined;

    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: "Please enter a valid swimmer name (at least 2 characters)." };
    }

    // 1. Check if swimmer already exists
    const existingList = DataStore.getSwimmers({ status: "all" });
    let swimmer = cleanEmail
      ? existingList.find((s) => s.email && s.email.toLowerCase() === cleanEmail.toLowerCase())
      : null;

    if (!swimmer) {
      swimmer = existingList.find((s) => s.full_name.toLowerCase() === cleanName.toLowerCase());
    }

    if (!swimmer) {
      // 2. Create new swimmer
      swimmer = DataStore.createSwimmer({
        full_name: cleanName,
        nickname: cleanNickname,
        email: cleanEmail,
        phone: cleanPhone,
        notes: cleanNotes,
        email_reminders_enabled: cleanEmail ? true : false,
      });
      await SupabaseDB.insertSwimmer(swimmer);
    }

    // 3. Mark attendance status for this session
    const result = DataStore.updateAttendanceStatus(
      sessionId,
      swimmer.id,
      swimmerData.status || "present",
      cleanNotes,
      admin.id
    );

    await SupabaseDB.upsertAttendance(
      result.record,
      admin.id,
      cleanNotes || "Added directly to session register"
    );

    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/dashboard");
    revalidatePath("/swimmers");

    return { success: true, swimmer, record: result.record };
  } catch (err) {
    console.error("[addSwimmerToSessionAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add swimmer to session.",
    };
  }
}

/**
 * Ensures all active squad swimmers are enrolled into this session's attendance register.
 */
export async function syncAllActiveSwimmersToSessionAction(sessionId: string) {
  try {
    const admin = await requireAdminSession();
    await DataStore.syncFromSupabase();

    const session = DataStore.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found." };
    }

    const activeSwimmers = DataStore.getSwimmers({ status: "active" });
    const records = DataStore.getSessionAttendance(sessionId);
    const existingSwimmerIds = new Set(records.map((r) => r.swimmer_id));
    const newRecords = [];

    for (const sw of activeSwimmers) {
      if (!existingSwimmerIds.has(sw.id)) {
        const result = DataStore.updateAttendanceStatus(
          sessionId,
          sw.id,
          "not_marked",
          undefined,
          admin.id
        );
        newRecords.push(result.record);
      }
    }

    if (newRecords.length > 0) {
      await SupabaseDB.bulkUpsertAttendance(newRecords, admin.id, "Auto-enrolled into session");
    }

    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/dashboard");

    return { success: true, count: newRecords.length };
  } catch (err) {
    console.error("[syncAllActiveSwimmersToSessionAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sync squad swimmers.",
    };
  }
}
