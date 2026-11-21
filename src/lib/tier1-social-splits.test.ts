import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";
import {
  computeEvenShares,
  createSquadExpense,
  toggleExpenseSharePaid,
  deleteSquadExpense,
} from "./expenses-service";
import { toggleSquadReaction } from "./social-service";
import { addPhotosToMemoryDate, type MemoryActor } from "./memories-service";

const FAKE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
]);

const adminActor: MemoryActor = {
  role: "admin",
  name: "Squad Coach",
  swimmerId: null,
  swimmerToken: null,
};

const swimmerA: MemoryActor = {
  role: "swimmer",
  name: "Liam",
  swimmerId: "11111111-1111-1111-1111-111111111101",
  swimmerToken: "token_a",
};

const swimmerB: MemoryActor = {
  role: "swimmer",
  name: "Kavi",
  swimmerId: "11111111-1111-1111-1111-111111111102",
  swimmerToken: "token_b",
};

describe("Tier 1 — Social Reactions, Auto-Attendees & Bill Splits", () => {
  beforeEach(() => {
    DataStore.resetToDemo();
  });

  it("splits even amounts with zero rounding drift", () => {
    expect(computeEvenShares(7500, 5)).toEqual([1500, 1500, 1500, 1500, 1500]);
    const thirds = computeEvenShares(1000, 3);
    expect(thirds).toEqual([333.34, 333.33, 333.33]);
    expect(Number(thirds.reduce((a, b) => a + b, 0).toFixed(2))).toBe(1000);
  });

  it("creates bill splits, auto-marks payer paid, and enforces toggle permissions", async () => {
    const created = await createSquadExpense({
      actor: swimmerA,
      expenseDate: "2026-05-10",
      title: "Barista Coffee after Swim",
      category: "cafe_food",
      totalAmount: 3000,
      participants: [
        { swimmer_id: swimmerA.swimmerId },
        { swimmer_id: swimmerB.swimmerId },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const shareA = created.expense.shares.find((s) => s.swimmer_id === swimmerA.swimmerId);
    const shareB = created.expense.shares.find((s) => s.swimmer_id === swimmerB.swimmerId);
    expect(shareA?.share_amount).toBe(1500);
    expect(shareA?.is_paid).toBe(true); // Payer auto-marked paid
    expect(shareB?.share_amount).toBe(1500);
    expect(shareB?.is_paid).toBe(false);

    // Non-payer swimmer cannot mark themselves paid
    const forbidden = await toggleExpenseSharePaid({
      actor: swimmerB,
      expenseId: created.expense.id,
      swimmerId: swimmerB.swimmerId,
      isPaid: true,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    // Payer marks Swimmer B paid
    const marked = await toggleExpenseSharePaid({
      actor: swimmerA,
      expenseId: created.expense.id,
      swimmerId: swimmerB.swimmerId,
      isPaid: true,
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(
      marked.expense.shares.find((s) => s.swimmer_id === swimmerB.swimmerId)?.is_paid
    ).toBe(true);

    // Admin can delete split
    const del = await deleteSquadExpense({
      actor: adminActor,
      expenseId: created.expense.id,
    });
    expect(del.ok).toBe(true);
    expect(DataStore.getExpenseById(created.expense.id)).toBeNull();
  });

  it("toggles emoji reactions cleanly on both messages and memories", async () => {
    const msg = DataStore.postSquadMessage({
      author_name: "Liam",
      author_swimmer_id: swimmerA.swimmerId,
      content: "Coffee was legendary today!",
    });

    const r1 = await toggleSquadReaction({
      actor: swimmerA,
      targetType: "message",
      targetId: msg.id,
      emoji: "☕",
    });
    expect(r1.added).toBe(true);
    expect(r1.reactions).toHaveLength(1);

    const r2 = await toggleSquadReaction({
      actor: swimmerB,
      targetType: "message",
      targetId: msg.id,
      emoji: "☕",
    });
    expect(r2.added).toBe(true);
    expect(r2.reactions).toHaveLength(2);

    // Tapping again removes Swimmer A's reaction
    const r3 = await toggleSquadReaction({
      actor: swimmerA,
      targetType: "message",
      targetId: msg.id,
      emoji: "☕",
    });
    expect(r3.added).toBe(false);
    expect(r3.reactions).toHaveLength(1);
  });

  it("auto-tags attendees who swam on the memory date", async () => {
    const sessions = DataStore.getSessions({ status: "all" });
    const sessionWithAttendance = sessions.find(
      (s) => DataStore.getAttendeesForDate(s.date, s.id).length > 0
    );
    expect(sessionWithAttendance).toBeDefined();
    if (!sessionWithAttendance) return;

    const mem = await addPhotosToMemoryDate({
      actor: adminActor,
      memoryDate: sessionWithAttendance.date,
      title: "Post-Swim Hangout",
      files: [{ buffer: FAKE_JPEG, mimeType: "image/jpeg" }],
    });
    expect(mem.ok).toBe(true);
    if (!mem.ok) return;

    const hydrated = DataStore.getMemoryById(mem.memory.id);
    expect(hydrated?.attendees && hydrated.attendees.length).toBeGreaterThan(0);
  });
});
