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
  ShieldAlert,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
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
import {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  SwimLog,
  SquadMemory,
} from "@/types/database";
import {
  ALL_SQUAD_ROLES,
  rankSquadLeaderboard,
  SQUAD_POINTS_RULES,
} from "@/lib/squad-ranks";
import { SquadWrappedModal } from "@/components/wrapped/squad-wrapped-modal";
import { formatTime, cn } from "@/lib/utils";
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
  allAttendance?: AttendanceRecord[];
  swimLogs?: SwimLog[];
  memories?: SquadMemory[];
}

export function AnalyticsClient({
  sessions,
  swimmers,
  dashboardStats,
  allAttendance = [],
  swimLogs = [],
  memories = [],
}: AnalyticsClientProps) {
  const [selectedSwimmerId, setSelectedSwimmerId] = React.useState<string>("all");
  const [showRankGuide, setShowRankGuide] = React.useState(false);
  const [showWrappedModal, setShowWrappedModal] = React.useState(false);

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

  // Swimmer leaderboard ranked strictly by Aqua Points (with true shared ties)
  const rankedLeaderboard = React.useMemo(
    () => rankSquadLeaderboard(swimmers.filter((s) => s.status === "active")),
    [swimmers]
  );

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
            onClick={() => setShowWrappedModal(true)}
            className="px-3.5 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Squad Wrapped</span>
          </button>

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

      {/* Swimmer Consistency Streaks & Squad Ranks Table */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-coral" />
            <h2 className="font-bold text-sm text-foreground">
              Squad Polla & Glory Leaderboard
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRankGuide(!showRankGuide)}
              className="px-3 py-1.5 rounded-xl border border-aqua/30 bg-aqua/10 text-aqua hover:bg-aqua/20 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showRankGuide ? "Hide Rank Guide" : "How Ranks & Roles Are Decided"}</span>
              {showRankGuide ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Interactive How Ranks Are Decided Guide */}
        {showRankGuide && (
          <div className="p-5 rounded-2xl border border-aqua/30 bg-ocean-950/40 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <span>🏆</span>
                  <span>Aqua Points Formula &amp; Official Squad Titles</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rankings are ordered by Aqua Points — rewarding actual pool turnout, on-time arrival, streaks, and poolside GPS check-ins. Identical scores share a tie rank (=1).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              <span className="px-2 py-1 rounded-lg bg-seafoam/15 text-seafoam border border-seafoam/30">
                On-Time: +{SQUAD_POINTS_RULES.present} pts
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30">
                Late: +{SQUAD_POINTS_RULES.lateBase} pts (-{SQUAD_POINTS_RULES.lateMinutePenalty}/min)
              </span>
              <span className="px-2 py-1 rounded-lg bg-sky-400/15 text-sky-300 border border-sky-400/30">
                Excused: +{SQUAD_POINTS_RULES.excused} pts
              </span>
              <span className="px-2 py-1 rounded-lg bg-coral/15 text-coral border border-coral/30">
                Polla (Absent): {SQUAD_POINTS_RULES.absent} pts
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/30">
                Streak: +{SQUAD_POINTS_RULES.streakBonusPerSession} pts/week
              </span>
              <span className="px-2 py-1 rounded-lg bg-aqua/15 text-aqua border border-aqua/30">
                GPS Check-in: +{SQUAD_POINTS_RULES.gpsBonus} pts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {ALL_SQUAD_ROLES.map((role) => (
                <div
                  key={role.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{role.emoji}</span>
                    <span
                      className={cn(
                        "text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border",
                        role.category === "elite"
                          ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                          : role.category === "punctual"
                          ? "bg-aqua/10 text-aqua border-aqua/30"
                          : role.category === "excused"
                          ? "bg-sky-400/10 text-sky-400 border-sky-400/30"
                          : role.category === "late"
                          ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                          : role.category === "flaker"
                          ? "bg-coral/10 text-coral border-coral/30"
                          : "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      {role.category}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-xs text-foreground">
                      {role.title}
                    </h4>
                    <p className="text-[11px] text-aqua/90 font-medium">
                      &ldquo;{role.badge}&rdquo;
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {role.description}
                  </p>

                  <div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Criteria:</strong> {role.criteria}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/20">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Swimmer</th>
                <th className="py-2.5 px-3">Aqua Points</th>
                <th className="py-2.5 px-3">Squad Title &amp; Roast</th>
                <th className="py-2.5 px-3">Last 5 Form</th>
                <th className="py-2.5 px-3">Attendance</th>
                <th className="py-2.5 px-3">Streak</th>
                <th className="py-2.5 px-3">Present</th>
                <th className="py-2.5 px-3">Late</th>
                <th className="py-2.5 px-3">Excused</th>
                <th className="py-2.5 px-3">Polla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rankedLeaderboard.map((entry) => {
                const { swimmer, rank: pos, isTied, points, squadRank: rank, roastLine } = entry;
                const s = swimmer.attendance_stats;
                const recentForm = s?.recentForm || [];

                return (
                  <tr key={swimmer.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg font-black text-[11px]",
                          pos === 1
                            ? "bg-amber-400 text-ocean-950"
                            : pos === 2
                            ? "bg-slate-300 text-ocean-950"
                            : pos === 3
                            ? "bg-amber-600/80 text-white"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {isTied ? `=${pos}` : `#${pos}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground">
                      {swimmer.full_name}
                      {swimmer.nickname && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({swimmer.nickname})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3" title={points.breakdownText}>
                      <div className="font-mono font-black text-sm text-aqua cursor-help">
                        {points.points} <span className="text-[10px] font-semibold text-muted-foreground">pts</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {points.attendedCount}/{points.sessionsCount} swims
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div>
                        <span
                          title={rank.description}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-help",
                            rank.colorScheme.pillBg
                          )}
                        >
                          <span>{rank.emoji}</span>
                          <span>{rank.title}</span>
                        </span>
                        <div className="text-[10px] text-muted-foreground/85 truncate max-w-[230px] mt-0.5">
                          {roastLine}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        {recentForm.length > 0 ? (
                          recentForm.map((st, i) => (
                            <span
                              key={i}
                              title={st.toUpperCase()}
                              className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                st === "present"
                                  ? "bg-seafoam"
                                  : st === "late"
                                  ? "bg-amber-400"
                                  : st === "excused"
                                  ? "bg-sky-400"
                                  : "bg-coral"
                              )}
                            />
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-aqua">{s?.rate || 0}%</span>
                        <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
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
                    <td className="py-3 px-3 text-seafoam font-semibold">{s?.present || 0}</td>
                    <td className="py-3 px-3 text-amber-400 font-semibold">{s?.late || 0}</td>
                    <td className="py-3 px-3 text-sky-400 font-semibold">{s?.excused || 0}</td>
                    <td className="py-3 px-3 text-coral font-extrabold">
                      {s?.absent || 0} {s?.absent && s.absent > 0 ? "🏃💨" : "🛡️"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Squad Wrapped Modal */}
      <SquadWrappedModal
        isOpen={showWrappedModal}
        onClose={() => setShowWrappedModal(false)}
        swimmers={swimmers}
        sessions={sessions}
        attendance={allAttendance}
        swimLogs={swimLogs}
        memories={memories}
      />
    </div>
  );
}

