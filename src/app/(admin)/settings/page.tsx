import * as React from "react";
import { SettingsClient } from "@/components/settings/settings-client";
import { DataStore } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await DataStore.syncFromSupabase();
  const settings = DataStore.getAppSettings();
  const savedVenues = DataStore.getSavedVenues();

  return <SettingsClient initialSettings={settings} initialVenues={savedVenues} />;
}
