import { AttendanceStatus } from "@/types/database";
import { parseLateInfo } from "./attendance-calculator";

export type SquadRoleCategory =
  | "elite"
  | "punctual"
  | "late"
  | "excused"
  | "flaker"
  | "comeback"
  | "rookie";

export interface SquadRank {
  roleId: string;
  category: SquadRoleCategory;
  title: string;
  badge: string;
  emoji: string;
  description: string;
  pollaLevel: "zero" | "low" | "medium" | "critical";
  pollaTag: string;
  criteria: string;
  decisionReason: string;
  stateAffinity: AttendanceStatus[];
  colorScheme: {
    bg: string;
    text: string;
    border: string;
    pillBg: string;
  };
}

export interface SwimmerStatsInput {
  total?: number;
  totalOpportunities?: number;
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  rate?: number;
  currentStreak?: number;
  longestStreak?: number;
  gpsCheckins?: number;
  totalLateMinutes?: number;
  sessionsEvaluated?: number;
  recentForm?: AttendanceStatus[];
}

export interface SessionRole {
  role: string;
  badge: string;
  emoji: string;
  tag: string;
  description: string;
  colorClass: string;
}

export interface SquadRoleDefinition {
  id: string;
  category: SquadRoleCategory;
  title: string;
  badge: string;
  emoji: string;
  description: string;
  criteria: string;
  stateAffinity: AttendanceStatus[];
  pollaLevel: "zero" | "low" | "medium" | "critical";
}

/**
 * Transparent Aqua Points scoring rules — rewards actual pool attendance,
 * punctuality, consistency streaks, and GPS-verified check-ins while
 * preventing 1/1 rookie or excused-leave loopholes.
 */
export const SQUAD_POINTS_RULES = {
  present: 100,
  lateBase: 70,
  lateMinutePenalty: 1,
  lateMaxPenaltyPerSession: 25,
  excused: 15,
  absent: -40,
  streakBonusPerSession: 15,
  gpsBonus: 10,
} as const;

export interface SwimmerPointsBreakdown {
  /** Displayed points (floored at 0 for clean UI presentation). */
  points: number;
  /** Unclamped raw score used internally so deep-absent swimmers still sort accurately. */
  rawPoints: number;
  presentPts: number;
  latePts: number;
  excusedPts: number;
  absentPts: number;
  streakBonus: number;
  gpsBonus: number;
  attendedCount: number;
  sessionsCount: number;
  breakdownText: string;
}

export interface SquadCrown {
  id: "pool_boss" | "human_stopwatch" | "hot_streak" | "polla_watch";
  emoji: string;
  title: string;
  winnerNames: string[];
  metricLabel: string;
  tone: "gold" | "aqua" | "amber" | "coral" | "seafoam";
}

export interface RankedSwimmerEntry<
  T extends {
    id: string;
    full_name: string;
    nickname?: string | null;
    attendance_stats?: SwimmerStatsInput;
  },
> {
  swimmer: T;
  /** True competition rank (e.g. 1, 1, 3, 4 — shared when tied). */
  rank: number;
  /** True when 2+ swimmers are genuinely tied for this exact rank. */
  isTied: boolean;
  points: SwimmerPointsBreakdown;
  squadRank: SquadRank;
  roastLine: string;
  crowns: string[];
}

/**
 * Calculates fair, transparent Aqua Points from a swimmer's attendance stats.
 */
