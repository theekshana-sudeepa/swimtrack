import { describe, it, expect } from "vitest";
import {
  getSwimmerSquadRank,
  getSessionRoleForSwimmer,
  ALL_SQUAD_ROLES,
  calculateSwimmerPoints,
  rankSquadLeaderboard,
  computeSquadCrowns,
  buildPointsLedger,
} from "./squad-ranks";

describe("Squad Rank, Aqua Points & Polla Meter Logic", () => {
  it("awards Chlorine Sultan to flawless swimmers with 4+ streak and 0 skips", () => {
    const rank = getSwimmerSquadRank({
      present: 6,
      late: 0,
      absent: 0,
      excused: 0,
      rate: 100,
      currentStreak: 6,
    });
    expect(rank.title).toBe("Chlorine Sultan");
    expect(rank.pollaLevel).toBe("zero");
    expect(rank.pollaTag).toContain("100% Polla-Proof");
  });

  it("awards Iron Torpedo (reachable!) to 0-polla, 0-late swimmers with an excused leave", () => {
    const rank = getSwimmerSquadRank({
      present: 5,
      late: 0,
      absent: 0,
      excused: 1,
      rate: 100,
      currentStreak: 5,
    });
    expect(rank.title).toBe("Iron Torpedo");
    expect(rank.pollaLevel).toBe("zero");
  });

  it("awards Comeback Kid (On Probation) when a flaker rebuilds a 2+ active streak", () => {
    const rank = getSwimmerSquadRank({
      present: 2,
      late: 0,
      absent: 4,
      excused: 0,
      rate: 33.3,
      currentStreak: 2,
    });
    expect(rank.title).toBe("Comeback Kid (On Probation)");
    expect(rank.category).toBe("comeback");
    expect(rank.emoji).toBe("🔥");
  });

  it("awards Polla Prime Minister (CPO) to swimmers with 3+ absences and no comeback streak", () => {
    const rank = getSwimmerSquadRank({
      present: 1,
      late: 0,
      absent: 3,
      rate: 25,
      currentStreak: 0,
    });
    expect(rank.title).toBe("Polla Prime Minister (CPO)");
    expect(rank.pollaLevel).toBe("critical");
    expect(rank.emoji).toBe("🛌");
    expect(rank.decisionReason).toContain("Triggered by 3 unexcused");
  });

  it("awards Warmup Dodger to chronic latecomers", () => {
    const rank = getSwimmerSquadRank({
      present: 1,
      late: 2,
      absent: 0,
      rate: 100,
      currentStreak: 3,
    });
    expect(rank.title).toBe("Warmup Dodger");
    expect(rank.badge).toBe("Fashionably Wet");
  });

  it("awards Part-Time Submarine to swimmers with 2 absences and no active comeback", () => {
    const rank = getSwimmerSquadRank({
      present: 2,
      late: 0,
      absent: 2,
      rate: 50,
      currentStreak: 0,
    });
    expect(rank.title).toBe("Part-Time Submarine");
    expect(rank.pollaLevel).toBe("medium");
  });

  it("awards Official Leave Lawyer to swimmers with 2+ excused leaves and 0 polla", () => {
    const rank = getSwimmerSquadRank({
      present: 2,
      late: 0,
      absent: 0,
      excused: 3,
      rate: 100,
      currentStreak: 2,
    });
    expect(rank.title).toBe("Official Leave Lawyer");
    expect(rank.pollaLevel).toBe("zero");
    expect(rank.badge).toBe("Approved Scholar");
    expect(rank.decisionReason).toContain("3 verified excused absences");
  });

  it("calculates fair Aqua Points and assigns true joint #1 ties (=1) without unfair loopholes", () => {
    const squad = [
      {
        id: "dinusha",
        full_name: "Dinusha",
        nickname: "masterdinna",
        attendance_stats: { present: 6, late: 0, absent: 0, excused: 0, rate: 100, currentStreak: 6, sessionsEvaluated: 6 },
      },
      {
        id: "theekshana",
        full_name: "Theekshana",
        nickname: "ThikkaBro",
        attendance_stats: { present: 6, late: 0, absent: 0, excused: 0, rate: 100, currentStreak: 6, sessionsEvaluated: 6 },
      },
      {
        id: "praveen",
        full_name: "Praveen",
        nickname: "Beast",
        attendance_stats: { present: 5, late: 0, absent: 0, excused: 1, rate: 100, currentStreak: 5, sessionsEvaluated: 6 },
      },
      {
        id: "rookie",
        full_name: "New Joiner",
        attendance_stats: { present: 1, late: 0, absent: 0, excused: 0, rate: 100, currentStreak: 1, sessionsEvaluated: 1 },
      },
      {
        id: "roshika",
        full_name: "Roshika",
        attendance_stats: { present: 2, late: 0, absent: 4, excused: 0, rate: 33.3, currentStreak: 2, sessionsEvaluated: 6 },
      },
    ];

    const ranked = rankSquadLeaderboard(squad);

    // Dinusha & Theekshana share joint #1 with 690 pts each
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].isTied).toBe(true);
    expect(ranked[0].points.points).toBe(690);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[1].isTied).toBe(true);
    expect(ranked[1].points.points).toBe(690);

    // Praveen (5/6 + 1 excused) is legitimately #3 with 590 pts and distinct title Iron Torpedo
    expect(ranked[2].swimmer.id).toBe("praveen");
    expect(ranked[2].rank).toBe(3);
    expect(ranked[2].isTied).toBe(false);
    expect(ranked[2].points.points).toBe(590);
    expect(ranked[2].squadRank.title).toBe("Iron Torpedo");

    // 1/1 rookie (115 pts) does NOT unfairly jump ahead of 5/6 veteran!
    expect(ranked[3].swimmer.id).toBe("rookie");
    expect(ranked[3].points.points).toBe(115);

    // Roshika (2/6, 4 absent, streak 2) gets 70 pts + Comeback Kid title
    expect(ranked[4].swimmer.id).toBe("roshika");
    expect(ranked[4].points.points).toBe(70);
    expect(ranked[4].squadRank.title).toBe("Comeback Kid (On Probation)");

    // Squad Crowns reflect joint Pool Bosses and Most Wanted Polla
    const crowns = computeSquadCrowns(ranked);
    const boss = crowns.find((c) => c.id === "pool_boss");
    expect(boss?.title).toBe("Joint Pool Bosses");
    expect(boss?.winnerNames).toHaveLength(2);
    const polla = crowns.find((c) => c.id === "polla_watch");
    expect(polla?.winnerNames).toContain("Roshika");
  });

  it("rewards on-time attendance over late arrivals and GPS check-ins with bonus points", () => {
    const onTime = calculateSwimmerPoints({ present: 4, late: 0, absent: 0, currentStreak: 4, gpsCheckins: 2 });
    const allLate = calculateSwimmerPoints({ present: 0, late: 4, absent: 0, currentStreak: 4, totalLateMinutes: 60 });
    expect(onTime.points).toBeGreaterThan(allLate.points);
    expect(onTime.gpsBonus).toBe(20);
  });

  it("contains complete catalog of squad roles in ALL_SQUAD_ROLES", () => {
    expect(ALL_SQUAD_ROLES.length).toBeGreaterThanOrEqual(12);
    const cpo = ALL_SQUAD_ROLES.find((r) => r.id === "chief_polla_officer");
    expect(cpo).toBeDefined();
    expect(cpo?.category).toBe("flaker");
  });

  it("assigns appropriate session roles based on session state and notes", () => {
    const captainRole = getSessionRoleForSwimmer("present", null, { currentStreak: 5 });
    expect(captainRole.role).toBe("Lane Captain");
    expect(captainRole.emoji).toBe("🔱");

    const dodgerRole = getSessionRoleForSwimmer("late", "Arrived at 03:20 PM (20m late)");
    expect(dodgerRole.role).toBe("Warmup Dodger");

    const scholarRole = getSessionRoleForSwimmer("excused", "Excused: School Exam / Tuition");
    expect(scholarRole.role).toBe("Academic Scholar");

    const sickbayRole = getSessionRoleForSwimmer("excused", "Excused: Fever / Flu / Sick");
    expect(sickbayRole.role).toBe("Sickbay Reserve");

    const pollaRole = getSessionRoleForSwimmer("absent", null, { absent: 1 });
    expect(pollaRole.role).toBe("Polla of the Day");
  });

  it("builds a per-session Aqua Points ledger whose running total matches calculateSwimmerPoints exactly", () => {
    const records = [
      {
        id: "r1",
        status: "present" as const,
        checkin_method: "geofence_self" as const,
        session: {
          id: "s1",
          title: "Week 1",
          date: "2026-10-01",
          location: "Pool A",
          status: "completed" as const,
          is_finalized: true,
        },
      },
      {
        id: "r2",
        status: "late" as const,
        notes: "Arrived at 03:15 PM (15m late)",
        checkin_method: "coach_manual" as const,
        session: {
          id: "s2",
          title: "Week 2",
          date: "2026-10-08",
          location: "Pool A",
          status: "completed" as const,
          is_finalized: true,
        },
      },
      {
        id: "r3",
        status: "absent" as const,
        session: {
          id: "s3",
          title: "Week 3",
          date: "2026-10-15",
          location: "Pool A",
          status: "completed" as const,
          is_finalized: true,
        },
      },
      {
        id: "r4",
        status: "excused" as const,
        notes: "Excused: Exam",
        session: {
          id: "s4",
          title: "Week 4",
          date: "2026-10-22",
          location: "Pool A",
          status: "completed" as const,
          is_finalized: true,
        },
      },
      {
        id: "r5",
        status: "present" as const,
        checkin_method: "coach_manual" as const,
        session: {
          id: "s5",
          title: "Week 5",
          date: "2026-10-29",
          location: "Pool A",
          status: "completed" as const,
          is_finalized: true,
        },
      },
      {
        id: "r6",
        status: "not_marked" as const,
        session: {
          id: "s6",
          title: "Upcoming Week 6",
          date: "2026-11-30",
          location: "Pool A",
          status: "scheduled" as const,
          is_finalized: false,
        },
      },
    ];

    const ledger = buildPointsLedger(records);
    const expected = calculateSwimmerPoints({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      currentStreak: 1,
      gpsCheckins: 1,
      totalLateMinutes: 15,
    });

    // Exact point-for-point match with calculateSwimmerPoints!
    expect(ledger.summary.netPoints).toBe(expected.points);
    expect(ledger.summary.scoredSessionsCount).toBe(5);

    // Entries are newest-first: r6 (upcoming, unscored) -> r5 -> r4 -> r3 -> r2 -> r1
    expect(ledger.entries[0].record.id).toBe("r6");
    expect(ledger.entries[0].isScored).toBe(false);

    // Week 3 absent broke a 2x streak (-40 polla + -30 streak lost = -70)
    const week3 = ledger.entries.find((e) => e.record.id === "r3")!;
    expect(week3.delta).toBe(-70);
    expect(week3.chips.some((c) => c.label.includes("Polla") && c.delta === -40)).toBe(true);
    expect(week3.chips.some((c) => c.label.includes("Streak Lost") && c.delta === -30)).toBe(true);

    // Week 1 had On-Time (+100) + GPS (+10) + Streak 1x (+15) = +125
    const week1 = ledger.entries.find((e) => e.record.id === "r1")!;
    expect(week1.delta).toBe(125);
    expect(week1.runningBalance).toBe(125);
  });
});
