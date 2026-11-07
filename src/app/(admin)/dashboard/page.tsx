import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Zap,
  Mail,
  Flame,
  Award,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { formatTime, getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = DataStore.getDashboardStats();
  const nextSession = DataStore.getNextUpcomingSession();
  const recentSessions = DataStore.getSessions({ status: "completed" }).slice(0, 4);
  const scheduledSessions = DataStore.getSessions({ status: "scheduled" }).slice(0, 3);
  const activeSwimmers = DataStore.getSwimmers({ status: "active" });
  const recentReminders = DataStore.getReminderDeliveries(5);

  // Top streak swimmers (friendly milestones)
  const topStreaks = [...activeSwimmers]
    .sort((a, b) => (b.attendance_stats?.currentStreak || 0) - (a.attendance_stats?.currentStreak || 0))
    .slice(0, 3);

  // Sri Lanka Date formatting
  const colomboDateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome Area & Sri Lanka Date */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Control Room Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-seafoam animate-pulse" />
            <span>Sri Lanka: {colomboDateStr}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/attendance"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs transition-all shadow-md active:scale-95"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Open Attendance Register</span>
          </Link>
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-aqua" />
            <span>Schedule Session</span>
          </Link>
        </div>
      </div>

      {/* Hero Next Session Card */}
      {nextSession ? (
        <div className="p-6 sm:p-8 rounded-3xl border border-aqua/30 bg-gradient-to-r from-ocean-950 via-ocean-900 to-ocean-800 text-white shadow-xl relative overflow-hidden">
          {/* Subtle lane marker motifs */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-lane-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-4 right-4 text-xs font-mono uppercase tracking-widest text-seafoam border border-seafoam/30 px-3 py-1 rounded-full bg-seafoam/10">
            Next Session
          </div>

          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-semibold text-aqua uppercase tracking-wider">
              {nextSession.status === "scheduled" ? "Upcoming Swim Squad" : "Session Finalized"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {nextSession.title}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-ocean-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-seafoam" />
                <span>{nextSession.date}</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-aqua" />
                <span>
                  {formatTime(nextSession.start_time)} – {formatTime(nextSession.end_time)}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-coral" />
                <span>{nextSession.location}</span>
              </span>
            </div>

            {nextSession.notes && (
              <p className="mt-3 text-xs text-ocean-200/90 italic">
                &ldquo;{nextSession.notes}&rdquo;
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/attendance"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <span>Mark Attendance Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/sessions/${nextSession.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ocean-800/80 hover:bg-ocean-800 text-slate-100 font-semibold text-xs border border-ocean-700 transition-all"
              >
                <span>Session Details</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl border border-dashed border-border bg-card text-center">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-foreground">No Upcoming Sessions Scheduled</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Schedule a single or recurring swimming session to begin marking attendance and dispatching reminders.
          </p>
          <Link
            href="/sessions"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-aqua text-ocean-950 text-xs font-bold"
          >
            <span>Create Session</span>
          </Link>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Active Swimmers</span>
            <div className="w-8 h-8 rounded-lg bg-aqua/10 text-aqua flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {stats.activeSwimmers}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Enrolled in squad roster
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Completed Swims</span>
            <div className="w-8 h-8 rounded-lg bg-seafoam/10 text-seafoam flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {stats.completedSessions}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Historical sessions recorded
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Overall Attendance</span>
            <div className="w-8 h-8 rounded-lg bg-aqua/10 text-aqua flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {stats.overallAttendanceRate}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            (Present + Late) / Eligible Swims
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Swims This Month</span>
            <div className="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {stats.sessionsThisMonth}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Current calendar month
          </div>
        </div>
      </div>

      {/* Featured Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Sessions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-seafoam" />
                <h3 className="font-bold text-sm text-foreground">Recent Completed Sessions</h3>
              </div>
              <Link
                href="/sessions"
                className="text-xs text-aqua hover:underline font-semibold flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border/60">
              {recentSessions.length > 0 ? (
                recentSessions.map((session) => {
                  const summary = session.attendance_summary;
                  const rate = summary && summary.present + summary.late + summary.absent > 0
                    ? Math.round(((summary.present + summary.late) / (summary.present + summary.late + summary.absent)) * 100)
                    : 0;

                  return (
                    <div
                      key={session.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <Link
                          href={`/sessions/${session.id}`}
                          className="font-bold text-sm text-foreground hover:text-aqua transition-colors"
                        >
                          {session.title}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{session.date}</span>
                          <span>&bull;</span>
                          <span>{formatTime(session.start_time)}</span>
                          <span>&bull;</span>
                          <span className="truncate max-w-[180px]">{session.location}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-bold text-foreground">
                            {rate}% Attendance
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {summary?.present || 0} Present &bull; {summary?.late || 0} Late &bull; {summary?.absent || 0} Absent
                          </div>
                        </div>

                        <Link
                          href={`/sessions/${session.id}`}
                          className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No completed sessions yet.
                </div>
              )}
            </div>
          </div>

          {/* Quick Scheduled Sessions Agenda */}
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-aqua" />
                <h3 className="font-bold text-sm text-foreground">Upcoming Agenda</h3>
              </div>
              <Link
                href="/calendar"
                className="text-xs text-aqua hover:underline font-semibold flex items-center gap-1"
              >
                <span>Full Calendar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {scheduledSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-secondary/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ocean-900 border border-aqua/30 text-aqua flex flex-col items-center justify-center text-[10px] font-bold leading-tight">
                      <span>{session.date.split("-")[2]}</span>
                      <span className="uppercase text-[8px] text-ocean-300">
                        {new Date(session.date).toLocaleString("en-US", { month: "short" })}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{session.title}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {formatTime(session.start_time)} – {formatTime(session.end_time)} &bull; {session.location}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/attendance"
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-aqua/20 text-aqua hover:bg-aqua/30 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Swimmer Streaks & Recent Reminders */}
        <div className="space-y-6">
          {/* Swimmer Streaks Highlight */}
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-coral" />
                <h3 className="font-bold text-sm text-foreground">Consistency Streaks</h3>
              </div>
              <Link href="/analytics" className="text-xs text-aqua hover:underline">
                Analytics
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {topStreaks.map((swimmer, idx) => (
                <div
                  key={swimmer.id}
                  className="p-3 rounded-xl border border-border/70 bg-secondary/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-ocean-900 text-aqua border border-aqua/30 flex items-center justify-center font-bold text-xs">
                      {getInitials(swimmer.full_name)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {swimmer.full_name}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {swimmer.attendance_stats?.rate}% overall rate
                      </span>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-coral/10 text-coral text-xs font-bold border border-coral/30">
                    <Flame className="w-3.5 h-3.5 fill-coral" />
                    <span>{swimmer.attendance_stats?.currentStreak || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Reminders */}
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-aqua" />
                <h3 className="font-bold text-sm text-foreground">Recent Email Reminders</h3>
              </div>
              <Link href="/reminders" className="text-xs text-aqua hover:underline">
                View All
              </Link>
            </div>

            <div className="mt-4 space-y-2.5">
              {recentReminders.length > 0 ? (
                recentReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-2.5 rounded-xl border border-border/60 bg-secondary/20 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-semibold text-foreground truncate">
                        {rem.swimmer_name || rem.recipient_email}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {rem.session_title}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                        rem.status === "sent"
                          ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                          : rem.status === "failed"
                          ? "bg-coral/10 text-coral border-coral/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {rem.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No reminders sent yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