export function calculateSwimmerPoints(stats?: SwimmerStatsInput): SwimmerPointsBreakdown {
  const present = Math.max(0, stats?.present || 0);
  const late = Math.max(0, stats?.late || 0);
  const absent = Math.max(0, stats?.absent || 0);
  const excused = Math.max(0, stats?.excused || 0);
  const currentStreak = Math.max(0, stats?.currentStreak || 0);
  const gpsCheckins = Math.max(0, stats?.gpsCheckins || 0);
  const totalLateMinutes = Math.max(0, stats?.totalLateMinutes || 0);

  const presentPts = present * SQUAD_POINTS_RULES.present;
  const cappedLatePenalty = Math.min(
    late * SQUAD_POINTS_RULES.lateMaxPenaltyPerSession,
    totalLateMinutes * SQUAD_POINTS_RULES.lateMinutePenalty
  );
  const latePts = Math.max(0, late * SQUAD_POINTS_RULES.lateBase - cappedLatePenalty);
  const excusedPts = excused * SQUAD_POINTS_RULES.excused;
  const absentPts = absent * SQUAD_POINTS_RULES.absent;
  const streakBonus = currentStreak * SQUAD_POINTS_RULES.streakBonusPerSession;
  const gpsBonus = gpsCheckins * SQUAD_POINTS_RULES.gpsBonus;

  const rawPoints = presentPts + latePts + excusedPts + absentPts + streakBonus + gpsBonus;
  const points = Math.max(0, rawPoints);

  const attendedCount = present + late;
  const sessionsCount =
    stats?.sessionsEvaluated ??
    Math.max(stats?.total ?? stats?.totalOpportunities ?? 0, attendedCount + absent + excused);

  const parts: string[] = [];
  if (present > 0) parts.push(`${present} on-time (+${presentPts})`);
  if (late > 0) parts.push(`${late} late (+${latePts})`);
  if (excused > 0) parts.push(`${excused} excused (+${excusedPts})`);
  if (absent > 0) parts.push(`${absent} polla (${absentPts})`);
  if (streakBonus > 0) parts.push(`${currentStreak} streak (+${streakBonus})`);
  if (gpsBonus > 0) parts.push(`${gpsCheckins} GPS (+${gpsBonus})`);

  return {
    points,
    rawPoints,
    presentPts,
    latePts,
    excusedPts,
    absentPts,
    streakBonus,
    gpsBonus,
    attendedCount,
    sessionsCount,
    breakdownText: parts.length > 0 ? parts.join(" · ") : "No completed practices logged yet",
  };
}

/**
 * Master catalog of squad roles and rank tiers across attendance states.
 */
export const ALL_SQUAD_ROLES: SquadRoleDefinition[] = [
  {
    id: "zero_polla_overlord",
    category: "elite",
    title: "Chlorine Sultan",
    badge: "Zero-Polla Overlord",
    emoji: "🔱",
    description:
      "Rain, thunder, or power cut — already in lane 3 doing butterfly. Doctors confirmed functioning gills.",
    criteria: "4+ consecutive practices with 0 absences, 0 lates, and 0 excused skips (pure perfection).",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "iron_torpedo",
    category: "punctual",
    title: "Iron Torpedo",
    badge: "Human Stopwatch",
    emoji: "⚡",
    description:
      "Never late, never polla. Coaches calibrate the pool pace clock to their poolside splash.",
    criteria: "3+ attended practices with 0 unexcused absences and 0 late arrivals.",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "fashionably_wet",
    category: "punctual",
    title: "Fashionably Wet Legend",
    badge: "Zero Polla, Pure Chaos",
    emoji: "😎",
    description:
      "Shows up to every single swim, just spiritually allergic to the opening whistle.",
    criteria: "3+ attended practices with 0 absences and 1–2 late arrivals.",
    stateAffinity: ["present", "late"],
    pollaLevel: "zero",
  },
  {
    id: "chlorine_addict",
    category: "elite",
    title: "Chlorine Addict",
    badge: "Pool Deck Regular",
    emoji: "🐬",
    description:
      "Drinks pool water for hydration. Goggle marks are permanently tattooed around their eyes.",
    criteria: "80%+ attendance rate with 0 unexcused absences.",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "lane_shark",
    category: "elite",
    title: "Lane Shark",
    badge: "Dependable Fin",
    emoji: "🦈",
    description:
      "Argues with the alarm every morning, still jumps into cold water like a warrior.",
    criteria: "2 or more attended practices with steady squad turnout.",
    stateAffinity: ["present", "late"],
    pollaLevel: "zero",
  },
  {
    id: "honorable_reserve",
    category: "excused",
    title: "Official Leave Lawyer",
    badge: "Approved Scholar",
    emoji: "📜",
    description:
      "Zero polla on paper. Submits medical slips and exam notices faster than their 50m freestyle.",
    criteria: "2+ approved excused absences with zero unexcused flaking.",
    stateAffinity: ["excused"],
    pollaLevel: "zero",
  },
  {
    id: "comeback_kid",
    category: "comeback",
    title: "Comeback Kid (On Probation)",
    badge: "Redemption Arc",
    emoji: "🔥",
    description:
      "Finally remembered where the swimming pool is! One more flake and it's straight back to bed prison.",
    criteria: "2+ past absences, now rebuilding with a 2+ active attendance streak.",
    stateAffinity: ["present", "absent"],
    pollaLevel: "medium",
  },
  {
    id: "warmup_dodger",
    category: "late",
    title: "Warmup Dodger",
    badge: "Fashionably Wet",
    emoji: "⏰",
    description:
      "Scientifically calculates arrival to the exact second the 800m warmup finishes. Blames traffic every time.",
    criteria: "2+ late arrivals outnumbering on-time attendances.",
    stateAffinity: ["late"],
    pollaLevel: "low",
  },
  {
    id: "traffic_philosopher",
    category: "late",
    title: "Colombo Traffic Historian",
    badge: "Invisible Perahera Victim",
    emoji: "🚗",
    description:
      "Always stuck behind an invisible Perahera. Knows every shortcut except waking up 10 minutes earlier.",
    criteria: "3 or more recorded late arrivals across the season.",
    stateAffinity: ["late"],
    pollaLevel: "low",
  },
  {
    id: "bed_warmth_negotiator",
    category: "flaker",
    title: "Bed Sheet Hostage",
    badge: "On Squad Parole",
    emoji: "🛏️",
    description:
      "The pillow won one round because the alarm felt like a personal insult. Currently on squad parole.",
    criteria: "Exactly 1 unexcused absence on record.",
    stateAffinity: ["absent"],
    pollaLevel: "low",
  },
  {
    id: "ghost_swimmer",
    category: "flaker",
    title: "Part-Time Submarine",
    badge: "Ghost Swimmer",
    emoji: "👻",
    description:
      "Surfaces once every full moon just to prove they still own a pair of goggles.",
    criteria: "Exactly 2 unexcused absences without prior coach notice.",
    stateAffinity: ["absent"],
    pollaLevel: "medium",
  },
  {
    id: "chief_polla_officer",
    category: "flaker",
    title: "Polla Prime Minister (CPO)",
    badge: "Married to the Mattress",
    emoji: "🛌",
    description:
      "Sends 'leaving in 5 mins machan' from deep REM sleep. Legally married to their bed.",
    criteria: "3+ unexcused absences or attendance rate below 35% with absences.",
    stateAffinity: ["absent"],
    pollaLevel: "critical",
  },
  {
    id: "fresh_minnow",
    category: "rookie",
    title: "Fresh Minnow",
    badge: "Rookie Splasher",
    emoji: "🐣",
    description:
      "Just bought goggles. Will they rise to Chlorine Sultan, or surrender to the dark arts of Polla?",
    criteria: "Fewer than 2 recorded sessions (new squad joiner).",
    stateAffinity: ["not_marked"],
    pollaLevel: "zero",
  },
];

