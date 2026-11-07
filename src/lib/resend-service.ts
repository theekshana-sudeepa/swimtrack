import { Resend } from "resend";
import * as React from "react";
import { Swimmer, SwimSession } from "@/types/database";
import { DataStore } from "./data-store";
import UpcomingSessionEmail from "@/emails/upcoming-session";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_123456789") || apiKey.includes("your-key")) {
    return null;
  }
  return new Resend(apiKey);
}

export interface SendReminderResult {
  recipient: string;
  claimKey: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  error?: string;
}

export async function sendSessionReminder({
  session,
  swimmer,
  reminderType = "upcoming",
  customMessage,
  isDryRun = false,
}: {
  session: SwimSession;
  swimmer: Swimmer;
  reminderType?: "upcoming" | "today" | "changed" | "cancelled" | "manual";
  customMessage?: string;
  isDryRun?: boolean;
}): Promise<SendReminderResult> {
  const claimKey = `${session.id}:${swimmer.id}:${reminderType}:${session.date}`;

  // 1. Consent and validity check
  if (!swimmer.email || !swimmer.email.includes("@")) {
    return {
      recipient: swimmer.email || "unknown",
      claimKey,
      status: "skipped",
      error: "Swimmer has no valid email address.",
    };
  }

  if (swimmer.reminder_preferences && !swimmer.reminder_preferences.email_reminders_enabled) {
    return {
      recipient: swimmer.email,
      claimKey,
      status: "skipped",
      error: "Swimmer has opted out or disabled email reminders.",
    };
  }

  // 2. Duplicate protection check
  if (DataStore.hasReminderBeenSent(claimKey)) {
    return {
      recipient: swimmer.email,
      claimKey,
      status: "skipped",
      error: `Reminder already sent for claim key: ${claimKey}`,
    };
  }

  if (isDryRun) {
    return {
      recipient: swimmer.email,
      claimKey,
      status: "sent",
      providerMessageId: "dry_run_simulation",
    };
  }

  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL || "SwimTrack <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const optOutUrl = `${appUrl}/reminders/opt-out?token=${swimmer.reminder_preferences?.opt_out_token || "general"}`;

  // If no live Resend API key is configured (local dev/demo), simulate successful send cleanly
  if (!resend) {
    const simulatedMsgId = `sim_resend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    DataStore.recordReminderDelivery({
      claim_key: claimKey,
      session_id: session.id,
      swimmer_id: swimmer.id,
      reminder_type: reminderType,
      recipient_email: swimmer.email,
      status: "sent",
      provider_message_id: simulatedMsgId,
    });

    return {
      recipient: swimmer.email,
      claimKey,
      status: "sent",
      providerMessageId: simulatedMsgId,
    };
  }

  // Live Resend API call with React Email
  try {
    const emailElement = React.createElement(UpcomingSessionEmail, {
      swimmerName: swimmer.nickname || swimmer.full_name,
      sessionTitle: session.title,
      dateStr: session.date,
      timeStr: `${session.start_time} - ${session.end_time}`,
      location: session.location,
      customMessage: customMessage || undefined,
      optOutUrl,
    });

    const { data, error } = await resend.emails.send(
      {
        from: fromEmail,
        to: [swimmer.email],
        subject: `🏊 Reminder: ${session.title} (${session.date})`,
        react: emailElement,
        headers: {
          "X-Entity-Ref-ID": claimKey,
        },
      },
      {
        idempotencyKey: `swimtrack/${claimKey}`,
      }
    );

    if (error) {
      DataStore.recordReminderDelivery({
        claim_key: claimKey,
        session_id: session.id,
        swimmer_id: swimmer.id,
        reminder_type: reminderType,
        recipient_email: swimmer.email,
        status: "failed",
        error_message: error.message,
      });

      return {
        recipient: swimmer.email,
        claimKey,
        status: "failed",
        error: error.message,
      };
    }

    DataStore.recordReminderDelivery({
      claim_key: claimKey,
      session_id: session.id,
      swimmer_id: swimmer.id,
      reminder_type: reminderType,
      recipient_email: swimmer.email,
      status: "sent",
      provider_message_id: data?.id,
    });

    return {
      recipient: swimmer.email,
      claimKey,
      status: "sent",
      providerMessageId: data?.id,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unexpected email transmission error";
    DataStore.recordReminderDelivery({
      claim_key: claimKey,
      session_id: session.id,
      swimmer_id: swimmer.id,
      reminder_type: reminderType,
      recipient_email: swimmer.email,
      status: "failed",
      error_message: errorMsg,
    });

    return {
      recipient: swimmer.email,
      claimKey,
      status: "failed",
      error: errorMsg,
    };
  }
}
