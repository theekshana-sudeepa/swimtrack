import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { SessionListClient } from "@/components/sessions/session-list-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await DataStore.syncFromSupabase();
  const sessions = DataStore.getSessions({ status: "all" });
  const settings = DataStore.getAppSettings();
  const generalVal = settings.general?.value as
    | { default_pool?: string; default_duration_minutes?: number }
    | undefined;

  const defaultPool = generalVal?.default_pool || "Bandaranayake College Swimming Pool Complex";
  const defaultDuration = Number(generalVal?.default_duration_minutes) || 105;

  return (
    <SessionListClient
      initialSessions={sessions}
      defaultPool={defaultPool}
      defaultDuration={defaultDuration}
    />
  );
}

