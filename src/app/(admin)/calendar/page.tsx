import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { CalendarClient } from "@/components/calendar/calendar-client";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const sessions = DataStore.getSessions({ status: "all" });

  return <CalendarClient initialSessions={sessions} />;
}

