import type {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  SwimLog,
  SquadMemory,
} from "@/types/database";
import { SQUAD_POINTS_RULES } from "./squad-ranks";

export interface WrappedAward {
  id: string;
  emoji: string;
  title: string;
  winnerName: string;
  metric: string;
  tone: "gold" | "aqua" | "seafoam" | "coral";
}

export interface SquadDistanceMilestone {
  totalMeters: number;
  targetMeters: number;
  label: string;
  progressPct: number;
  remainingKm: number;
}

export interface SwimmerPRSummary {
  totalMeters: number;
  totalSessionsLogged: number;
  longestSwimMeters: number;
  fastest50mSeconds: number | null;
  fastest100mSeconds: number | null;
}

export function computeSwimmerPRs(logs: SwimLog[], swimmerId: string): SwimmerPRSummary {
  const mine = logs.filter((l) => l.swimmer_id === swimmerId);
  let totalMeters = 0;
  let longestSwimMeters = 0;
  let fastest50mSeconds: number | null = null;
  let fastest100mSeconds: number | null = null;

  for (const log of mine) {
    totalMeters += log.distance_meters;
    if (log.distance_meters > longestSwimMeters) longestSwimMeters = log.distance_meters;
    if (
      log.best_50m_seconds != null &&
      (fastest50mSeconds === null || log.best_50m_seconds < fastest50mSeconds)
    ) {
      fastest50mSeconds = log.best_50m_seconds;
    }
    if (
      log.best_100m_seconds != null &&
      (fastest100mSeconds === null || log.best_100m_seconds < fastest100mSeconds)
    ) {
      fastest100mSeconds = log.best_100m_seconds;
    }
  }

  return {
    totalMeters,
    totalSessionsLogged: mine.length,
    longestSwimMeters,
    fastest50mSeconds,
    fastest100mSeconds,
  };
}

export interface MonthlySquadWrapped {
  monthKey: string; // "YYYY-MM" or "all"
  monthLabel: string; // "November 2026" or "All-Time Season"
  sessionsHeld: number;
  overallTurnoutPct: number;
  totalCheckins: number;
  totalDistanceMeters: number;
  memoriesCount: number;
  photosCount: number;
  awards: WrappedAward[];
  topLeaderboard: {
    swimmerId: string;
    name: string;
    points: number;
    attended: number;
    total: number;
    distanceMeters: number;
  }[];
  milestone: SquadDistanceMilestone;
  personalSummary?: {
    swimmerId: string;
    name: string;
    attended: number;
    missed: number;
    points: number;
    distanceMeters: number;
    rank: number;
  } | null;
}

const SRI_LANKA_SWIM_MILESTONES = [
  { targetMeters: 10_000, label: "10 km · Beira Lake to Mount Lavinia Reef" },
  { targetMeters: 30_000, label: "30 km · Crossing the Palk Strait" },
  { targetMeters: 50_000, label: "50 km · Colombo to Kalutara Coastline" },
  { targetMeters: 120_000, label: "120 km · Colombo to Galle Fort" },
  { targetMeters: 250_000, label: "250 km · Full West Coast Endurance" },
  { targetMeters: 500_000, label: "500 km · Halfway Around Sri Lanka" },
];

export function computeDistanceMilestone(totalMeters: number): SquadDistanceMilestone {
  const safe = Math.max(0, Math.round(totalMeters));
  const next =
    SRI_LANKA_SWIM_MILESTONES.find((m) => safe < m.targetMeters) || {
      targetMeters: Math.ceil((safe + 50_000) / 100_000) * 100_000,
      label: `${Math.ceil((safe + 50_000) / 100_000) * 100} km · Ocean Legends Milestone`,
    };
  const progressPct = Math.min(100, Math.round((safe / next.targetMeters) * 100));
  const remainingKm = Math.max(0, Number(((next.targetMeters - safe) / 1000).toFixed(1)));
  return {
    totalMeters: safe,
    targetMeters: next.targetMeters,
    label: next.label,
    progressPct,
    remainingKm,
  };
}

