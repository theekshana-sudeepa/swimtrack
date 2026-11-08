import { AttendanceRecord, Swimmer, SwimSession } from "@/types/database";
import { formatTime } from "./utils";
import { parseLateInfo } from "./attendance-calculator";
import {
  getSessionRoleForSwimmer,
  getSwimmerSquadRank,
  SessionRole,
  SquadRank,
} from "./squad-ranks";

export interface SwimmerSessionStateItem {
  swimmerId: string;
  fullName: string;
  nickname?: string | null;
  sessionRole: SessionRole;
  squadRank: SquadRank;
  notes?: string | null;
}

export interface LateSwimmerSessionItem extends SwimmerSessionStateItem {
  minutesLate: number;
  arrivalTime: string | null;
  reason: string | null;
}

export interface ExcusedSwimmerSessionItem extends SwimmerSessionStateItem {
  reasonCategory: "medical" | "academic" | "competition" | "general";
  cleanReason: string;
}

export interface AbsentSwimmerSessionItem extends SwimmerSessionStateItem {
  totalCareerAbsences: number;
}

export interface SessionStateReport {
  session: SwimSession;
  totalParticipants: number;
  markedCount: number;
  unmarkedCount: number;
  attendanceRate: number; // Turnout percentage
  punctualityRate: number; // On-time percentage of attendees
  totalLateMinutes: number;
  avgLateMinutes: number;
  breakdown: {
    present: {
      count: number;
      percentage: number;
      swimmers: SwimmerSessionStateItem[];
    };
    late: {
      count: number;
      percentage: number;
      totalMinutes: number;
      avgMinutes: number;
      swimmers: LateSwimmerSessionItem[];
    };
    excused: {
      count: number;
      percentage: number;
      categories: {
        medical: number;
        academic: number;
        competition: number;
        general: number;
      };
      swimmers: ExcusedSwimmerSessionItem[];
    };
    absent: {
      count: number;
      percentage: number;
      swimmers: AbsentSwimmerSessionItem[];
    };
    notMarked: {
      count: number;
      percentage: number;
      swimmers: Array<{ swimmerId: string; fullName: string; nickname?: string | null }>;
    };
  };
  awards: {
    laneCaptain: SwimmerSessionStateItem | null;
    pacesetter: SwimmerSessionStateItem | null;
    warmupDodger: LateSwimmerSessionItem | null;
    pollaKing: AbsentSwimmerSessionItem | null;
  };
  executiveSummary: string;
  whatsAppText: string;
}

/**
 * Categorizes an excused note into standard squad medical/academic/competition domains.
 */
export function categorizeExcusedReason(
  notes?: string | null
): "medical" | "academic" | "competition" | "general" {
  if (!notes) return "general";
  const str = notes.toLowerCase();
  if (str.includes("exam") || str.includes("school") || str.includes("tuition") || str.includes("study")) {
    return "academic";
  }
  if (
    str.includes("fever") ||
    str.includes("flu") ||
    str.includes("sick") ||
    str.includes("ear") ||
    str.includes("injury") ||
    str.includes("doctor") ||
    str.includes("pain")
  ) {
    return "medical";
  }
  if (str.includes("meet") || str.includes("trials") || str.includes("nationals") || str.includes("competition")) {
    return "competition";
  }
  return "general";
}

/**
 * Generates an expert Session State & Squad Roles Report from live attendance data.
 */
