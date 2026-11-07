import { describe, it, expect } from "vitest";
import { calculateAttendanceRate, calculateStreaks } from "./attendance-calculator";
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
});

