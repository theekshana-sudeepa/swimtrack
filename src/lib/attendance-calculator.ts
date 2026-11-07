import { AttendanceRecord, AttendanceStatus, AttendanceCalculationResult } from "@/types/database";

/**
 * Calculates mathematically correct attendance rate based on SwimTrack requirements:
 * Attendance Rate = (Present + Late) / (Present + Late + Absent) * 100
 *
 * Explicitly EXCLUDES:
 * - Excused
 * - Not Marked
 */
export function calculateAttendanceRate(records: Array<{ status: AttendanceStatus }>): AttendanceCalculationResult {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  let notMarked = 0;

  for (const record of records) {
    switch (record.status) {
      case "present":
        present++;
        break;
      case "late":
        late++;
        break;
      case "absent":
        absent++;
        break;
      case "excused":
        excused++;
        break;
      case "not_marked":
      default:
        notMarked++;
        break;
    }
  }

  // Denominator: Only attended or unexcused missed opportunities
  const eligibleOpportunities = present + late + absent;
  const attendanceRate =
    eligibleOpportunities > 0
      ? Math.round(((present + late) / eligibleOpportunities) * 1000) / 10
      : 0;

  return {
    totalOpportunities: eligibleOpportunities,
    present,
    late,
    absent,
    excused,
    notMarked,
    attendanceRate,
  };
}

/**
 * Calculates current and longest consecutive session attendance streak for a swimmer.
 * Chronologically sorted list of session attendance records.
 * Consecutive attended: status === 'present' or 'late'.
 * Excused does not break a streak, or maintains it.
 * Absent breaks the streak.
 */
export function calculateStreaks(
  records: Array<{ date: string; status: AttendanceStatus }>
): { currentStreak: number; longestStreak: number } {
  if (!records || records.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort ascending by session date
  const sorted = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.status === "present" || item.status === "late") {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else if (item.status === "absent") {
      runningStreak = 0;
    }
    // If 'excused' or 'not_marked', running streak remains paused/neutral
  }

  // Current streak is the active running streak from the most recent sessions
  currentStreak = runningStreak;

  return {
    currentStreak,
    longestStreak,
  };
}

