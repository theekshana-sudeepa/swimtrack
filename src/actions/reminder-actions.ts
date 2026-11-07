"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { sendSessionReminder } from "@/lib/resend-service";

export async function sendManualSessionRemindersAction(
  sessionId: string,
  swimmerIds: string[],
  customMessage?: string,
  isDryRun = false
) {
  await requireAdminSession();

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { error: "Session not found." };
  }

  const results = [];
  for (const swimmerId of swimmerIds) {
    const swimmer = DataStore.getSwimmerById(swimmerId);
    if (!swimmer) continue;

    const res = await sendSessionReminder({
      session,
      swimmer,
      reminderType: "manual",
      customMessage,
      isDryRun,
    });
    results.push(res);
  }

  revalidatePath("/reminders");
  revalidatePath("/dashboard");

  return { success: true, results };
}

export async function sendTestReminderAction(sessionId: string, testEmail: string) {
  await requireAdminSession();

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { error: "Session not found." };
  }

  const mockSwimmer = {
    id: "test-recipient",
    full_name: "Test Administrator",
    nickname: "Admin",
    email: testEmail,
    join_date: "2026-01-01",
    status: "active" as const,
    reminder_preferences: {
      id: "pref-test",
      swimmer_id: "test-recipient",
      email_reminders_enabled: true,
    },
  };

  const res = await sendSessionReminder({
    session,
    swimmer: mockSwimmer,
    reminderType: "manual",
    customMessage: "This is a test preview message sent from the SwimTrack control room.",
  });

  revalidatePath("/reminders");
  return { success: true, result: res };
}

