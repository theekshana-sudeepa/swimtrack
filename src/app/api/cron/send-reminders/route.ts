import { NextRequest, NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { sendSessionReminder } from "@/lib/resend-service";
import { timingSafeMatch } from "@/lib/security";

export async function GET(request: NextRequest) {
  // 1. Verify Vercel Cron Secret authorization with timing-safe comparison
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && (!authHeader || !timingSafeMatch(authHeader, `Bearer ${expectedSecret}`))) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET authorization." },
      { status: 401 }
    );
  }

  // 2. Identify tomorrow's sessions (next 24-36 hours)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowDateStr = tomorrow.toISOString().split("T")[0];

  // Retrieve upcoming scheduled sessions
  const scheduledSessions = DataStore.getSessions({
    status: "scheduled",
    fromDate: tomorrowDateStr,
    toDate: tomorrowDateStr,
  });

  const results = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const session of scheduledSessions) {
    // Only send for scheduled sessions (skip cancelled)
    if (session.status !== "scheduled") continue;

    const eligibleSwimmers = DataStore.getEligibleReminderRecipients(session.id);

    for (const swimmer of eligibleSwimmers) {
      const res = await sendSessionReminder({
        session,
        swimmer,
        reminderType: "upcoming",
      });

      if (res.status === "sent") sentCount++;
      else if (res.status === "skipped") skippedCount++;
      else if (res.status === "failed") failedCount++;

      results.push(res);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    sessionsChecked: scheduledSessions.length,
    processed: results.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    details: results,
  });
}

