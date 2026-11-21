import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { SessionListClient } from "@/components/sessions/session-list-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  await DataStore.syncFromSupabase();
  const sessions = DataStore.getSessions({ status: "all" });
  const settings = DataStore.getAppSettings();
  const savedVenues = DataStore.getSavedVenues();
  const defaultVenue = DataStore.getDefaultVenue();
  const generalVal = settings.general?.value as
    | {
        default_pool?: string;
        default_pool_latitude?: number;
        default_pool_longitude?: number;
        default_pool_radius?: number;
        default_duration_minutes?: number;
      }
    | undefined;

  const defaultPool = defaultVenue?.name || generalVal?.default_pool;
  const defaultDuration = Number(generalVal?.default_duration_minutes) || 105;

  return (
    <SessionListClient
      initialSessions={sessions}
      savedVenues={savedVenues}
      defaultPool={defaultPool}
      defaultPoolLatitude={defaultVenue?.latitude ?? generalVal?.default_pool_latitude}
      defaultPoolLongitude={defaultVenue?.longitude ?? generalVal?.default_pool_longitude}
      defaultPoolRadius={defaultVenue?.radius_meters ?? generalVal?.default_pool_radius}
      defaultPoolVenueId={defaultVenue?.id}
      defaultDuration={defaultDuration}
    />
  );
}
