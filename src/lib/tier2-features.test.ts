import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";
import { upsertSessionRollCall, clearSessionRollCall } from "./rollcall-service";
import { createSwimLog, deleteSwimLog, computeSwimmerPRs } from "./swim-logs-service";
import { computeSquadWrapped, computeDistanceMilestone } from "./squad-wrapped";
import type { MemoryActor } from "./memories-service";

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

describe("Tier 2 — Pre-Swim Roll-Call, Swim Logs/PRs & Squad Wrapped", () => {
  beforeEach(() => {
    DataStore.resetToDemo();
  });

  it("sets, updates, and clears pre-swim live roll-call pings per swimmer", async () => {
    const session = DataStore.getSessions({ status: "all" })[0];
    expect(session).toBeDefined();

    const first = await upsertSessionRollCall({
      actor: swimmerA,
      sessionId: session.id,
      status: "awake",
      note: "Grabbing coffee",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.rollCalls).toHaveLength(1);
    expect(first.rollCalls[0].status).toBe("awake");

    // Updating replaces swimmer A's status without creating duplicates
    const second = await upsertSessionRollCall({
      actor: swimmerA,
      sessionId: session.id,
      status: "offering_ride",
      note: "2 seats from Dehiwala",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.rollCalls).toHaveLength(1);
    expect(second.rollCalls[0].status).toBe("offering_ride");

    const cleared = await clearSessionRollCall({
      actor: swimmerA,
      sessionId: session.id,
    });
    expect(cleared.rollCalls).toHaveLength(0);
  });

  it("logs swim distances, computes PRs, and enforces delete ownership", async () => {
    const log1 = await createSwimLog({
      actor: swimmerA,
      logDate: "2026-05-10",
      laps: 30,
      poolLengthMeters: 25,
      stroke: "freestyle",
      best50mSeconds: 36.2,
      feeling: "strong",
    });
    expect(log1.ok).toBe(true);
    if (!log1.ok) return;
    expect(log1.log.distance_meters).toBe(750);

    const log2 = await createSwimLog({
      actor: swimmerA,
      logDate: "2026-05-17",
      distanceMeters: 1200,
      poolLengthMeters: 50,
      stroke: "mixed",
      best50mSeconds: 33.8,
      best100mSeconds: 76.5,
      feeling: "beast",
    });
    expect(log2.ok).toBe(true);
    if (!log2.ok) return;

    const prs = computeSwimmerPRs(DataStore.getSwimLogs(), swimmerA.swimmerId);
    expect(prs.totalMeters).toBe(1950);
    expect(prs.longestSwimMeters).toBe(1200);
    expect(prs.fastest50mSeconds).toBe(33.8);
    expect(prs.fastest100mSeconds).toBe(76.5);

    // Another swimmer cannot delete Swimmer A's swim log
    const forbidden = await deleteSwimLog({ actor: swimmerB, logId: log1.log.id });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    // Owner deletes cleanly
    const deleted = await deleteSwimLog({ actor: swimmerA, logId: log1.log.id });
    expect(deleted.ok).toBe(true);
  });

  it("computes Monthly & All-Time Squad Wrapped awards and distance milestones", async () => {
    await createSwimLog({
      actor: swimmerA,
      logDate: "2026-05-10",
      distanceMeters: 1500,
      poolLengthMeters: 25,
    });

    const wrapped = computeSquadWrapped({
      monthKey: "all",
      swimmers: DataStore.getSwimmers({ status: "active" }),
      sessions: DataStore.getSessions({ status: "all" }),
      attendance: DataStore.getAllAttendance(),
      swimLogs: DataStore.getSwimLogs(),
      memories: DataStore.getMemories(),
      currentSwimmerId: swimmerA.swimmerId,
    });

    expect(wrapped.sessionsHeld).toBeGreaterThan(0);
    expect(wrapped.totalDistanceMeters).toBe(1500);
    expect(wrapped.awards.some((a) => a.id === "pool_boss")).toBe(true);
    expect(wrapped.awards.some((a) => a.id === "distance_machine")).toBe(true);
    expect(wrapped.personalSummary?.swimmerId).toBe(swimmerA.swimmerId);

    const m = computeDistanceMilestone(12_500);
    expect(m.targetMeters).toBe(30_000);
    expect(m.progressPct).toBe(42);
  });
});
