import { AttendanceStatus } from "@/types/database";
import { parseLateInfo } from "./attendance-calculator";

export type SquadRoleCategory =
  | "elite"
  | "punctual"
  | "late"
  | "excused"
  | "flaker"
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
  totalOpportunities?: number;
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  rate?: number;
  currentStreak?: number;
  longestStreak?: number;
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
 * Master catalog of squad roles and rank tiers across attendance states.
 */
export const ALL_SQUAD_ROLES: SquadRoleDefinition[] = [
  {
    id: "zero_polla_overlord",
    category: "elite",
    title: "Zero-Polla Overlord",
    badge: "Aqua Deity",
    emoji: "🔱",
    description:
      "Rain, thunder, or apocalypse — they are already in lane 3 doing butterfly. Gills verified by doctors.",
    criteria: "0 unexcused absences, active streak ≥ 4 sessions or 100% attendance rate over 3+ practices.",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "iron_torpedo",
    category: "punctual",
    title: "Iron Torpedo (Pacesetter)",
    badge: "Swiss Precision",
    emoji: "⚡",
    description:
      "Never late, never absent, always first in the water. Coaches calibrate the pace clock to their arrival.",
    criteria: "90%+ attendance rate, 3+ practices attended, and 100% punctuality (zero late arrivals).",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "chlorine_addict",
    category: "elite",
    title: "Chlorine Addict",
    badge: "Pool Deck Regular",
    emoji: "🐬",
    description:
      "Drinks pool water for hydration. Goggle marks are permanently tattooed on their eye sockets.",
    criteria: "80%+ attendance rate with 0 unexcused absences.",
    stateAffinity: ["present"],
    pollaLevel: "zero",
  },
  {
    id: "lane_shark",
    category: "elite",
    title: "Lane Shark",
    badge: "Squad Fin",
    emoji: "🦈",
    description:
      "Solid, dependable swimmer. Contemplates ditching at 5:45 AM, but shows up anyway like a warrior.",
    criteria: "2 or more attended sessions with dependable turnout.",
    stateAffinity: ["present", "late"],
    pollaLevel: "zero",
  },
  {
    id: "honorable_reserve",
    category: "excused",
    title: "Honorable Reserve",
    badge: "Approved Scholar",
    emoji: "🩺",
    description:
      "100% legitimate exemptions. Sends medical slips and exam notices ahead of time. Zero unexcused flaking.",
    criteria: "2+ approved excused absences with zero unexcused absences (100% excuse compliance).",
    stateAffinity: ["excused"],
    pollaLevel: "zero",
  },
  {
    id: "warmup_dodger",
    category: "late",
    title: "Warmup Dodger",
    badge: "Fashionably Wet",
    emoji: "⏰",
    description:
      "Scientifically calculates arrival to the exact second warmup laps finish. Claims traffic every single time.",
    criteria: "2 or more late arrivals that outnumber on-time present attendances.",
    stateAffinity: ["late"],
    pollaLevel: "low",
  },
  {
    id: "traffic_philosopher",
    category: "late",
    title: "Traffic Philosopher",
    badge: "Clock Tower Victim",
    emoji: "🚗",
    description:
      "Understands Sri Lankan traffic patterns better than the Department of Motor Traffic. Always arrives breathless with goggles in hand.",
    criteria: "3 or more recorded late arrivals across the season.",
    stateAffinity: ["late"],
    pollaLevel: "low",
  },
  {
    id: "bed_warmth_negotiator",
    category: "flaker",
    title: "Bed Warmth Negotiator",
    badge: "One-Time Flaker",
    emoji: "🛏️",
    description:
      "Ditched once because the morning alarm sounded like a personal insult. On thin ice with the squad.",
    criteria: "Exactly 1 unexcused absence on record.",
    stateAffinity: ["absent"],
    pollaLevel: "low",
  },
  {
    id: "ghost_swimmer",
    category: "flaker",
    title: "Ghost Swimmer",
    badge: "Part-Time Submarine",
    emoji: "👻",
    description:
      "Seen once every full moon. Legends say they own a swimsuit, but nobody on deck can verify.",
    criteria: "Exactly 2 unexcused absences without prior coach notice.",
    stateAffinity: ["absent"],
    pollaLevel: "medium",
  },
  {
    id: "chief_polla_officer",
    category: "flaker",
    title: "Chief Polla Officer (CPO)",
    badge: "Master of Excuses",
    emoji: "🛌",
    description:
      "Declared legally married to their bed. Sends 'leaving in 5 mins bro' while still under the blanket.",
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
      "Testing the waters. Will they rise to become an Aqua Deity, or surrender to the temptation of Polla?",
    criteria: "Fewer than 2 recorded sessions (new squad joiner).",
    stateAffinity: ["not_marked"],
    pollaLevel: "zero",
  },
];

