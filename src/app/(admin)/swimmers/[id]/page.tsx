import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Flame,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  ArrowLeft,
  Mail,
  Phone,
  Award,
  CalendarDays,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { getSwimmerSquadRank } from "@/lib/squad-ranks";
import { getInitials, formatTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SwimmerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const swimmer = DataStore.getSwimmerById(resolvedParams.id);

  if (!swimmer) {
    notFound();
  }

  const allSessions = DataStore.getSessions({ status: "all" });
  const allAttendance = DataStore.getSessionAttendance(swimmer.id); // Or find records by swimmer
  const swimmerRecords = allSessions.map((session) => {
    const record = DataStore.getSessionAttendance(session.id).find(
      (a) => a.swimmer_id === swimmer.id
    );
    return {
      session,
      record,
    };
  }).filter((item) => item.record !== undefined);

  const stats = swimmer.attendance_stats;
  const attendedCount = (stats?.present || 0) + (stats?.late || 0);
  const rank = getSwimmerSquadRank(stats);

  // Friendly Positive Milestones
  const milestones = [
    { title: "First Swim Recorded", achieved: attendedCount >= 1, icon: CheckCircle2, desc: "Completed debut session" },
    { title: "Five Sessions Attended", achieved: attendedCount >= 5, icon: Award, desc: "5 squad practices completed" },
    { title: "Ten Sessions Milestone", achieved: attendedCount >= 10, icon: Award, desc: "10 squad practices milestone" },
    { title: "On Fire Streak", achieved: (stats?.longestStreak || 0) >= 3, icon: Flame, desc: "3+ consecutive sessions attended" },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/swimmers"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Swimmers Roster</span>
      </Link>

      {/* Profile Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-ocean-900 border-2 border-aqua/40 text-aqua flex items-center justify-center font-extrabold text-2xl shadow-lg shrink-0">
            {getInitials(swimmer.full_name)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {swimmer.full_name}
              </h1>
              {swimmer.nickname && (
                <span className="text-sm text-muted-foreground font-semibold">
                  &ldquo;{swimmer.nickname}&rdquo;
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border",
                  swimmer.status === "active"
                    ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                    : "bg-secondary text-muted-foreground border-border"
                )}
              >
                {swimmer.status}
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              Squad Member since {swimmer.join_date}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {swimmer.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-aqua" />
                  <span>{swimmer.email}</span>
                </span>
              )}
              {swimmer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{swimmer.phone}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Streaks Callout */}
        <div className="flex items-center gap-3 bg-secondary/40 p-3 rounded-2xl border border-border">
          <div className="p-3 rounded-xl bg-coral/10 text-coral border border-coral/30">
            <Flame className="w-6 h-6 fill-coral" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground">
              {stats?.currentStreak || 0} In a Row
            </div>
            <div className="text-[11px] text-muted-foreground">
              Longest Streak: {stats?.longestStreak || 0} sessions
            </div>
          </div>
        </div>
      </div>

      {/* Squad Persona & Polla Meter Card */}
      <div className={cn("p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4", rank.colorScheme.bg, rank.colorScheme.border)}>
        <div className="flex items-start gap-4">
          <div className="text-4xl select-none p-2 rounded-2xl bg-card border border-border/80 shadow-sm shrink-0">
            {rank.emoji}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
                Official Squad Title
              </span>
              <span className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded-full border", rank.colorScheme.pillBg)}>
                {rank.pollaTag}
              </span>
            </div>
            <h2 className={cn("text-xl font-extrabold mt-0.5", rank.colorScheme.text)}>
              {rank.title} &bull; <span className="text-sm font-semibold opacity-90">{rank.badge}</span>
            </h2>
            <p className="text-xs text-foreground/80 mt-1 max-w-xl italic leading-relaxed">
              &ldquo;{rank.description}&rdquo;
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 p-3 rounded-2xl bg-card/80 border border-border">
          <div className="text-[10px] font-bold text-muted-foreground uppercase">Polla Risk Assessment</div>
          <div className={cn("text-sm font-black mt-0.5", rank.colorScheme.text)}>
            {rank.pollaLevel === "zero" && "🛡️ 0% Polla Risk (Unshakable)"}
            {rank.pollaLevel === "low" && "⚡ Minor Polla Suspect (1 Miss)"}
            {rank.pollaLevel === "medium" && "⚠️ Moderate Flaker (2 Misses)"}
            {rank.pollaLevel === "critical" && "🚨 Chronic Polla Specialist"}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card text-center">
          <div className="text-xs text-muted-foreground font-bold">Attendance Rate</div>
          <div className="text-2xl font-extrabold text-aqua mt-1">
            {stats?.rate || 0}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            (Present + Late) / Eligible
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card text-center">
          <div className="text-xs text-seafoam font-bold">Present</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {stats?.present || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">On time</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card text-center">
          <div className="text-xs text-amber-400 font-bold">Late</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {stats?.late || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Delayed arrival</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card text-center">
          <div className="text-xs text-coral font-bold">Absent</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {stats?.absent || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Missed session</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card text-center">
          <div className="text-xs text-sky-400 font-bold">Excused</div>
          <div className="text-2xl font-extrabold text-foreground mt-1">
            {stats?.excused || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Permitted absence</div>
        </div>
      </div>

      {/* Friendly Milestones */}
      <div className="p-6 rounded-2xl border border-border bg-card">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-aqua" />
          <span>Swimmer Milestones</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {milestones.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className={cn(
                  "p-3.5 rounded-xl border flex items-center gap-3 transition-colors",
                  m.achieved
                    ? "border-seafoam/30 bg-seafoam/5 text-foreground"
                    : "border-border/60 bg-secondary/20 opacity-50"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    m.achieved ? "bg-seafoam/20 text-seafoam" : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">{m.title}</div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attendance History Timeline */}
      <div className="p-6 rounded-2xl border border-border bg-card">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-aqua" />
          <span>Session Attendance History</span>
        </h2>

        <div className="divide-y divide-border/60">
          {swimmerRecords.length > 0 ? (
            swimmerRecords.map(({ session, record }) => (
              <div
                key={session.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="font-bold text-xs text-foreground hover:text-aqua transition-colors"
                  >
                    {session.title}
                  </Link>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {session.date} &bull; {formatTime(session.start_time)} &bull; {session.location}
                  </div>
                  {record?.notes && (
                    <div className="text-[11px] text-aqua italic mt-1">
                      &ldquo;{record.notes}&rdquo;
                    </div>
                  )}
                </div>

                <div>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
                      record?.status === "present"
                        ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                        : record?.status === "late"
                        ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                        : record?.status === "absent"
                        ? "bg-coral/10 text-coral border-coral/30"
                        : record?.status === "excused"
                        ? "bg-sky-400/10 text-sky-400 border-sky-400/30"
                        : "bg-secondary text-muted-foreground border-border"
                    )}
                  >
                    {record?.status || "not_marked"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No sessions recorded for this swimmer yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

