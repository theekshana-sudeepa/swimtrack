"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { sendSessionReminder, sendWelcomeEmail } from "@/lib/resend-service";

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

export async function sendTestWelcomeEmailAction(testEmail: string) {
  await requireAdminSession();

  const mockSwimmer = {
    id: "test-welcome-swimmer",
    full_name: "Test Squad Swimmer",
    nickname: "Aqua Cadet",
    email: testEmail.trim(),
    join_date: new Date().toISOString().split("T")[0],
    status: "active" as const,
    reminder_preferences: {
      id: "pref-test-welcome",
      swimmer_id: "test-welcome-swimmer",
      email_reminders_enabled: true,
      opt_out_token: "demo_pass_token",
    },
  };

  const res = await sendWelcomeEmail({ swimmer: mockSwimmer });
  revalidatePath("/reminders");
  return res;
}

