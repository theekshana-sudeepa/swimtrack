"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { AttendanceStatus } from "@/types/database";

export async function updateAttendanceStatusAction(
  sessionId: string,
  swimmerId: string,
  status: AttendanceStatus,
  notes?: string
) {
  const admin = await requireAdminSession();

  const result = DataStore.updateAttendanceStatus(
    sessionId,
    swimmerId,
    status,
    notes,
    admin.id
  );

  // Persist directly to Supabase Postgres database & audit trail
  await SupabaseDB.upsertAttendance(result.record, admin.id, notes);

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

