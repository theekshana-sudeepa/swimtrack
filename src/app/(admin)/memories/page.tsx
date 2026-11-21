import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { getMemoriesWithSignedUrls } from "@/lib/memories-service";
import { AdminMemoriesClient } from "@/components/memories/admin-memories-client";

export const dynamic = "force-dynamic";

export default async function AdminMemoriesPage() {
  await DataStore.syncFromSupabase();
  const { memories, migrationNeeded } = await getMemoriesWithSignedUrls();
  const sessions = DataStore.getSessions({ status: "all" });

  return (
    <AdminMemoriesClient
      initialMemories={memories}
      sessions={sessions}
      migrationNeeded={migrationNeeded}
    />
  );
}
