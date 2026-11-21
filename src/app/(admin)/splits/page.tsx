import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { getExpensesFresh } from "@/lib/expenses-service";
import { AdminSplitsClient } from "@/components/splits/admin-splits-client";

export const dynamic = "force-dynamic";

export default async function AdminSplitsPage() {
  await DataStore.syncFromSupabase();
  const { expenses, migrationNeeded } = await getExpensesFresh();
  const swimmers = DataStore.getSwimmers({ status: "all" });
  const sessions = DataStore.getSessions({ status: "all" });

  const attendeesByDate: Record<string, string[]> = {};
  for (const sess of sessions) {
    const ids = DataStore.getAttendeesForDate(sess.date, sess.id).map((a) => a.id);
    if (ids.length > 0) attendeesByDate[sess.date] = ids;
  }

  return (
    <AdminSplitsClient
      initialExpenses={expenses}
      swimmers={swimmers}
      sessions={sessions}
      attendeesByDate={attendeesByDate}
      migrationNeeded={migrationNeeded}
    />
  );
}
