export interface SquadRank {
  title: string;
  badge: string;
  emoji: string;
  description: string;
  pollaLevel: "zero" | "low" | "medium" | "critical";
  pollaTag: string;
  colorScheme: {
    bg: string;
    text: string;
    border: string;
    pillBg: string;
  };
}

interface SwimmerStatsInput {
  totalOpportunities?: number;
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  rate?: number;
  currentStreak?: number;
  longestStreak?: number;
}

/**
 * Calculates a hilarious, attractive squad title and "Polla Meter" rank
 * based on attendance habits, streaks, lateness, and flaking/absence patterns.
 */
export function getSwimmerSquadRank(stats?: SwimmerStatsInput): SquadRank {
  const present = stats?.present || 0;
  const late = stats?.late || 0;
  const absent = stats?.absent || 0;
  const rate = stats?.rate || 0;
  const currentStreak = stats?.currentStreak || 0;
  const totalAttended = present + late;
  const totalEligible = totalAttended + absent;

  // 1. Extreme Polla (Frequent Flakers: 3+ absences or <35% rate with absences)
  if (absent >= 3 || (totalEligible >= 3 && rate < 35)) {
    return {
      title: "Chief Polla Officer (CPO)",
      badge: "Master of Excuses",
      emoji: "🛌",
      description:
        "Declared legally married to their bed. Sends 'leaving in 5 mins bro' while still under the blanket.",
      pollaLevel: "critical",
      pollaTag: "Severe Polla Risk 🚨",
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
      title: "Ghost Swimmer",
      badge: "Part-Time Submarine",
      emoji: "👻",
      description:
        "Seen once every full moon. Legends say they own a swimsuit, but nobody on deck can verify.",
      pollaLevel: "medium",
      pollaTag: "Polla Tendencies ⚠️",
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 3. Chronic Latecomer (2+ late arrivals)
  if (late >= 2 && late >= present) {
    return {
      title: "Warmup Dodger",
      badge: "Fashionably Wet",
      emoji: "⏰",
      description:
        "Scientifically calculates arrival to the exact second warmup laps finish. Claims traffic every single time.",
      pollaLevel: "low",
      pollaTag: "Late Lane Drifter ⏱️",
      colorScheme: {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/40",
        pillBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
      },
    };
  }

  // 4. One occasional absence
  if (absent === 1) {
    return {
      title: "Bed Warmth Negotiator",
      badge: "One-Time Flaker",
      emoji: "🛏️",
      description:
        "Ditched once because the morning alarm sounded like a personal insult. On thin ice with the squad.",
      pollaLevel: "low",
      pollaTag: "Polla Warning ⚡",
      colorScheme: {
        bg: "bg-sky-400/10",
        text: "text-sky-400",
        border: "border-sky-400/40",
        pillBg: "bg-sky-400/20 text-sky-300 border-sky-400/30",
      },
    };
  }

  // 5. Zero Polla & Elite Streak (Streak >= 4 or Rate === 100 with multiple sessions)
  if (absent === 0 && (currentStreak >= 4 || (rate === 100 && totalAttended >= 3))) {
    return {
      title: "Zero-Polla Overlord",
      badge: "Aqua Deity",
      emoji: "🔱",
      description:
        "Rain, thunder, or apocalypse — they are already in lane 3 doing butterfly. Gills verified by doctors.",
      pollaLevel: "zero",
      pollaTag: "100% Polla-Proof 🛡️",
      colorScheme: {
        bg: "bg-seafoam/10",
        text: "text-seafoam",
        border: "border-seafoam/40",
        pillBg: "bg-seafoam/20 text-seafoam border-seafoam/30",
      },
    };
  }

  // 6. High Consistency (Rate >= 80% with 0 absences)
  if (rate >= 80 && absent === 0) {
    return {
      title: "Chlorine Addict",
      badge: "Pool Deck Regular",
      emoji: "🐬",
      description:
        "Drinks pool water for hydration. Goggle marks are permanently tattooed on their eye sockets.",
      pollaLevel: "zero",
      pollaTag: "Zero Polla MVP 🏆",
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 7. Solid Squad Member
  if (totalAttended >= 2) {
    return {
      title: "Lane Shark",
      badge: "Squad Fin",
      emoji: "🦈",
      description:
        "Solid, dependable swimmer. Contemplates ditching at 5:45 AM, but shows up anyway like a warrior.",
      pollaLevel: "zero",
      pollaTag: "Dependable Fin 🌊",
      colorScheme: {
        bg: "bg-aqua/10",
        text: "text-aqua",
        border: "border-aqua/40",
        pillBg: "bg-aqua/20 text-aqua border-aqua/30",
      },
    };
  }

  // 8. New Joiner / Fresh Minnow
  return {
    title: "Fresh Minnow",
    badge: "Rookie Splasher",
    emoji: "🐣",
    description:
      "Testing the waters. Will they rise to become an Aqua Deity, or surrender to the temptation of Polla?",
    pollaLevel: "zero",
    pollaTag: "Polla Immunity (New) 🌟",
    colorScheme: {
      bg: "bg-secondary",
      text: "text-foreground",
      border: "border-border",
      pillBg: "bg-secondary text-muted-foreground border-border",
    },
  };
}
