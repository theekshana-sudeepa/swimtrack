import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { DEFAULT_VENUE } from "@/lib/geo-fence";
import { SessionListClient } from "@/components/sessions/session-list-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await DataStore.syncFromSupabase();
  const sessions = DataStore.getSessions({ status: "all" });
  const settings = DataStore.getAppSettings();
  const generalVal = settings.general?.value as
    | {
        default_pool?: string;
        default_pool_latitude?: number;
        default_pool_longitude?: number;
        default_pool_radius?: number;
        default_duration_minutes?: number;
      }
    | undefined;

  const defaultPool = generalVal?.default_pool || DEFAULT_VENUE.name;
  const defaultDuration = Number(generalVal?.default_duration_minutes) || 105;

  return (
    <SessionListClient
      initialSessions={sessions}
      defaultPool={defaultPool}
      defaultPoolLatitude={generalVal?.default_pool_latitude}
      defaultPoolLongitude={generalVal?.default_pool_longitude}
      defaultPoolRadius={generalVal?.default_pool_radius}
      defaultDuration={defaultDuration}
    />
  );
}

