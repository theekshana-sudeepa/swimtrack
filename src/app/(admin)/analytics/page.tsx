import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const sessions = DataStore.getSessions({ status: "all" });
  const swimmers = DataStore.getSwimmers({ status: "all" });
  const stats = DataStore.getDashboardStats();

  return (
    <AnalyticsClient
      sessions={sessions}
      swimmers={swimmers}
      dashboardStats={stats}
    />
  );
}

