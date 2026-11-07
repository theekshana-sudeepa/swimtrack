"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Flame,
  HelpCircle,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Swimmer, SwimSession } from "@/types/database";
import { formatTime } from "@/lib/utils";
import { toast } from "sonner";

interface AnalyticsClientProps {
  sessions: SwimSession[];
  swimmers: Swimmer[];
  dashboardStats: {
    activeSwimmers: number;
    completedSessions: number;
    scheduledSessions: number;
    overallAttendanceRate: number;
    sessionsThisMonth: number;
  };
}

export function AnalyticsClient({
  sessions,
  swimmers,
  dashboardStats,
}: AnalyticsClientProps) {
  const [selectedSwimmerId, setSelectedSwimmerId] = React.useState<string>("all");

  // Chart data: Attendance Trend by session
  const trendData = sessions
    .filter((s) => s.status === "completed")
    .reverse()
    .map((session) => {
      const summary = session.attendance_summary;
      const attended = (summary?.present || 0) + (summary?.late || 0);
      const eligible = (summary?.present || 0) + (summary?.late || 0) + (summary?.absent || 0);
      const rate = eligible > 0 ? Math.round((attended / eligible) * 100) : 0;

      return {
        sessionName: session.title.slice(0, 15) + "...",
        date: session.date,
        attendanceRate: rate,
        present: summary?.present || 0,
        late: summary?.late || 0,
        absent: summary?.absent || 0,
        excused: summary?.excused || 0,
      };
    });

  // Swimmer leaderboard by attendance rate
  const swimmerLeaderboard = [...swimmers]
    .filter((s) => s.status === "active")
    .sort((a, b) => (b.attendance_stats?.rate || 0) - (a.attendance_stats?.rate || 0));

  // Overall status distribution across all completed sessions
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalExcused = 0;

  for (const s of sessions) {
    if (s.status === "completed" && s.attendance_summary) {
      totalPresent += s.attendance_summary.present;
      totalLate += s.attendance_summary.late;
      totalAbsent += s.attendance_summary.absent;
      totalExcused += s.attendance_summary.excused;
    }
  }

  const distributionData = [
    { name: "Present", value: totalPresent, color: "#5BE6CD" },
    { name: "Late", value: totalLate, color: "#FBBF24" },
    { name: "Absent", value: totalAbsent, color: "#FF907E" },
    { name: "Excused", value: totalExcused, color: "#38BDF8" },
  ];

  // CSV Export for Analytics
  function handleExportAnalyticsCSV() {
    const headers = ["Session Title", "Date", "Location", "Attendance Rate %", "Present", "Late", "Absent", "Excused"];
    const rows = sessions
      .filter((s) => s.status === "completed")
      .map((s) => {
        const sum = s.attendance_summary;
        const attended = (sum?.present || 0) + (sum?.late || 0);
        const eligible = (sum?.present || 0) + (sum?.late || 0) + (sum?.absent || 0);
        const rate = eligible > 0 ? Math.round((attended / eligible) * 100) : 0;
        return [
          `"${s.title}"`,
          s.date,
          `"${s.location}"`,
          rate,
          sum?.present || 0,
          sum?.late || 0,
          sum?.absent || 0,
          sum?.excused || 0,
        ];
      });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `swimtrack_analytics_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics CSV exported.");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Participation Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mathematical attendance rates, participation trends, consistency streaks, and activity heatmaps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportAnalyticsCSV}
            className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export Analytics CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards with Mathematical Tooltip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl border border-border bg-card relative">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              Overall Rate
              <span
                title="Formula: (Present + Late) / (Present + Late + Absent) × 100. Excused and not marked sessions are excluded."
                className="cursor-help text-aqua"
              >
                <HelpCircle className="w-3 h-3" />
              </span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-aqua/10 text-aqua flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-aqua">
            {dashboardStats.overallAttendanceRate}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            True participant attendance percentage
          </div>
        </div>

        <div className="p-5 rounded-3xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Completed Swims</span>
            <div className="w-8 h-8 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">
            {dashboardStats.completedSessions}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Completed squad sessions
          </div>
        </div>

        <div className="p-5 rounded-3xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Total Swims Attended</span>
            <div className="w-8 h-8 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">
            {totalPresent + totalLate}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {totalPresent} on time &bull; {totalLate} late
          </div>
        </div>

        <div className="p-5 rounded-3xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Absences Recorded</span>
            <div className="w-8 h-8 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">
            {totalAbsent}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {totalExcused} additional excused absences
          </div>
        </div>
      </div>

      {/* Charts Section: Attendance Trend Line & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-aqua" />
              <h2 className="font-bold text-sm text-foreground">Attendance Rate Over Time</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Target: &gt;75%</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#071B2B",
                    borderRadius: "12px",
                    border: "1px solid rgba(34, 199, 216, 0.3)",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [`${val}%`, "Attendance Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="attendanceRate"
                  stroke="#22C7D8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#22C7D8" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie / Bar */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="font-bold text-sm text-foreground">Attendance Distribution</h2>
            <span className="text-[10px] text-muted-foreground font-mono">All Sessions</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distributionData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#071B2B",
                    borderRadius: "12px",
                    border: "1px solid #173b54",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
            {distributionData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">
                  {item.name}: <strong>{item.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Swimmer Consistency Streaks Table */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-coral" />
            <h2 className="font-bold text-sm text-foreground">
              Swimmer Participation & Consistency Streaks
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">Active Squad Swimmers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/20">
              <tr>
                <th className="py-2.5 px-3">Swimmer</th>
                <th className="py-2.5 px-3">Attendance Rate</th>
                <th className="py-2.5 px-3">Current Streak</th>
                <th className="py-2.5 px-3">Longest Streak</th>
                <th className="py-2.5 px-3">Present</th>
                <th className="py-2.5 px-3">Late</th>
                <th className="py-2.5 px-3">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {swimmerLeaderboard.map((swimmer) => {
                const s = swimmer.attendance_stats;
                return (
                  <tr key={swimmer.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-3 font-bold text-foreground">
                      {swimmer.full_name}
                      {swimmer.nickname && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({swimmer.nickname})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-aqua">{s?.rate || 0}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-aqua rounded-full"
                            style={{ width: `${s?.rate || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1 font-bold text-coral">
                        <Flame className="w-3.5 h-3.5 fill-coral" />
                        <span>{s?.currentStreak || 0}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-muted-foreground">
                      {s?.longestStreak || 0}
                    </td>
                    <td className="py-3 px-3 text-seafoam font-semibold">{s?.present || 0}</td>
                    <td className="py-3 px-3 text-amber-400 font-semibold">{s?.late || 0}</td>
                    <td className="py-3 px-3 text-coral font-semibold">{s?.absent || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

