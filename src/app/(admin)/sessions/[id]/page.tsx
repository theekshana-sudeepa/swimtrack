import * as React from "react";
import { notFound } from "next/navigation";
import { DataStore } from "@/lib/data-store";
import { getMemoriesWithSignedUrls } from "@/lib/memories-service";
import { SessionStateReportClient } from "@/components/sessions/session-state-report-client";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await DataStore.syncFromSupabase();
  const resolvedParams = await params;
  const session = DataStore.getSessionById(resolvedParams.id);

  if (!session) {
    notFound();
  }

  const attendance = DataStore.getSessionAttendance(session.id);
  const eligibleReminders = DataStore.getEligibleReminderRecipients(session.id);
  const swimmers = DataStore.getSwimmers({ status: "all" });
  const savedVenues = DataStore.getSavedVenues();
  const { memories } = await getMemoriesWithSignedUrls();
  const sessionMemory = memories.find((m) => m.memory_date === session.date) || null;

  return (
    <SessionStateReportClient
      session={session}
      attendance={attendance}
      swimmers={swimmers}
      eligibleRemindersCount={eligibleReminders.length}
      savedVenues={savedVenues}
      initialSessionMemory={sessionMemory}
    />
  );
}
