import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { ReminderClient } from "@/components/reminders/reminder-client";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  await DataStore.syncFromSupabase();
  const resolvedParams = await searchParams;
  const sessions = DataStore.getSessions({ status: "all" });
  const swimmers = DataStore.getSwimmers({ status: "active" });
  const deliveries = DataStore.getReminderDeliveries(20);

  return (
    <ReminderClient
      sessions={sessions}
      deliveries={deliveries}
      swimmers={swimmers}
      initialSelectedSessionId={resolvedParams.session}
    />
  );
}

