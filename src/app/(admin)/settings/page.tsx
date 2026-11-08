import * as React from "react";
import { SettingsClient } from "@/components/settings/settings-client";
import { DataStore } from "@/lib/data-store";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { AppSetting } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const localSettings = DataStore.getAppSettings();

  // If live Supabase client exists, fetch latest app_settings
  const supabase = getSupabaseAdminClient();
  let settings: Record<string, AppSetting> = localSettings;

  if (supabase) {
    try {
      const { data } = await supabase.from("app_settings").select("*");
      if (data && data.length > 0) {
        const merged: Record<string, AppSetting> = { ...localSettings };
        for (const row of data) {
          merged[row.key] = row as AppSetting;
        }
        settings = merged;
      }
    } catch (e) {
      console.warn("Could not query app_settings from Supabase:", e);
    }
  }

  return <SettingsClient initialSettings={settings} />;
}