/**
 * Calculates a hilarious, attractive squad title and "Polla Meter" rank
 * based on attendance habits, streaks, lateness, excused exemptions, and flaking/absence patterns.
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

  // 1. Extreme Polla (Frequent Flakers: 3+ absences or <35% rate with absences)
  if (absent >= 3 || (totalEligible >= 3 && rate < 35)) {
    return {
      roleId: "chief_polla_officer",
      category: "flaker",
      title: "Chief Polla Officer (CPO)",
      badge: "Master of Excuses",
      emoji: "🛌",
      description:
        "Declared legally married to their bed. Sends 'leaving in 5 mins bro' while still under the blanket.",
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

  // 2. High Polla (2 absences)
  if (absent === 2) {
    return {
      roleId: "ghost_swimmer",
      category: "flaker",
      title: "Ghost Swimmer",
      badge: "Part-Time Submarine",
      emoji: "👻",
      description:
        "Seen once every full moon. Legends say they own a swimsuit, but nobody on deck can verify.",
      pollaLevel: "medium",
      pollaTag: "Polla Tendencies ⚠️",
      criteria: "Exactly 2 unexcused absences without prior coach notice.",
      decisionReason: `Triggered by 2 unexcused missed practices.`,
      stateAffinity: ["absent"],
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 3. Chronic Latecomer (2+ late arrivals outnumbering present attendances)
  if (late >= 2 && late >= present) {
    return {
      roleId: "warmup_dodger",
      category: "late",
      title: "Warmup Dodger",
      badge: "Fashionably Wet",
      emoji: "⏰",
      description:
        "Scientifically calculates arrival to the exact second warmup laps finish. Claims traffic every single time.",
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

  // 4. Frequent Latecomer (3+ late arrivals regardless of present)
  if (late >= 3) {
    return {
      roleId: "traffic_philosopher",
      category: "late",
      title: "Traffic Philosopher",
      badge: "Clock Tower Victim",
      emoji: "🚗",
      description:
        "Understands Sri Lankan traffic patterns better than the Department of Motor Traffic. Always arrives breathless with goggles in hand.",
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

  // 5. One occasional unexcused absence
  if (absent === 1) {
    return {
      roleId: "bed_warmth_negotiator",
      category: "flaker",
      title: "Bed Warmth Negotiator",
      badge: "One-Time Flaker",
      emoji: "🛏️",
      description:
        "Ditched once because the morning alarm sounded like a personal insult. On thin ice with the squad.",
      pollaLevel: "low",
      pollaTag: "Polla Warning ⚡",
      criteria: "Exactly 1 unexcused absence.",
      decisionReason: `Triggered by 1 unexcused missed session. Under observation.`,
      stateAffinity: ["absent"],
      colorScheme: {
        bg: "bg-sky-400/10",
        text: "text-sky-400",
        border: "border-sky-400/40",
        pillBg: "bg-sky-400/20 text-sky-300 border-sky-400/30",
      },
    };
  }

  // 6. Legitimate Excused Reserve (2+ excused absences, 0 unexcused, active squad member)
  if (excused >= 2 && absent === 0 && totalAttended >= 1) {
    return {
      roleId: "honorable_reserve",
      category: "excused",
      title: "Honorable Reserve",
      badge: "Approved Scholar",
      emoji: "🩺",
      description:
        "100% legitimate exemptions. Sends medical slips and exam notices ahead of time. Zero unexcused flaking.",
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

  // 7. Zero Polla & Elite Streak (Streak >= 4 or Rate === 100 with multiple sessions)
  if (absent === 0 && (currentStreak >= 4 || (rate === 100 && totalAttended >= 3))) {
    return {
      roleId: "zero_polla_overlord",
      category: "elite",
      title: "Zero-Polla Overlord",
      badge: "Aqua Deity",
      emoji: "🔱",
      description:
        "Rain, thunder, or apocalypse — they are already in lane 3 doing butterfly. Gills verified by doctors.",
      pollaLevel: "zero",
      pollaTag: "100% Polla-Proof 🛡️",
      criteria: "0 unexcused absences, active streak ≥ 4 or 100% attendance over 3+ practices.",
      decisionReason: `Awarded for ${currentStreak} consecutive practices attended (${totalAttended} total) with 0 unexcused absences.`,
      stateAffinity: ["present"],
      colorScheme: {
        bg: "bg-seafoam/10",
        text: "text-seafoam",
        border: "border-seafoam/40",
        pillBg: "bg-seafoam/20 text-seafoam border-seafoam/30",
      },
    };
  }

  // 8. 100% Punctual Pacesetter (Rate >= 90%, 0 lates, 0 absences)
  if (rate >= 90 && absent === 0 && late === 0 && totalAttended >= 3) {
    return {
      roleId: "iron_torpedo",
      category: "punctual",
      title: "Iron Torpedo (Pacesetter)",
      badge: "Swiss Precision",
      emoji: "⚡",
      description:
        "Never late, never absent, always first in the water. Coaches calibrate the pace clock to their arrival.",
      pollaLevel: "zero",
      pollaTag: "On-Time Pacesetter ⏱️",
      criteria: "90%+ attendance rate with 100% punctuality (zero late arrivals).",
      decisionReason: `Awarded for ${totalAttended} attended practices with 100% on-time arrival and 0 missed sessions.`,
      stateAffinity: ["present"],
      colorScheme: {
        bg: "bg-seafoam/10",
        text: "text-seafoam",
        border: "border-seafoam/40",
        pillBg: "bg-seafoam/20 text-seafoam border-seafoam/30",
      },
    };
  }

  // 9. High Consistency (Rate >= 80% with 0 absences)
  if (rate >= 80 && absent === 0) {
    return {
      roleId: "chlorine_addict",
      category: "elite",
      title: "Chlorine Addict",
      badge: "Pool Deck Regular",
      emoji: "🐬",
      description:
        "Drinks pool water for hydration. Goggle marks are permanently tattooed on their eye sockets.",
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

  // 10. Solid Squad Member (Total attended >= 2)
  if (totalAttended >= 2) {
    return {
      roleId: "lane_shark",
      category: "elite",
      title: "Lane Shark",
      badge: "Squad Fin",
      emoji: "🦈",
      description:
        "Solid, dependable swimmer. Contemplates ditching at 5:45 AM, but shows up anyway like a warrior.",
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

  // 11. New Joiner / Fresh Minnow
  return {
    roleId: "fresh_minnow",
    category: "rookie",
    title: "Fresh Minnow",
    badge: "Rookie Splasher",
    emoji: "🐣",
    description:
      "Testing the waters. Will they rise to become an Aqua Deity, or surrender to the temptation of Polla?",
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
          role: "Chief Polla Officer",
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
