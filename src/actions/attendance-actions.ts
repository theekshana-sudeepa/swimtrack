"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
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

  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return { success: true, count };
}

export async function markRemainingAbsentAction(sessionId: string) {
  const admin = await requireAdminSession();
  const count = DataStore.markRemainingAbsent(sessionId, admin.id);

  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return { success: true, count };
}
