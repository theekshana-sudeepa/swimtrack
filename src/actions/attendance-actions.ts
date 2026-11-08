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
  const admin = await requireAdminSession();
  const cleanNotes = notes ? sanitizeString(notes, 500) : undefined;

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
}

export async function markAllPresentAction(sessionId: string) {
  const admin = await requireAdminSession();
  const count = DataStore.markAllPresent(sessionId, admin.id);

  // Sync updated records to Supabase
  const records = DataStore.getSessionAttendance(sessionId);
  for (const r of records) {
    if (r.status === "present") {
      await SupabaseDB.upsertAttendance(r, admin.id, "Bulk marked present");
    }
  }

  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return { success: true, count };
}

export async function markRemainingAbsentAction(sessionId: string) {
  const admin = await requireAdminSession();
  const count = DataStore.markRemainingAbsent(sessionId, admin.id);

  // Sync updated records to Supabase
  const records = DataStore.getSessionAttendance(sessionId);
  for (const r of records) {
    if (r.status === "absent") {
      await SupabaseDB.upsertAttendance(r, admin.id, "Bulk marked absent for remaining un-marked");
    }
  }

  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return { success: true, count };
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
  const admin = await requireAdminSession();

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
}

/**
 * Ensures all active squad swimmers are enrolled into this session's attendance register.
 */
export async function syncAllActiveSwimmersToSessionAction(sessionId: string) {
  const admin = await requireAdminSession();

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }

  const activeSwimmers = DataStore.getSwimmers({ status: "active" });
  let enrolledCount = 0;

  for (const sw of activeSwimmers) {
    const records = DataStore.getSessionAttendance(sessionId);
    const alreadyEnrolled = records.some((r) => r.swimmer_id === sw.id);
    if (!alreadyEnrolled) {
      const result = DataStore.updateAttendanceStatus(
        sessionId,
        sw.id,
        "not_marked",
        undefined,
        admin.id
      );
      await SupabaseDB.upsertAttendance(result.record, admin.id, "Auto-enrolled into session");
      enrolledCount++;
    }
  }

  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return { success: true, count: enrolledCount };
}
