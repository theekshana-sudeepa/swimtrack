import { describe, it, expect } from "vitest";
import {
  calculateAttendanceRate,
  calculateStreaks,
  parseTimeToMinutes,
  minutesToTime24,
  minutesToTime12,
  calculateMinutesLate,
  calculateArrivalTime,
  formatLateNote,
  parseLateInfo,
  isSessionUpcomingOrActive,
} from "./attendance-calculator";
import { AttendanceStatus } from "@/types/database";

describe("Attendance Calculator", () => {
  it("calculates attendance rate correctly according to SwimTrack formula", () => {
    const records: Array<{ status: AttendanceStatus }> = [
      { status: "present" },
      { status: "present" },
      { status: "late" },
      { status: "absent" },
      { status: "excused" }, // Should be excluded from rate denominator
      { status: "not_marked" }, // Should be excluded from rate denominator
    ];

    const result = calculateAttendanceRate(records);

    // present (2) + late (1) = 3 attended
    // present (2) + late (1) + absent (1) = 4 eligible opportunities
    // Rate = 3 / 4 * 100 = 75%
    expect(result.present).toBe(2);
    expect(result.late).toBe(1);
    expect(result.absent).toBe(1);
    expect(result.excused).toBe(1);
    expect(result.notMarked).toBe(1);
    expect(result.totalOpportunities).toBe(4);
    expect(result.attendanceRate).toBe(75.0);
  });

  it("handles 100% attendance and 0% attendance gracefully", () => {
    const perfect: Array<{ status: AttendanceStatus }> = [
      { status: "present" },
      { status: "present" },
    ];
    expect(calculateAttendanceRate(perfect).attendanceRate).toBe(100);

    const noneAttended: Array<{ status: AttendanceStatus }> = [
      { status: "absent" },
      { status: "absent" },
    ];
    expect(calculateAttendanceRate(noneAttended).attendanceRate).toBe(0);

    const onlyExcused: Array<{ status: AttendanceStatus }> = [
      { status: "excused" },
      { status: "not_marked" },
    ];
    expect(calculateAttendanceRate(onlyExcused).attendanceRate).toBe(0);
    expect(calculateAttendanceRate(onlyExcused).totalOpportunities).toBe(0);
  });

  it("calculates current and longest attendance streaks", () => {
    const records: Array<{ date: string; status: AttendanceStatus }> = [
      { date: "2026-10-01", status: "present" },
      { date: "2026-10-04", status: "present" },
      { date: "2026-10-08", status: "late" },
      { date: "2026-10-11", status: "absent" }, // Streak resets to 0 here
      { date: "2026-10-15", status: "present" },
      { date: "2026-10-18", status: "excused" }, // Streak continues without reset
      { date: "2026-10-22", status: "present" },
    ];

    const streaks = calculateStreaks(records);
    // Before absent: 3
    // After absent: 2 (present on 15th + present on 22nd)
    expect(streaks.longestStreak).toBe(3);
    expect(streaks.currentStreak).toBe(2);
  });

  describe("Late Arrival Calculations and Parsing", () => {
    it("converts 12h and 24h time strings to minutes from midnight", () => {
      expect(parseTimeToMinutes("06:30")).toBe(390);
      expect(parseTimeToMinutes("15:00")).toBe(900);
      expect(parseTimeToMinutes("15:30:00")).toBe(930);
      expect(parseTimeToMinutes("03:15 PM")).toBe(915);
      expect(parseTimeToMinutes("3:15 pm")).toBe(915);
      expect(parseTimeToMinutes("12:00 AM")).toBe(0);
      expect(parseTimeToMinutes("12:30 AM")).toBe(30);
      expect(parseTimeToMinutes("12:00 PM")).toBe(720);
    });

    it("formats minutes to 24h and 12h strings", () => {
      expect(minutesToTime24(915)).toBe("15:15");
      expect(minutesToTime12(915)).toBe("03:15 PM");
      expect(minutesToTime12(390)).toBe("06:30 AM");
      expect(minutesToTime12(0)).toBe("12:00 AM");
      expect(minutesToTime12(720)).toBe("12:00 PM");
    });

    it("calculates minutes late accurately between start time and arrival", () => {
      expect(calculateMinutesLate("15:00", "15:20")).toBe(20);
      expect(calculateMinutesLate("03:00 PM", "03:15 PM")).toBe(15);
      expect(calculateMinutesLate("18:30:00", "18:45")).toBe(15);
      // On time or early
      expect(calculateMinutesLate("15:00", "14:55")).toBe(0);
      expect(calculateMinutesLate("15:00", "15:00")).toBe(0);
    });

    it("computes arrival time from session start and late minutes", () => {
      const result = calculateArrivalTime("15:00", 25);
      expect(result.time24).toBe("15:25");
      expect(result.time12).toBe("03:25 PM");
    });

    it("formats standardized late notes with and without reasons", () => {
      expect(formatLateNote("03:15 PM", 15)).toBe("Arrived at 03:15 PM (15m late)");
      expect(formatLateNote("03:20 PM", 20, "Traffic jam near clock tower")).toBe(
        "Arrived at 03:20 PM (20m late) — Traffic jam near clock tower"
      );
    });

    it("parses late notes robustly", () => {
      const parsed1 = parseLateInfo("Arrived at 03:15 PM (15m late)");
      expect(parsed1?.arrivalTime).toBe("03:15 PM");
      expect(parsed1?.minutesLate).toBe(15);
      expect(parsed1?.reason).toBeNull();

      const parsed2 = parseLateInfo("Arrived at 15:30 (30m late) — School bus delay");
      expect(parsed2?.arrivalTime).toBe("15:30");
      expect(parsed2?.minutesLate).toBe(30);
      expect(parsed2?.reason).toBe("School bus delay");

      const parsed3 = parseLateInfo("15m late");
      expect(parsed3?.minutesLate).toBe(15);

      const parsed4 = parseLateInfo("20 mins late");
      expect(parsed4?.minutesLate).toBe(20);
    });

    it("evaluates whether a session is upcoming or past based on date and time", () => {
      // Past session: date is before today
      expect(
        isSessionUpcomingOrActive({
          date: "2026-11-10",
          end_time: "19:45:00",
          status: "scheduled",
        })
      ).toBe(false);

      // Future session: date is next year or distant future
      expect(
        isSessionUpcomingOrActive({
          date: "2099-01-01",
          end_time: "08:00:00",
          status: "scheduled",
        })
      ).toBe(true);

      // Cancelled or completed sessions are never upcoming
      expect(
        isSessionUpcomingOrActive({
          date: "2099-01-01",
          end_time: "08:00:00",
          status: "completed",
        })
      ).toBe(false);
    });
  });
});


