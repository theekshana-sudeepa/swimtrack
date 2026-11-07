import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { ReminderClient } from "@/components/reminders/reminder-client";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const resolvedParams = await searchParams;
  const sessions = DataStore.getSessions({ status: "all" });
  const deliveries = DataStore.getReminderDeliveries(20);

  return (
    <ReminderClient
      sessions={sessions}
      deliveries={deliveries}
      initialSelectedSessionId={resolvedParams.session}
    />
  );
}

