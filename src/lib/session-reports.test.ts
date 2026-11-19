import { describe, it, expect } from "vitest";
import { generateSessionStateReport, categorizeExcusedReason } from "./session-reports";
import { SwimSession, AttendanceRecord, Swimmer } from "@/types/database";

describe("Session State Reports & Squad Roles", () => {
  const dummySession: SwimSession = {
    id: "sess-1",
    title: "Evening Squad Lap Swim",
    date: "2026-11-08",
    start_time: "15:00:00",
    end_time: "16:45:00",
    location: "Royal College Aquatic Complex, Colombo",
    status: "completed",
    is_finalized: true,
  };

  const dummySwimmers: Swimmer[] = [
    {
      id: "swim-1",
      full_name: "Kasun Perera",
      nickname: "Torpedo",
      join_date: "2026-01-01",
      status: "active",
      attendance_stats: {
        total: 10,
        present: 9,
        late: 1,
        absent: 0,
        excused: 0,
        rate: 100,
        currentStreak: 5,
        longestStreak: 5,
      },
    },
    {
      id: "swim-2",
      full_name: "Rohan Fernando",
      nickname: "Snooze",
      join_date: "2026-01-01",
      status: "active",
      attendance_stats: {
        total: 10,
        present: 3,
        late: 0,
        absent: 4,
        excused: 1,
        rate: 30,
        currentStreak: 0,
        longestStreak: 2,
      },
    },
    {
      id: "swim-3",
      full_name: "Nimal Silva",
      nickname: "Clock",
      join_date: "2026-01-01",
      status: "active",
      attendance_stats: {
        total: 10,
        present: 5,
        late: 4,
        absent: 1,
        excused: 0,
        rate: 90,
        currentStreak: 2,
        longestStreak: 4,
      },
    },
    {
      id: "swim-4",
      full_name: "Amal Fernando",
      nickname: "Scholar",
      join_date: "2026-01-01",
      status: "active",
      attendance_stats: {
        total: 10,
        present: 6,
        late: 0,
        absent: 0,
        excused: 3,
        rate: 100,
        currentStreak: 3,
        longestStreak: 3,
      },
    },
  ];

  it("categorizes excused reason strings properly", () => {
    expect(categorizeExcusedReason("Excused: Fever / Flu / Sick")).toBe("medical");
    expect(categorizeExcusedReason("Excused: School Exam / Tuition")).toBe("academic");
    expect(categorizeExcusedReason("Excused: Swim Meet / Trials")).toBe("competition");
    expect(categorizeExcusedReason("Excused: Heavy Rain / Weather")).toBe("general");
  });

  it("calculates accurate session state breakdown, rates, and awards", () => {
    const records: AttendanceRecord[] = [
      {
        id: "att-1",
        session_id: "sess-1",
        swimmer_id: "swim-1",
        status: "present",
        notes: null,
      },
      {
        id: "att-2",
        session_id: "sess-1",
        swimmer_id: "swim-3",
        status: "late",
        notes: "Arrived at 03:20 PM (20m late) — Traffic",
      },
      {
        id: "att-3",
        session_id: "sess-1",
        swimmer_id: "swim-4",
        status: "excused",
        notes: "Excused: School Exam / Tuition — Term Test",
      },
      {
        id: "att-4",
        session_id: "sess-1",
        swimmer_id: "swim-2",
        status: "absent",
        notes: null,
      },
    ];

    const report = generateSessionStateReport(dummySession, records, dummySwimmers);

    expect(report.totalParticipants).toBe(4);
    expect(report.markedCount).toBe(4);
    expect(report.unmarkedCount).toBe(0);

    // Attended: 1 present + 1 late = 2. Eligible: 2 + 1 absent = 3. Turnout = 2/3 = 67%
    expect(report.attendanceRate).toBe(67);
    // Punctuality: 1 present / 2 attended = 50%
    expect(report.punctualityRate).toBe(50);
    expect(report.totalLateMinutes).toBe(20);
    expect(report.avgLateMinutes).toBe(20);

    expect(report.breakdown.present.count).toBe(1);
    expect(report.breakdown.late.count).toBe(1);
    expect(report.breakdown.excused.count).toBe(1);
    expect(report.breakdown.absent.count).toBe(1);

    expect(report.breakdown.excused.categories.academic).toBe(1);
    expect(report.breakdown.excused.categories.medical).toBe(0);

    // Check session awards
    expect(report.awards.laneCaptain?.swimmerId).toBe("swim-1");
    expect(report.awards.warmupDodger?.swimmerId).toBe("swim-3");
    expect(report.awards.pollaKing?.swimmerId).toBe("swim-2");

    // Check executive summary & WhatsApp text
    expect(report.executiveSummary).toContain("67% squad turnout");
    expect(report.whatsAppText).toContain("SwimTrack Squad Recap");
    expect(report.whatsAppText).toContain("*Lane Captain:* Kasun Perera");
    expect(report.whatsAppText).toContain("*Warmup Dodger:* Nimal Silva");
  });
});
