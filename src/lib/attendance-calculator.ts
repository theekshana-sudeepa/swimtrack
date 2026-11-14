import { AttendanceRecord, AttendanceStatus, AttendanceCalculationResult } from "@/types/database";

/**
 * Calculates mathematically correct attendance rate based on SwimTrack requirements:
 * Attendance Rate = (Present + Late) / (Present + Late + Absent) * 100
 *
 * Explicitly EXCLUDES:
 * - Excused
 * - Not Marked
 */
export function calculateAttendanceRate(
  records: Array<{ status: AttendanceStatus }>,
  options?: { treatNotMarkedAsAbsent?: boolean }
): AttendanceCalculationResult {
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
        if (options?.treatNotMarkedAsAbsent) {
          absent++;
        } else {
          notMarked++;
        }
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

/**
 * Late Arrival Information
 */
export interface LateArrivalInfo {
  arrivalTime: string | null;
  minutesLate: number;
  reason: string | null;
  rawNotes?: string | null;
}

/**
 * Converts a time string (e.g., "15:00", "03:00 PM", "15:30:00", "3:15pm") to total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const str = timeStr.trim();

  // Match 12-hour format with AM/PM (e.g. "03:15 PM", "3:15pm", "12:30 AM")
  const match12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridian = match12[3].toUpperCase();
    if (meridian === "PM" && hours < 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Match 24-hour format (e.g. "15:15", "15:15:00", "06:30")
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return 0;
}

/**
 * Converts minutes from midnight into 24-hour time format ("HH:mm").
 */
export function minutesToTime24(totalMinutes: number): string {
  const norm = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Converts minutes from midnight into 12-hour time format ("hh:mm AM/PM").
 */
export function minutesToTime12(totalMinutes: number): string {
  const norm = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  let h = Math.floor(norm / 60);
  const m = norm % 60;
  const meridian = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${meridian}`;
}

/**
 * Calculates how many minutes late an arrival is compared to scheduled session start.
 */
export function calculateMinutesLate(sessionStartTime: string, arrivalTime: string): number {
  const startMin = parseTimeToMinutes(sessionStartTime);
  const arrMin = parseTimeToMinutes(arrivalTime);
  return Math.max(0, arrMin - startMin);
}

/**
 * Computes the arrival time given a session start time and minutes late.
 */
export function calculateArrivalTime(
  sessionStartTime: string,
  minutesLate: number
): { time24: string; time12: string } {
  const startMin = parseTimeToMinutes(sessionStartTime);
  const arrivalMin = Math.min(1439, Math.max(0, startMin + minutesLate));
  return {
    time24: minutesToTime24(arrivalMin),
    time12: minutesToTime12(arrivalMin),
  };
}

/**
 * Returns the current date in Sri Lanka (Asia/Colombo timezone) in YYYY-MM-DD format.
 */
export function getCurrentColomboDate(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now);
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Checks whether a session is upcoming in the future or currently active right now.
 * A session is considered expired/past if:
 * 1. Its scheduled date is before today (day has passed), OR
 * 2. Its scheduled date is today but its end_time has already elapsed.
 */
export function isSessionUpcomingOrActive(session: {
  date: string;
  end_time: string;
  status: string;
}): boolean {
  if (session.status !== "scheduled") return false;
  const today = getCurrentColomboDate();
  if (session.date > today) return true;
  if (session.date < today) return false;

  // Session is today: check if end_time has passed
  const { totalMinutes } = getCurrentColomboTime();
  const sessionEndMinutes = parseTimeToMinutes(session.end_time);
  return sessionEndMinutes >= totalMinutes;
}

/**
 * Returns the current time in Sri Lanka (Asia/Colombo timezone).
 */
export function getCurrentColomboTime(): { time24: string; time12: string; totalMinutes: number } {
  try {
    const now = new Date();
    const formatter24 = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const formatter12 = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const raw24 = formatter24.format(now);
    let [h, m] = raw24.split(":").map((v) => parseInt(v, 10));
    if (h === 24) h = 0;
    const totalMinutes = h * 60 + m;
    const time24 = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const time12 = formatter12.format(now);
    return { time24, time12, totalMinutes };
  } catch {
    return { time24: "15:00", time12: "03:00 PM", totalMinutes: 900 };
  }
}

/**
 * Formats a standardized late arrival note for database persistence and receipts.
 * e.g. "Arrived at 03:15 PM (15m late)" or "Arrived at 03:15 PM (15m late) — Heavy traffic"
 */
export function formatLateNote(
  arrivalTime: string,
  minutesLate: number,
  reason?: string | null
): string {
  const cleanReason = reason?.trim();
  const base = `Arrived at ${arrivalTime} (${minutesLate}m late)`;
  return cleanReason ? `${base} — ${cleanReason}` : base;
}

/**
 * Parses late information from attendance record notes.
 * Robust to various coach notations:
 * - "Arrived at 03:15 PM (15m late) — Heavy traffic"
 * - "Arrived at 15:15 (15m late)"
 * - "15m late"
 * - "20 min late"
 * - "Arrived 03:20 PM"
 */
export function parseLateInfo(notes?: string | null): LateArrivalInfo | null {
  if (!notes || !notes.trim()) return null;
  const text = notes.trim();

  // Pattern 1: Standard SwimTrack format: "Arrived at 03:15 PM (15m late) — reason"
  const stdMatch = text.match(
    /^Arrived\s+at\s+([0-9]{1,2}:[0-9]{2}(?:\s*[APap][Mm])?|[0-9]{1,2}:[0-9]{2})\s*\(([0-9]+)m?\s*late\)(?:\s*[—\-–]\s*(.+))?$/i
  );
  if (stdMatch) {
    return {
      arrivalTime: stdMatch[1],
      minutesLate: parseInt(stdMatch[2], 10),
      reason: stdMatch[3]?.trim() || null,
      rawNotes: text,
    };
  }

  // Pattern 2: "Arrived at 03:15 PM" with no minutes specified
  const arrivedMatch = text.match(
    /^Arrived\s+(?:at\s+)?([0-9]{1,2}:[0-9]{2}(?:\s*[APap][Mm])?|[0-9]{1,2}:[0-9]{2})(?:\s*[—\-–]\s*(.+))?$/i
  );
  if (arrivedMatch) {
    return {
      arrivalTime: arrivedMatch[1],
      minutesLate: 0,
      reason: arrivedMatch[2]?.trim() || null,
      rawNotes: text,
    };
  }

  // Pattern 3: "15m late" or "15 min late" or "15 mins late"
  const minsLateMatch = text.match(/([0-9]+)\s*(?:m|min|mins|minutes)\s*late(?:\s*[—\-–:]\s*(.+))?/i);
  if (minsLateMatch) {
    return {
      arrivalTime: null,
      minutesLate: parseInt(minsLateMatch[1], 10),
      reason: minsLateMatch[2]?.trim() || null,
      rawNotes: text,
    };
  }

  // Pattern 4: Generic note with reason only
  return {
    arrivalTime: null,
    minutesLate: 0,
    reason: text,
    rawNotes: text,
  };
}