/**
 * Calculates a sharp, hilarious, non-cloning squad title and "Polla Meter" rank
 * based on actual attendance habits, streaks, lateness, excused leaves, and comeback arcs.
 */
export function getSwimmerSquadRank(stats?: SwimmerStatsInput): SquadRank {
  const present = stats?.present || 0;
  const late = stats?.late || 0;
  const absent = stats?.absent || 0;
  const excused = stats?.excused || 0;
  const rate = stats?.rate || 0;
  const currentStreak = stats?.currentStreak || 0;
  const totalAttended = present + late;
  const totalEligible = totalAttended + absent;
  const totalLogged = totalEligible + excused;

  // 0. Rookie / New Joiner (< 2 total logged sessions and 0 absences)
  if (totalLogged < 2 && absent === 0) {
    return {
      roleId: "fresh_minnow",
      category: "rookie",
      title: "Fresh Minnow",
      badge: "Rookie Splasher",
      emoji: "🐣",
      description:
        "Just bought goggles. Will they rise to Chlorine Sultan, or surrender to the dark arts of Polla?",
      pollaLevel: "zero",
      pollaTag: "Polla Immunity (New) 🌟",
      criteria: "Fewer than 2 recorded sessions (new squad joiner).",
      decisionReason: "New squad joiner with introductory attendance immunity.",
      stateAffinity: ["not_marked"],
      colorScheme: {
        bg: "bg-secondary",
        text: "text-foreground",
        border: "border-border",
        pillBg: "bg-secondary text-muted-foreground border-border",
      },
    };
  }

  // 1. Comeback Arc! (Previously flaked 2+ times, but actively rebuilding on a 2+ streak)
  if (absent >= 2 && currentStreak >= 2) {
    return {
      roleId: "comeback_kid",
      category: "comeback",
      title: "Comeback Kid (On Probation)",
      badge: "Redemption Arc",
      emoji: "🔥",
      description:
        "Finally remembered where the swimming pool is! One more flake and it's straight back to bed prison.",
      pollaLevel: "medium",
      pollaTag: "Redemption Arc 🔥",
      criteria: "2+ past absences, now rebuilding with an active 2+ streak.",
      decisionReason: `Back on a ${currentStreak}-session streak after ${absent} earlier unexcused misses.`,
      stateAffinity: ["present", "absent"],
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 2. Extreme Polla (Frequent Flakers: 3+ absences or <35% rate with absences)
  if (absent >= 3 || (totalEligible >= 3 && rate < 35)) {
    return {
      roleId: "chief_polla_officer",
      category: "flaker",
      title: "Polla Prime Minister (CPO)",
      badge: "Married to the Mattress",
      emoji: "🛌",
      description:
        "Sends 'leaving in 5 mins machan' from deep REM sleep. Legally married to their bed.",
      pollaLevel: "critical",
      pollaTag: "Severe Polla Risk 🚨",
      criteria: "3+ unexcused absences or attendance rate below 35%.",
      decisionReason: `Triggered by ${absent} unexcused missed practices (${rate}% attendance rate).`,
      stateAffinity: ["absent"],
      colorScheme: {
        bg: "bg-coral/10",
        text: "text-coral",
        border: "border-coral/40",
        pillBg: "bg-coral/20 text-coral border-coral/30",
      },
    };
  }

  // 3. High Polla (2 absences)
  if (absent === 2) {
    return {
      roleId: "ghost_swimmer",
      category: "flaker",
      title: "Part-Time Submarine",
      badge: "Ghost Swimmer",
      emoji: "👻",
      description:
        "Surfaces once every full moon just to prove they still own a pair of goggles.",
      pollaLevel: "medium",
      pollaTag: "Polla Tendencies ⚠️",
      criteria: "Exactly 2 unexcused absences without prior coach notice.",
      decisionReason: "Triggered by 2 unexcused missed practices.",
      stateAffinity: ["absent"],
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 4. Chronic Latecomer (2+ late arrivals outnumbering present attendances)
  if (late >= 2 && late >= present) {
    return {
      roleId: "warmup_dodger",
      category: "late",
      title: "Warmup Dodger",
      badge: "Fashionably Wet",
      emoji: "⏰",
      description:
        "Scientifically calculates arrival to the exact second the 800m warmup finishes. Blames traffic every time.",
      pollaLevel: "low",
      pollaTag: "Late Lane Drifter ⏱️",
      criteria: "2+ late arrivals outnumbering on-time present attendances.",
      decisionReason: `Triggered by ${late} late arrivals (${present} on-time). Warmup skipped.`,
      stateAffinity: ["late"],
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 5. Frequent Latecomer (3+ late arrivals regardless of present)
  if (late >= 3) {
    return {
      roleId: "traffic_philosopher",
      category: "late",
      title: "Colombo Traffic Historian",
      badge: "Invisible Perahera Victim",
      emoji: "🚗",
      description:
        "Always stuck behind an invisible Perahera. Knows every shortcut except waking up 10 minutes earlier.",
      pollaLevel: "low",
      pollaTag: "Punctuality Watch ⏱️",
      criteria: "3 or more recorded late arrivals.",
      decisionReason: `Triggered by ${late} late arrivals across the season.`,
      stateAffinity: ["late"],
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 6. One occasional unexcused absence
  if (absent === 1) {
    return {
      roleId: "bed_warmth_negotiator",
      category: "flaker",
      title: "Bed Sheet Hostage",
      badge: "On Squad Parole",
      emoji: "🛏️",
      description:
        "The pillow won one round because the alarm felt like a personal insult. Currently on squad parole.",
      pollaLevel: "low",
      pollaTag: "Polla Warning ⚡",
      criteria: "Exactly 1 unexcused absence.",
      decisionReason: "Triggered by 1 unexcused missed session. On squad parole.",
      stateAffinity: ["absent"],
      colorScheme: {
        bg: "bg-sky-400/10",
        text: "text-sky-400",
        border: "border-sky-400/40",
        pillBg: "bg-sky-400/20 text-sky-300 border-sky-400/30",
      },
    };
  }

  // 7. Legitimate Excused Reserve (2+ excused absences, 0 unexcused)
  if (excused >= 2 && absent === 0 && totalAttended >= 1) {
    return {
      roleId: "honorable_reserve",
      category: "excused",
      title: "Official Leave Lawyer",
      badge: "Approved Scholar",
      emoji: "📜",
      description:
        "Zero polla on paper. Submits medical slips and exam notices faster than their 50m freestyle.",
      pollaLevel: "zero",
      pollaTag: "Exempt & Approved 📋",
      criteria: "2+ approved excused absences with 0 unexcused misses.",
      decisionReason: `Recognized for ${excused} verified excused absences (medical/exams) with zero unexcused polla.`,
      stateAffinity: ["excused"],
      colorScheme: {
        bg: "bg-sky-400/10",
        text: "text-sky-400",
        border: "border-sky-400/40",
        pillBg: "bg-sky-400/20 text-sky-300 border-sky-400/30",
      },
    };
  }

  // 8. Pure Perfection: Chlorine Sultan (Zero absences, zero lates, zero excused skips, streak >= 4)
  if (absent === 0 && late === 0 && excused === 0 && currentStreak >= 4) {
    return {
      roleId: "zero_polla_overlord",
      category: "elite",
      title: "Chlorine Sultan",
      badge: "Zero-Polla Overlord",
      emoji: "🔱",
      description:
        "Rain, thunder, or power cut — already in lane 3 doing butterfly. Doctors confirmed functioning gills.",
      pollaLevel: "zero",
      pollaTag: "100% Polla-Proof 🛡️",
      criteria: "4+ consecutive practices with 0 absences, 0 lates, and 0 excused skips.",
      decisionReason: `Awarded for ${currentStreak} consecutive on-time practices with 0 misses and 0 skips.`,
      stateAffinity: ["present"],
      colorScheme: {
        bg: "bg-seafoam/10",
        text: "text-seafoam",
        border: "border-seafoam/40",
        pillBg: "bg-seafoam/20 text-seafoam border-seafoam/30",
      },
    };
  }

  // 9. Iron Torpedo (Zero absences, zero lates, 3+ attended — catches e.g. 5/6 with 1 excused or 3/3 streak!)
  if (absent === 0 && late === 0 && totalAttended >= 3) {
    return {
      roleId: "iron_torpedo",
      category: "punctual",
      title: "Iron Torpedo",
      badge: "Human Stopwatch",
      emoji: "⚡",
      description:
        "Never late, never polla. Coaches calibrate the pool pace clock to their poolside splash.",
      pollaLevel: "zero",
      pollaTag: "On-Time Pacesetter ⏱️",
      criteria: "3+ attended practices with 0 unexcused absences and 100% on-time arrival.",
      decisionReason:
        excused > 0
          ? `Awarded for ${totalAttended} on-time practices (0 lates, 0 polla, ${excused} approved leave).`
          : `Awarded for ${totalAttended} attended practices with 100% on-time arrival and 0 misses.`,
      stateAffinity: ["present"],
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 10. Fashionably Wet Legend (Zero absences, 3+ attended, but 1-2 late arrivals)
  if (absent === 0 && late >= 1 && totalAttended >= 3) {
    return {
      roleId: "fashionably_wet",
      category: "punctual",
      title: "Fashionably Wet Legend",
      badge: "Zero Polla, Pure Chaos",
      emoji: "😎",
      description:
        "Shows up to every single swim, just spiritually allergic to the opening whistle.",
      pollaLevel: "zero",
      pollaTag: "Zero Polla · Late Flair 😎",
      criteria: "3+ attended practices with 0 absences and 1–2 late arrivals.",
      decisionReason: `Attended ${totalAttended} practices with 0 polla (${late} late arrival${late === 1 ? "" : "s"}).`,
      stateAffinity: ["present", "late"],
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 11. High Consistency (Rate >= 80% with 0 absences)
  if (rate >= 80 && absent === 0) {
    return {
      roleId: "chlorine_addict",
      category: "elite",
      title: "Chlorine Addict",
      badge: "Pool Deck Regular",
      emoji: "🐬",
      description:
        "Drinks pool water for hydration. Goggle marks are permanently tattooed around their eyes.",
      pollaLevel: "zero",
      pollaTag: "Zero Polla MVP 🏆",
      criteria: "80%+ attendance rate with 0 unexcused absences.",
      decisionReason: `Awarded for ${rate}% squad attendance with 0 unexcused misses.`,
      stateAffinity: ["present"],
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 12. Solid Squad Member (Total attended >= 2)
  if (totalAttended >= 2) {
    return {
      roleId: "lane_shark",
      category: "elite",
      title: "Lane Shark",
      badge: "Dependable Fin",
      emoji: "🦈",
      description:
        "Argues with the alarm every morning, still jumps into cold water like a warrior.",
      pollaLevel: "zero",
      pollaTag: "Dependable Fin 🌊",
      criteria: "2 or more attended sessions with dependable squad turnout.",
      decisionReason: `Earned with ${totalAttended} practices logged and steady attendance.`,
      stateAffinity: ["present", "late"],
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 13. Fallback Fresh Minnow
  return {
    roleId: "fresh_minnow",
    category: "rookie",
    title: "Fresh Minnow",
    badge: "Rookie Splasher",
    emoji: "🐣",
    description:
      "Just bought goggles. Will they rise to Chlorine Sultan, or surrender to the dark arts of Polla?",
    pollaLevel: "zero",
    pollaTag: "Polla Immunity (New) 🌟",
    criteria: "Fewer than 2 recorded sessions (new squad joiner).",
    decisionReason: "New squad joiner with introductory attendance immunity.",
    stateAffinity: ["not_marked"],
    colorScheme: {
      bg: "bg-secondary",
      text: "text-foreground",
      border: "border-border",
      pillBg: "bg-secondary text-muted-foreground border-border",
    },
  };
}

/**
 * Generates a short, punchy, stat-specific banter line for each swimmer on the leaderboard.
 */
export function buildSwimmerRoastLine(
  stats: SwimmerStatsInput | undefined,
  pts: SwimmerPointsBreakdown,
  rank: number,
  isTied: boolean
): string {
  const present = stats?.present || 0;
  const late = stats?.late || 0;
  const absent = stats?.absent || 0;
  const excused = stats?.excused || 0;
  const streak = stats?.currentStreak || 0;
  const gps = stats?.gpsCheckins || 0;

  if (pts.sessionsCount === 0) {
    return "Waiting for their first official splash on deck.";
  }

  if (absent === 0 && late === 0 && excused === 0 && pts.attendedCount >= 4) {
    if (isTied && rank === 1) {
      return `${pts.attendedCount}/${pts.sessionsCount} flawless — tied for the pool throne!${gps > 0 ? ` (${gps} GPS verified)` : ""}`;
    }
    return `${pts.attendedCount}/${pts.sessionsCount} on deck, 0m late — doctors confirmed gills.`;
  }

  if (absent === 0 && excused > 0 && late === 0) {
    return `${pts.attendedCount}/${pts.sessionsCount} on time · ${excused} approved leave${excused === 1 ? "" : "s"} — clean sheet.`;
  }

  if (absent >= 2 && streak >= 2) {
    return `${pts.attendedCount}/${pts.sessionsCount} total · ${streak} in a row — comeback arc loading!`;
  }

  if (absent >= 3) {
    return `Missed ${absent}/${pts.sessionsCount} — sends "leaving in 5 mins machan" from bed.`;
  }

  if (absent === 2) {
    return `${pts.attendedCount}/${pts.sessionsCount} swims · 2 polla — surfaces once a full moon.`;
  }

  if (late >= 2) {
    return `${pts.attendedCount}/${pts.sessionsCount} swims · ${late}x late — allergic to warmup laps.`;
  }

  if (absent === 1) {
    return `${pts.attendedCount}/${pts.sessionsCount} swims · 1 polla — pillow won one round.`;
  }

  return `${pts.attendedCount}/${pts.sessionsCount} practices logged · ${streak}x active streak.`;
}

/**
 * Sorts swimmers strictly by Aqua Points (with deterministic fair tie-breakers)
 * and assigns true shared competition ranks (`=1`, `=1`, `#3`, etc.) plus dynamic banter.
 */
export function rankSquadLeaderboard<
  T extends {
    id: string;
    full_name: string;
    nickname?: string | null;
    attendance_stats?: SwimmerStatsInput;
  },
>(swimmers: T[]): RankedSwimmerEntry<T>[] {
  if (!swimmers || swimmers.length === 0) return [];

  const enriched = swimmers.map((swimmer) => {
    const stats = swimmer.attendance_stats;
    const points = calculateSwimmerPoints(stats);
    const squadRank = getSwimmerSquadRank(stats);
    return {
      swimmer,
      stats,
      points,
      squadRank,
      present: stats?.present || 0,
      streak: stats?.currentStreak || 0,
      rate: stats?.rate || 0,
    };
  });

  enriched.sort((a, b) => {
    if (b.points.rawPoints !== a.points.rawPoints) {
      return b.points.rawPoints - a.points.rawPoints;
    }
    if (b.points.attendedCount !== a.points.attendedCount) {
      return b.points.attendedCount - a.points.attendedCount;
    }
    if (b.present !== a.present) {
      return b.present - a.present;
    }
    if (b.streak !== a.streak) {
      return b.streak - a.streak;
    }
    if (b.rate !== a.rate) {
      return b.rate - a.rate;
    }
    return a.swimmer.full_name.localeCompare(b.swimmer.full_name);
  });

  // Compute competition ranks (1, 1, 3, 4...) and true tie flags
  const isEquivalent = (a: (typeof enriched)[number], b: (typeof enriched)[number]) =>
    a.points.rawPoints === b.points.rawPoints &&
    a.points.attendedCount === b.points.attendedCount &&
    a.present === b.present &&
    a.streak === b.streak;

  const ranks: number[] = [];
  for (let i = 0; i < enriched.length; i++) {
    if (i > 0 && isEquivalent(enriched[i], enriched[i - 1])) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }

  const rankFrequency = new Map<number, number>();
  for (const r of ranks) {
    rankFrequency.set(r, (rankFrequency.get(r) || 0) + 1);
  }

  // Compute exclusive crown ownership
  const maxAbsences = Math.max(...enriched.map((e) => e.stats?.absent || 0));
  const maxStreak = Math.max(...enriched.map((e) => e.streak));

  return enriched.map((item, idx) => {
    const rank = ranks[idx];
    const isTied = (rankFrequency.get(rank) || 0) > 1;
    const crowns: string[] = [];

    if (rank === 1 && item.points.points > 0) {
      crowns.push(isTied ? "👑 Co-Boss" : "👑 Pool Boss");
    }
    if (
      item.streak >= 3 &&
      item.streak === maxStreak &&
      rank !== 1
    ) {
      crowns.push("🔥 Hot Streak");
    }
    if (maxAbsences >= 2 && (item.stats?.absent || 0) === maxAbsences) {
      crowns.push("🌴 Polla Watch");
    }

    return {
      swimmer: item.swimmer,
      rank,
      isTied,
      points: item.points,
      squadRank: item.squadRank,
      roastLine: buildSwimmerRoastLine(item.stats, item.points, rank, isTied),
      crowns,
    };
  });
}

/**
 * Computes the live Squad Superlatives / Banter Strip shown above the leaderboard.
 */
export function computeSquadCrowns<
  T extends {
    id: string;
    full_name: string;
    nickname?: string | null;
    attendance_stats?: SwimmerStatsInput;
  },
>(ranked: RankedSwimmerEntry<T>[]): SquadCrown[] {
  if (ranked.length === 0) return [];
  const labelOf = (s: T) => s.nickname?.trim() || s.full_name.split(" ")[0];
  const crowns: SquadCrown[] = [];

  // 1. Pool Boss (#1 points)
  const leaders = ranked.filter((r) => r.rank === 1 && r.points.points > 0);
  if (leaders.length > 0) {
    crowns.push({
      id: "pool_boss",
      emoji: "👑",
      title: leaders.length > 1 ? "Joint Pool Bosses" : "Pool Boss",
      winnerNames: leaders.map((l) => labelOf(l.swimmer)),
      metricLabel: `${leaders[0].points.points} pts`,
      tone: "gold",
    });
  }

  // 2. Human Stopwatch (most on-time check-ins with 0 lates)
  const punctualCandidates = ranked.filter(
    (r) => (r.swimmer.attendance_stats?.present || 0) >= 2 && (r.swimmer.attendance_stats?.late || 0) === 0
  );
  if (punctualCandidates.length > 0) {
    const maxPresent = Math.max(
      ...punctualCandidates.map((c) => c.swimmer.attendance_stats?.present || 0)
    );
    const winners = punctualCandidates.filter(
      (c) => (c.swimmer.attendance_stats?.present || 0) === maxPresent
    );
    crowns.push({
      id: "human_stopwatch",
      emoji: "⏱️",
      title: "Human Stopwatch",
      winnerNames: winners.slice(0, 2).map((w) => labelOf(w.swimmer)),
      metricLabel: `${maxPresent}x on time`,
      tone: "aqua",
    });
  }

  // 3. Polla Watch (most unexcused absences) OR Zero-Polla Celebration!
  const maxAbsences = Math.max(...ranked.map((r) => r.swimmer.attendance_stats?.absent || 0));
  if (maxAbsences >= 1) {
    const flakers = ranked.filter(
      (r) => (r.swimmer.attendance_stats?.absent || 0) === maxAbsences
    );
    crowns.push({
      id: "polla_watch",
      emoji: "🌴",
      title: "Most Wanted Polla",
      winnerNames: flakers.slice(0, 2).map((f) => labelOf(f.swimmer)),
      metricLabel: `${maxAbsences} missed`,
      tone: "coral",
    });
  } else {
    crowns.push({
      id: "polla_watch",
      emoji: "🛡️",
      title: "Squad Discipline",
      winnerNames: ["Zero Polla!"],
      metricLabel: "0 misses total",
      tone: "seafoam",
    });
  }

  return crowns;
}

/**
 * Assigns a dynamic session role for a swimmer within a specific session,
 * based on their session attendance state (present, late, absent, excused) and notes.
 */
export function getSessionRoleForSwimmer(
  status: AttendanceStatus,
  notes?: string | null,
  overallStats?: SwimmerStatsInput
): SessionRole {
  switch (status) {
    case "present": {
      const streak = overallStats?.currentStreak || 0;
      if (streak >= 4) {
        return {
          role: "Lane Captain",
          badge: `🔥 ${streak}x Streak Anchor`,
          emoji: "🔱",
          tag: "Squad Anchor",
          description: "Leading lane practice with an active multi-session attendance streak.",
          colorClass: "bg-seafoam/20 text-seafoam border-seafoam/40",
        };
      }
      return {
        role: "On-Time Pacesetter",
        badge: "Ready on Deck",
        emoji: "⚡",
        tag: "On Time",
        description: "Checked in on time, warmed up, and ready for the main set.",
        colorClass: "bg-seafoam/20 text-seafoam border-seafoam/40",
      };
    }

    case "late": {
      const lateInfo = parseLateInfo(notes);
      const minutes = lateInfo?.minutesLate || 0;
      if (minutes >= 30) {
        return {
          role: "Cool-Down Participant",
          badge: `+${minutes}m Heavy Delay`,
          emoji: "🦥",
          tag: "Heavy Late",
          description: "Arrived near session midpoint; warmup skipped directly to sprint drills.",
          colorClass: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        };
      }
      if (minutes >= 15) {
        return {
          role: "Warmup Dodger",
          badge: `+${minutes}m Late`,
          emoji: "⏰",
          tag: "Warmup Skimmer",
          description: "Arrived right as the 800m warmup lap set concluded.",
          colorClass: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        };
      }
      return {
        role: "Sprint Arriver",
        badge: minutes > 0 ? `+${minutes}m Late` : "Slight Delay",
        emoji: "🏃‍♂️",
        tag: "Quick Delay",
        description: "Arrived shortly after whistle; quickly geared up into lane.",
        colorClass: "bg-amber-400/20 text-amber-300 border-amber-400/40",
      };
    }

    case "excused": {
      const clean = (notes || "").toLowerCase();
      if (clean.includes("exam") || clean.includes("school") || clean.includes("tuition")) {
        return {
          role: "Academic Scholar",
          badge: "Exam Protocol",
          emoji: "📚",
          tag: "Studies First",
          description: "Excused for term tests, O/L or A/L preparation, or school exams.",
          colorClass: "bg-sky-400/20 text-sky-300 border-sky-400/40",
        };
      }
      if (
        clean.includes("fever") ||
        clean.includes("sick") ||
        clean.includes("ear") ||
        clean.includes("injury") ||
        clean.includes("doctor")
      ) {
        return {
          role: "Sickbay Reserve",
          badge: "Medical Exemption",
          emoji: "🩹",
          tag: "Health First",
          description: "Excused with illness, swimmer's ear, or doctor-advised rest.",
          colorClass: "bg-sky-400/20 text-sky-300 border-sky-400/40",
        };
      }
      if (clean.includes("meet") || clean.includes("trials") || clean.includes("nationals")) {
        return {
          role: "Meet Competitor",
          badge: "Official Duty",
          emoji: "🏆",
          tag: "Racing Trials",
          description: "Excused to compete at school or national aquatic trials.",
          colorClass: "bg-sky-400/20 text-sky-300 border-sky-400/40",
        };
      }
      return {
        role: "Honorable Excused",
        badge: "Approved Notice",
        emoji: "🛡️",
        tag: "Valid Leave",
        description: "Excused with prior notice; does not penalize attendance percentage.",
        colorClass: "bg-sky-400/20 text-sky-300 border-sky-400/40",
      };
    }

    case "absent": {
      const totalAbsent = overallStats?.absent || 1;
      if (totalAbsent >= 3) {
        return {
          role: "Polla Prime Minister",
          badge: "Serial Flaker 🚨",
          emoji: "🛌",
          tag: "MIA Flaker",
          description: "Unexcused no-show. Bed warmth prioritized over squad glory.",
          colorClass: "bg-coral/20 text-coral border-coral/40",
        };
      }
      return {
        role: "Polla of the Day",
        badge: "Unexcused Absence",
        emoji: "🌴",
        tag: "Absent",
        description: "Missed session without notice or approval.",
        colorClass: "bg-coral/20 text-coral border-coral/40",
      };
    }

    case "not_marked":
    default:
      return {
        role: "Awaiting Check-in",
        badge: "Pending",
        emoji: "⏳",
        tag: "Unmarked",
        description: "Attendance status not yet recorded by the coach.",
        colorClass: "bg-secondary text-muted-foreground border-border",
      };
  }
}