export function formatMonthKeyLabel(monthKey: string): string {
  if (monthKey === "all") return "All-Time Season";
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Returns available YYYY-MM month keys sorted newest first, plus "all".
 */
export function getAvailableWrappedMonths(params: {
  sessions: SwimSession[];
  swimLogs: SwimLog[];
  memories: SquadMemory[];
}): { key: string; label: string }[] {
  const keys = new Set<string>();
  for (const s of params.sessions) {
    if (s.status !== "cancelled" && s.date?.length >= 7) {
      keys.add(s.date.slice(0, 7));
    }
  }
  for (const l of params.swimLogs) {
    if (l.log_date?.length >= 7) keys.add(l.log_date.slice(0, 7));
  }
  for (const m of params.memories) {
    if (m.memory_date?.length >= 7) keys.add(m.memory_date.slice(0, 7));
  }
  const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a));
  return [
    ...sorted.map((k) => ({ key: k, label: formatMonthKeyLabel(k) })),
    { key: "all", label: "All-Time Season" },
  ];
}

/**
 * Computes a full Monthly (or All-Time) Squad Wrapped summary directly from live records.
 */
export function computeSquadWrapped(params: {
  monthKey: string;
  swimmers: Swimmer[];
  sessions: SwimSession[];
  attendance: AttendanceRecord[];
  swimLogs: SwimLog[];
  memories: SquadMemory[];
  currentSwimmerId?: string | null;
}): MonthlySquadWrapped {
  const { monthKey, swimmers, sessions, attendance, swimLogs, memories, currentSwimmerId } = params;
  const isAll = monthKey === "all";
  const matchesMonth = (dateStr?: string | null) =>
    isAll || Boolean(dateStr && dateStr.startsWith(monthKey));

  const activeSwimmers = swimmers.filter((s) => s.status === "active");
  const swimmerLabel = (s: Swimmer) => s.nickname?.trim() || s.full_name.split(" ")[0];

  const monthSessions = sessions.filter(
    (s) => s.status !== "cancelled" && matchesMonth(s.date)
  );
  const monthSessionIds = new Set(monthSessions.map((s) => s.id));
  const sessionById = new Map(monthSessions.map((s) => [s.id, s]));

  const monthAttendance = attendance.filter((a) => monthSessionIds.has(a.session_id));
  const monthLogs = swimLogs.filter((l) => matchesMonth(l.log_date));
  const monthMemories = memories.filter((m) => matchesMonth(m.memory_date));

  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;

  // Per-swimmer stats for this period
  const perSwimmer = new Map<
    string,
    {
      swimmer: Swimmer;
      present: number;
      late: number;
      absent: number;
      excused: number;
      gpsCount: number;
      points: number;
      distanceMeters: number;
      earliestDeltaMin: number | null; // negative means arrived before session start
    }
  >();

  for (const sw of activeSwimmers) {
    perSwimmer.set(sw.id, {
      swimmer: sw,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      gpsCount: 0,
      points: 0,
      distanceMeters: 0,
      earliestDeltaMin: null,
    });
  }

  for (const att of monthAttendance) {
    const entry = perSwimmer.get(att.swimmer_id);
    if (!entry) continue;

    if (att.status === "present") {
      entry.present++;
      entry.points += SQUAD_POINTS_RULES.present;
      totalPresent++;
    } else if (att.status === "late") {
      entry.late++;
      entry.points += SQUAD_POINTS_RULES.lateBase;
      totalLate++;
    } else if (att.status === "absent") {
      entry.absent++;
      entry.points += SQUAD_POINTS_RULES.absent;
      totalAbsent++;
    } else if (att.status === "excused") {
      entry.excused++;
      entry.points += SQUAD_POINTS_RULES.excused;
    }

    if (att.checkin_method === "geofence_self" && (att.status === "present" || att.status === "late")) {
      entry.gpsCount++;
      entry.points += SQUAD_POINTS_RULES.gpsBonus;
      const sess = sessionById.get(att.session_id);
      if (sess && att.marked_at) {
        const startIso = `${sess.date}T${sess.start_time.slice(0, 8)}+05:30`;
        const startMs = Date.parse(startIso);
        const markedMs = Date.parse(att.marked_at);
        if (Number.isFinite(startMs) && Number.isFinite(markedMs)) {
          const deltaMin = Math.round((markedMs - startMs) / 60_000);
          if (entry.earliestDeltaMin === null || deltaMin < entry.earliestDeltaMin) {
            entry.earliestDeltaMin = deltaMin;
          }
        }
      }
    }
  }

  for (const log of monthLogs) {
    const entry = perSwimmer.get(log.swimmer_id);
    if (entry) {
      entry.distanceMeters += log.distance_meters;
    }
  }

  const allEntries = Array.from(perSwimmer.values());
  const topLeaderboard = allEntries
    .map((e) => ({
      swimmerId: e.swimmer.id,
      name: swimmerLabel(e.swimmer),
      points: e.points,
      attended: e.present + e.late,
      total: e.present + e.late + e.absent,
      distanceMeters: e.distanceMeters,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.attended !== a.attended) return b.attended - a.attended;
      return b.distanceMeters - a.distanceMeters;
    });

  const awards: WrappedAward[] = [];

  // 1. #1 Pool Boss
  if (topLeaderboard[0] && (topLeaderboard[0].points > 0 || topLeaderboard[0].attended > 0)) {
    const boss = topLeaderboard[0];
    awards.push({
      id: "pool_boss",
      emoji: "👑",
      title: "#1 Pool Boss",
      winnerName: boss.name,
      metric: `${boss.points} pts · ${boss.attended} swim${boss.attended === 1 ? "" : "s"}`,
      tone: "gold",
    });
  }

  // 2. Earliest Bird on Deck (real GPS check-in timestamp)
  const earliestCandidate = allEntries
    .filter((e) => e.earliestDeltaMin !== null)
    .sort((a, b) => (a.earliestDeltaMin ?? 999) - (b.earliestDeltaMin ?? 999))[0];
  if (earliestCandidate && earliestCandidate.earliestDeltaMin !== null) {
    const d = earliestCandidate.earliestDeltaMin;
    const timingText =
      d < 0 ? `${Math.abs(d)}m before start` : d === 0 ? "Right on the dot" : `+${d}m from start`;
    awards.push({
      id: "earliest_bird",
      emoji: "🌅",
      title: "Earliest Bird on Deck",
      winnerName: swimmerLabel(earliestCandidate.swimmer),
      metric: `GPS verified · ${timingText}`,
      tone: "aqua",
    });
  }

  // 3. Distance Machine
  const distanceKing = [...allEntries]
    .filter((e) => e.distanceMeters > 0)
    .sort((a, b) => b.distanceMeters - a.distanceMeters)[0];
  if (distanceKing) {
    awards.push({
      id: "distance_machine",
      emoji: "🌊",
      title: "Distance Machine",
      winnerName: swimmerLabel(distanceKing.swimmer),
      metric:
        distanceKing.distanceMeters >= 1000
          ? `${(distanceKing.distanceMeters / 1000).toFixed(2)} km logged`
          : `${distanceKing.distanceMeters} m logged`,
      tone: "seafoam",
    });
  }

  // 4. Polla King (friendly banter!)
  const pollaKing = [...allEntries]
    .filter((e) => e.absent > 0)
    .sort((a, b) => b.absent - a.absent)[0];
  if (pollaKing) {
    awards.push({
      id: "polla_king",
      emoji: "🌴",
      title: "Polla King",
      winnerName: swimmerLabel(pollaKing.swimmer),
      metric: `${pollaKing.absent} missed practice${pollaKing.absent === 1 ? "" : "s"}`,
      tone: "coral",
    });
  }

  const totalCheckins = totalPresent + totalLate;
  const denom = totalPresent + totalLate + totalAbsent;
  const overallTurnoutPct = denom > 0 ? Math.round((totalCheckins / denom) * 100) : 0;
  const totalDistanceMeters = monthLogs.reduce((sum, l) => sum + l.distance_meters, 0);
  const allTimeDistanceMeters = swimLogs.reduce((sum, l) => sum + l.distance_meters, 0);
  const photosCount = monthMemories.reduce((sum, m) => sum + m.photos.length, 0);

  let personalSummary: MonthlySquadWrapped["personalSummary"] = null;
  if (currentSwimmerId) {
    const idx = topLeaderboard.findIndex((r) => r.swimmerId === currentSwimmerId);
    const entry = perSwimmer.get(currentSwimmerId);
    if (idx !== -1 && entry) {
      personalSummary = {
        swimmerId: currentSwimmerId,
        name: swimmerLabel(entry.swimmer),
        attended: entry.present + entry.late,
        missed: entry.absent,
        points: entry.points,
        distanceMeters: entry.distanceMeters,
        rank: idx + 1,
      };
    }
  }

  return {
    monthKey,
    monthLabel: formatMonthKeyLabel(monthKey),
    sessionsHeld: monthSessions.length,
    overallTurnoutPct,
    totalCheckins,
    totalDistanceMeters,
    memoriesCount: monthMemories.length,
    photosCount,
    awards,
    topLeaderboard: topLeaderboard.slice(0, 5),
    milestone: computeDistanceMilestone(isAll ? allTimeDistanceMeters : totalDistanceMeters),
    personalSummary,
  };
}
