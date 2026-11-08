import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  Users,
  CheckCircle2,
  Mail,
  Zap,
  Lock,
  Download,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { formatTime, getInitials, cn } from "@/lib/utils";
import { parseLateInfo } from "@/lib/attendance-calculator";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await DataStore.syncFromSupabase();
  const resolvedParams = await params;
  const session = DataStore.getSessionById(resolvedParams.id);

  if (!session) {
    notFound();
  }

  const attendance = DataStore.getSessionAttendance(session.id);
  const eligibleReminders = DataStore.getEligibleReminderRecipients(session.id);

  const summary = session.attendance_summary;
  const attended = (summary?.present || 0) + (summary?.late || 0);
  const eligible = (summary?.present || 0) + (summary?.late || 0) + (summary?.absent || 0);
  const rate = eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Sessions</span>
      </Link>

      {/* Main Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border",
                  session.status === "scheduled"
                    ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                    : session.status === "completed"
                    ? "bg-ocean-900 text-aqua border-aqua/30"
                    : "bg-coral/10 text-coral border-coral/30"
                )}
              >
                {session.status}
              </span>

              {session.is_finalized && (
                <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-aqua" />
                  Finalized Attendance
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {session.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-seafoam" />
                <span>{session.date}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-aqua" />
                <span>
                  {formatTime(session.start_time)} – {formatTime(session.end_time)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-coral" />
                <span>{session.location}</span>
              </span>
            </div>

            {session.notes && (
              <p className="mt-3 text-xs text-muted-foreground italic">
                &ldquo;{session.notes}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/attendance?session=${session.id}`}
              className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Mark Attendance</span>
            </Link>

            <Link
              href={`/reminders?session=${session.id}`}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Mail className="w-4 h-4 text-aqua" />
              <span>Send Reminders</span>
            </Link>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-secondary/30">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">
              Attendance Rate
            </div>
            <div className="text-xl font-extrabold text-aqua mt-0.5">{rate}%</div>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30">
            <div className="text-[10px] text-seafoam uppercase font-bold">Present</div>
            <div className="text-xl font-extrabold text-foreground mt-0.5">
              {summary?.present || 0}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30">
            <div className="text-[10px] text-amber-400 uppercase font-bold">Late</div>
            <div className="text-xl font-extrabold text-foreground mt-0.5">
              {summary?.late || 0}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/30">
            <div className="text-[10px] text-coral uppercase font-bold">Absent</div>
            <div className="text-xl font-extrabold text-foreground mt-0.5">
              {summary?.absent || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Enrolled Participants Snapshot Register */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-aqua" />
            <h2 className="font-bold text-sm text-foreground">
              Session Participants ({attendance.length})
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            {eligibleReminders.length} eligible for email reminders
          </span>
        </div>

        <div className="mt-4 divide-y divide-border/60">
          {attendance.map((record) => {
            const swimmer = record.swimmer;
            return (
              <div
                key={record.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ocean-900 border border-aqua/30 text-aqua flex items-center justify-center font-bold text-xs">
                    {swimmer ? getInitials(swimmer.full_name) : "??"}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      {swimmer?.full_name}
                      {swimmer?.nickname && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({swimmer.nickname})
                        </span>
                      )}
                    </div>
                    {record.notes && (
                      <div className="text-[10px] text-aqua italic">
                        &ldquo;{record.notes}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(() => {
                    const lateInfo = record.status === "late" ? parseLateInfo(record.notes) : null;
                    return (
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                          record.status === "present"
                            ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                            : record.status === "late"
                            ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                            : record.status === "absent"
                            ? "bg-coral/10 text-coral border-coral/30"
                            : record.status === "excused"
                            ? "bg-sky-400/10 text-sky-400 border-sky-400/30"
                            : "bg-secondary text-muted-foreground border-border"
                        )}
                      >
                        {record.status === "late" && lateInfo?.minutesLate ? (
                          <>
                            <Clock className="w-3 h-3 text-amber-400 stroke-[2.5]" />
                            <span>Late (+{lateInfo.minutesLate}m)</span>
                          </>
                        ) : record.status === "excused" ? (
                          <>
                            <ShieldAlert className="w-3 h-3 text-sky-400 stroke-[2.5]" />
                            <span>Excused</span>
                          </>
                        ) : (
                          record.status
                        )}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

