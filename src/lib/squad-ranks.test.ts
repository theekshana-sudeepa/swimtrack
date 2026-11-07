import { describe, it, expect } from "vitest";
import { getSwimmerSquadRank } from "./squad-ranks";

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
});
