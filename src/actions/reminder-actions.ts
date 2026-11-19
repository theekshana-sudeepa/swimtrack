"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import {
  sendSessionReminder,
  sendWelcomeEmail,
  sendAdminNewSwimmerAlert,
  sendSwimmerPassSetupEmail,
} from "@/lib/resend-service";

export async function sendManualSessionRemindersAction(
  sessionId: string,
  swimmerIds: string[],
  customMessage?: string,
  isDryRun = false
) {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { error: "Session not found." };
  }
  if (session.status !== "scheduled" || session.is_finalized) {
    return {
      error: "Reminders can only be sent for active scheduled sessions (not completed or cancelled sessions).",
    };
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
  if (session.status !== "scheduled" || session.is_finalized) {
    return {
      error: "Reminders can only be sent for active scheduled sessions (not completed or cancelled sessions).",
    };
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

export async function sendTestPassSetupEmailAction(testEmail: string) {
  await requireAdminSession();

  const mockSwimmer = {
    id: "test-setup-swimmer",
    full_name: "Test Squad Swimmer",
    nickname: "Aqua Cadet",
    email: testEmail.trim(),
    join_date: new Date().toISOString().split("T")[0],
    status: "active" as const,
    reminder_preferences: {
      id: "pref-test-setup",
      swimmer_id: "test-setup-swimmer",
      email_reminders_enabled: true,
      opt_out_token: "demo_pass_token",
    },
  };

  const res = await sendSwimmerPassSetupEmail({ swimmer: mockSwimmer });
  revalidatePath("/reminders");
  return res;
}

export async function sendSwimmerPassSetupEmailAction(swimmerId: string) {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  const swimmer = DataStore.getSwimmerById(swimmerId);
  if (!swimmer) {
    return { success: false, error: "Swimmer not found." };
  }

  if (!swimmer.email || !swimmer.email.includes("@")) {
    return { success: false, error: "This swimmer does not have a valid email address configured." };
  }

  const res = await sendSwimmerPassSetupEmail({ swimmer });
  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${swimmerId}`);
  revalidatePath("/reminders");

  return res;
}

export async function sendAllSwimmersPassSetupEmailAction() {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  const activeSwimmers = DataStore.getSwimmers({ status: "active" }).filter(
    (s) => s.email && s.email.includes("@")
  );

  if (activeSwimmers.length === 0) {
    return { success: false, error: "No active swimmers with configured emails found." };
  }

  const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

  for (const swimmer of activeSwimmers) {
    try {
      const res = await sendSwimmerPassSetupEmail({ swimmer });
      results.push({
        id: swimmer.id,
        name: swimmer.nickname || swimmer.full_name,
        success: res.success,
        error: res.error,
      });
    } catch (err: unknown) {
      results.push({
        id: swimmer.id,
        name: swimmer.nickname || swimmer.full_name,
        success: false,
        error: err instanceof Error ? err.message : "Delivery failed",
      });
    }
  }

  revalidatePath("/swimmers");
  revalidatePath("/reminders");

  const sentCount = results.filter((r) => r.success).length;
  return {
    success: true,
    sentCount,
    totalCount: activeSwimmers.length,
    results,
  };
}


export async function sendTestAdminAlertAction(testEmail?: string) {
  await requireAdminSession();

  const mockSwimmer = {
    id: "test-new-swimmer",
    full_name: "Kasun Perera",
    nickname: "Snooze Captain",
    email: "kasun@example.test",
    phone: "+94 77 123 4567",
    join_date: new Date().toISOString().split("T")[0],
    status: "active" as const,
  };

  const res = await sendAdminNewSwimmerAlert({
    swimmer: mockSwimmer,
    overrideAdminEmail: testEmail?.trim() || undefined,
  });

  revalidatePath("/reminders");
  return res;
}


