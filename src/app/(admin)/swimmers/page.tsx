import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { SwimmerListClient } from "@/components/swimmers/swimmer-list-client";

export const dynamic = "force-dynamic";

export default async function SwimmersPage() {
  await DataStore.syncFromSupabase();
  const swimmers = DataStore.getSwimmers({ status: "all" });

  return <SwimmerListClient initialSwimmers={swimmers} />;
}