export function generateSessionStateReport(
  session: SwimSession,
  attendanceRecords: AttendanceRecord[],
  allSwimmers: Swimmer[] = []
): SessionStateReport {
  const swimmerMap = new Map<string, Swimmer>();
  for (const s of allSwimmers) {
    swimmerMap.set(s.id, s);
  }

  const presentList: SwimmerSessionStateItem[] = [];
  const lateList: LateSwimmerSessionItem[] = [];
  const excusedList: ExcusedSwimmerSessionItem[] = [];
  const absentList: AbsentSwimmerSessionItem[] = [];
  const notMarkedList: Array<{ swimmerId: string; fullName: string; nickname?: string | null }> = [];

  let totalLateMinutes = 0;

  for (const rec of attendanceRecords) {
    const swimmer = rec.swimmer || swimmerMap.get(rec.swimmer_id);
    const fullName = swimmer?.full_name || "Swimmer";
    const nickname = swimmer?.nickname || null;
    const stats = swimmer?.attendance_stats;
    const squadRank = getSwimmerSquadRank(stats);
    const sessionRole = getSessionRoleForSwimmer(rec.status, rec.notes, stats);

    switch (rec.status) {
      case "present":
        presentList.push({
          swimmerId: rec.swimmer_id,
          fullName,
          nickname,
          sessionRole,
          squadRank,
          notes: rec.notes,
        });
        break;

      case "late": {
        const lateInfo = parseLateInfo(rec.notes);
        const mins = lateInfo?.minutesLate || 0;
        totalLateMinutes += mins;
        lateList.push({
          swimmerId: rec.swimmer_id,
          fullName,
          nickname,
          sessionRole,
          squadRank,
          minutesLate: mins,
          arrivalTime: lateInfo?.arrivalTime || null,
          reason: lateInfo?.reason || null,
          notes: rec.notes,
        });
        break;
      }

      case "excused": {
        const cat = categorizeExcusedReason(rec.notes);
        const clean = rec.notes ? rec.notes.replace(/^Excused:\s*/i, "").trim() : "Excused Absence";
        excusedList.push({
          swimmerId: rec.swimmer_id,
          fullName,
          nickname,
          sessionRole,
          squadRank,
          reasonCategory: cat,
          cleanReason: clean,
          notes: rec.notes,
        });
        break;
      }

      case "absent":
        absentList.push({
          swimmerId: rec.swimmer_id,
          fullName,
          nickname,
          sessionRole,
          squadRank,
          totalCareerAbsences: stats?.absent || 1,
          notes: rec.notes,
        });
        break;

      case "not_marked":
      default:
        notMarkedList.push({
          swimmerId: rec.swimmer_id,
          fullName,
          nickname,
        });
        break;
    }
  }

  const totalParticipants = attendanceRecords.length;
  const markedCount = presentList.length + lateList.length + excusedList.length + absentList.length;
  const unmarkedCount = notMarkedList.length;

  const attendedCount = presentList.length + lateList.length;
  const eligibleTurnout = attendedCount + absentList.length;
  const attendanceRate =
    eligibleTurnout > 0 ? Math.round((attendedCount / eligibleTurnout) * 100) : 0;

  const punctualityRate =
    attendedCount > 0 ? Math.round((presentList.length / attendedCount) * 100) : 100;

  const avgLateMinutes = lateList.length > 0 ? Math.round(totalLateMinutes / lateList.length) : 0;

  // Excused categories count
  const excusedCategories = {
    medical: excusedList.filter((e) => e.reasonCategory === "medical").length,
    academic: excusedList.filter((e) => e.reasonCategory === "academic").length,
    competition: excusedList.filter((e) => e.reasonCategory === "competition").length,
    general: excusedList.filter((e) => e.reasonCategory === "general").length,
  };

  // Determine Awards
  const laneCaptain =
    presentList.slice().sort((a, b) => {
      const sA = swimmerMap.get(a.swimmerId)?.attendance_stats?.currentStreak || 0;
      const sB = swimmerMap.get(b.swimmerId)?.attendance_stats?.currentStreak || 0;
      return sB - sA;
    })[0] || null;

  const pacesetter =
    presentList.slice().sort((a, b) => {
      const rA = swimmerMap.get(a.swimmerId)?.attendance_stats?.rate || 0;
      const rB = swimmerMap.get(b.swimmerId)?.attendance_stats?.rate || 0;
      return rB - rA;
    })[0] || null;

  const warmupDodger =
    lateList.slice().sort((a, b) => b.minutesLate - a.minutesLate)[0] || null;

  const pollaKing =
    absentList.slice().sort((a, b) => b.totalCareerAbsences - a.totalCareerAbsences)[0] || null;

  // Executive summary
  const executiveSummary = `${attendanceRate}% squad turnout for ${session.title} (${presentList.length} present, ${lateList.length} late, ${excusedList.length} excused, ${absentList.length} absent). Squad punctuality index: ${punctualityRate}%.`;

  // WhatsApp Recap Text
  const waLines: string[] = [];
  waLines.push(`🏊‍♂️ *SwimTrack Squad Recap — ${session.title}*`);
  waLines.push(`📅 ${session.date} • ${formatTime(session.start_time)} – ${formatTime(session.end_time)}`);
  waLines.push(`📍 ${session.location}`);
  waLines.push(``);
  waLines.push(
    `📊 *Turnout:* ${attendanceRate}% • *Punctuality:* ${punctualityRate}%`
  );
  waLines.push(
    `🏊 ${presentList.length} Present • ⏱️ ${lateList.length} Late • 🩹 ${excusedList.length} Excused • 🌴 ${absentList.length} Absent`
  );
  waLines.push(``);

  if (laneCaptain) {
    waLines.push(`🔱 *Lane Captain:* ${laneCaptain.fullName} (${laneCaptain.sessionRole.badge})`);
  }
  if (warmupDodger) {
    waLines.push(`⏰ *Warmup Dodger:* ${warmupDodger.fullName} (+${warmupDodger.minutesLate}m late)`);
  }
  waLines.push(``);

  if (presentList.length > 0) {
    waLines.push(`✅ *Present & On Deck (${presentList.length}):*`);
    presentList.forEach((p) => waLines.push(`• ${p.fullName} [${p.sessionRole.role}]`));
    waLines.push(``);
  }

  if (lateList.length > 0) {
    waLines.push(`⏰ *Late Arrivals (${lateList.length}):*`);
    lateList.forEach((l) => {
      const detail = l.arrivalTime ? ` (Arrived ${l.arrivalTime} • +${l.minutesLate}m)` : ` (+${l.minutesLate}m late)`;
      const r = l.reason ? ` — ${l.reason}` : "";
      waLines.push(`• ${l.fullName}${detail}${r}`);
    });
    waLines.push(``);
  }

  if (excusedList.length > 0) {
    waLines.push(`🩹 *Excused Absences (${excusedList.length}):*`);
    excusedList.forEach((e) => waLines.push(`• ${e.fullName} (${e.cleanReason})`));
    waLines.push(``);
  }

  if (absentList.length > 0) {
    waLines.push(`🌴 *Polla of the Day (${absentList.length}):*`);
    absentList.forEach((a) => waLines.push(`• ${a.fullName} [${a.sessionRole.role}]`));
    waLines.push(``);
  }

  waLines.push(`_Recorded with SwimTrack Aquatic Control Room_ 🌊`);
  const whatsAppText = waLines.join("\n");

  const calcPercentage = (c: number) =>
    totalParticipants > 0 ? Math.round((c / totalParticipants) * 100) : 0;

  return {
    session,
    totalParticipants,
    markedCount,
    unmarkedCount,
    attendanceRate,
    punctualityRate,
    totalLateMinutes,
    avgLateMinutes,
    breakdown: {
      present: {
        count: presentList.length,
        percentage: calcPercentage(presentList.length),
        swimmers: presentList,
      },
      late: {
        count: lateList.length,
        percentage: calcPercentage(lateList.length),
        totalMinutes: totalLateMinutes,
        avgMinutes: avgLateMinutes,
        swimmers: lateList,
      },
      excused: {
        count: excusedList.length,
        percentage: calcPercentage(excusedList.length),
        categories: excusedCategories,
        swimmers: excusedList,
      },
      absent: {
        count: absentList.length,
        percentage: calcPercentage(absentList.length),
        swimmers: absentList,
      },
      notMarked: {
        count: notMarkedList.length,
        percentage: calcPercentage(notMarkedList.length),
        swimmers: notMarkedList,
      },
    },
    awards: {
      laneCaptain,
      pacesetter,
      warmupDodger,
      pollaKing,
    },
    executiveSummary,
    whatsAppText,
  };
}

