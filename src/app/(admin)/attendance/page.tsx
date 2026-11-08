import * as React from "react";
import { DataStore } from "@/lib/data-store";
import { AttendanceClient } from "@/components/attendance/attendance-client";
import { Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  await DataStore.syncFromSupabase();
  const resolvedParams = await searchParams;
  const allSessions = DataStore.getSessions({ status: "all" });

  let targetSession = null;
  if (resolvedParams.session) {
    targetSession = DataStore.getSessionById(resolvedParams.session);
  }

  if (!targetSession) {
    targetSession = DataStore.getNextUpcomingSession();
  }

  if (!targetSession && allSessions.length > 0) {
    targetSession = allSessions[0];
  }

  if (!targetSession) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No Sessions Available</h2>
        <p className="text-xs text-muted-foreground">
          Create your first swimming session before opening the attendance register.
        </p>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-aqua text-ocean-950 font-bold text-xs"
        >
          Create Session
        </Link>
      </div>
    );
  }

  const attendanceRecords = DataStore.getSessionAttendance(targetSession.id);
  const auditLogs = DataStore.getAttendanceAuditLogs({ sessionId: targetSession.id });

  return (
    <AttendanceClient
      session={targetSession}
      allSessions={allSessions}
      initialAttendance={attendanceRecords}
      auditLogs={auditLogs}
    />
  );
}

