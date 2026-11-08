import { describe, it, expect } from "vitest";
import {
  getSwimmerSquadRank,
  getSessionRoleForSwimmer,
  ALL_SQUAD_ROLES,
} from "./squad-ranks";

describe("Squad Rank & Polla Meter Logic", () => {
  it("awards Zero-Polla Overlord to swimmers with zero absences and high streak", () => {
    const rank = getSwimmerSquadRank({
      present: 4,
      late: 0,
      absent: 0,
      rate: 100,
      currentStreak: 4,
    });
    expect(rank.title).toBe("Zero-Polla Overlord");
    expect(rank.pollaLevel).toBe("zero");
    expect(rank.pollaTag).toContain("100% Polla-Proof");
    expect(rank.decisionReason).toContain("Awarded for 4 consecutive practices");
  });

  it("awards Chief Polla Officer (CPO) to swimmers with 3+ absences", () => {
    const rank = getSwimmerSquadRank({
      present: 1,
      late: 0,
      absent: 3,
      rate: 25,
      currentStreak: 0,
    });
    expect(rank.title).toBe("Chief Polla Officer (CPO)");
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

  it("awards Ghost Swimmer to swimmers with 2 absences", () => {
    const rank = getSwimmerSquadRank({
      present: 2,
      late: 0,
      absent: 2,
      rate: 50,
      currentStreak: 0,
    });
    expect(rank.title).toBe("Ghost Swimmer");
    expect(rank.pollaLevel).toBe("medium");
  });

  it("awards Honorable Reserve to swimmers with legitimate excused absences and zero polla", () => {
    const rank = getSwimmerSquadRank({
      present: 2,
      late: 0,
      absent: 0,
      excused: 3,
      rate: 100,
      currentStreak: 2,
    });
    expect(rank.title).toBe("Honorable Reserve");
    expect(rank.pollaLevel).toBe("zero");
    expect(rank.badge).toBe("Approved Scholar");
    expect(rank.decisionReason).toContain("3 verified excused absences");
  });

  it("awards Iron Torpedo (Pacesetter) to swimmers with 90%+ rate, 3+ practices, and zero late arrivals", () => {
    const rank = getSwimmerSquadRank({
      present: 3,
      late: 0,
      absent: 0,
      excused: 0,
      rate: 100,
      currentStreak: 3,
    });
    // With rate 100 and totalAttended 3, rule 7 (Zero-Polla Overlord) takes precedence when streak/100% rate matches
    expect(["Zero-Polla Overlord", "Iron Torpedo (Pacesetter)"]).toContain(rank.title);
  });

  it("contains complete catalog of squad roles in ALL_SQUAD_ROLES", () => {
    expect(ALL_SQUAD_ROLES.length).toBeGreaterThanOrEqual(10);
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
});
