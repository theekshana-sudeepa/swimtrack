import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { SessionListClient } from "@/components/sessions/session-list-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await DataStore.syncFromSupabase();
  const sessions = DataStore.getSessions({ status: "all" });

  return <SessionListClient initialSessions={sessions} />;
}

