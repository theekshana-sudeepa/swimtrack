import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";
import { hashSwimmerPin, verifySwimmerPinSecure } from "./security";
import { SlidingWindowRateLimiter } from "./rate-limiter";

describe("DataStore In-Memory Repository", () => {
  beforeEach(() => {
    DataStore.resetToDemo();
  });

  it("loads initial demo swimmers and sessions", () => {
    const swimmers = DataStore.getSwimmers({ status: "all" });
    expect(swimmers.length).toBeGreaterThan(0);

    const activeSwimmers = DataStore.getSwimmers({ status: "active" });
    expect(activeSwimmers.length).toBe(9);

    const sessions = DataStore.getSessions({ status: "all" });
    expect(sessions.length).toBe(6);
  });

  it("updates attendance status and creates an audit log entry", () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    const swimmer = DataStore.getSwimmers({ status: "active" })[0];

    const result = DataStore.updateAttendanceStatus(
      session.id,
      swimmer.id,
      "present",
      "Arrived on time",
      "test-admin"
    );

    expect(result.record.status).toBe("present");
    expect(result.auditLog.new_status).toBe("present");
    expect(result.auditLog.session_id).toBe(session.id);
    expect(result.auditLog.swimmer_id).toBe(swimmer.id);

    // Verify retrieval
    const sessionAttendance = DataStore.getSessionAttendance(session.id);
    const updated = sessionAttendance.find((a) => a.swimmer_id === swimmer.id);
    expect(updated?.status).toBe("present");
  });

  it("filters eligible reminder recipients based on consent and active status", () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    const recipients = DataStore.getEligibleReminderRecipients(session.id);

    // Tharindu Bandara has email_reminders_enabled: false, so must be excluded
    const tharindu = recipients.find((r) => r.full_name.includes("Tharindu"));
    expect(tharindu).toBeUndefined();

    // Dinesh is archived, so must be excluded
    const dinesh = recipients.find((r) => r.full_name.includes("Dinesh"));
    expect(dinesh).toBeUndefined();

    // Liam has consent and active status, so must be included
    const liam = recipients.find((r) => r.full_name.includes("Liam"));
    expect(liam).toBeDefined();
  });

  it("supports markAllPresent and markRemainingAbsent bulk actions", () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    const initialAttendance = DataStore.getSessionAttendance(session.id);
    expect(initialAttendance.every((a) => a.status === "not_marked")).toBe(true);

    const markedCount = DataStore.markAllPresent(session.id);
    expect(markedCount).toBe(initialAttendance.length);

    const updatedAttendance = DataStore.getSessionAttendance(session.id);
    expect(updatedAttendance.every((a) => a.status === "present")).toBe(true);
  });

  it("calculates swimmer attendance rate and streak accurately against completed sessions", () => {
    // In demo data, 4 sessions are completed (sessions 1, 2, 3, 4).
    // Let's create a 5th completed session and mark a swimmer present in 4 and unmarked in 1.
    const newSession = DataStore.createSession({
      title: "Saturday Championship Endurance",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Gampaha Complex",
    });
    DataStore.finalizeSession(newSession.id);

    // Create a new swimmer who was present in 4 sessions and unmarked in 1
    const swimmer = DataStore.createSwimmer({
      full_name: "Praveen Lakshan",
      nickname: "Beast",
      email: "praveen@test.lk",
    });

    // Chronologically sort completed sessions (oldest to newest)
    const completed = DataStore.getSessions({ status: "completed" }).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    expect(completed.length).toBe(5);

    // Mark swimmer present in the 4 latest sessions (sessions 2, 3, 4, 5)
    for (let i = 1; i < completed.length; i++) {
      DataStore.updateAttendanceStatus(completed[i].id, swimmer.id, "present");
    }
    // Session 0 (oldest session) is left unmarked/missing

    const refreshedSwimmer = DataStore.getSwimmerById(swimmer.id);
    expect(refreshedSwimmer).toBeDefined();

    const stats = refreshedSwimmer?.attendance_stats;
    expect(stats).toBeDefined();
    // Total opportunities: 5 completed sessions
    expect(stats?.total).toBe(5);
    expect(stats?.present).toBe(4);
    // Unmarked completed session must be treated as absent
    expect(stats?.absent).toBe(1);
    // Rate: 4 / 5 = 80.0%
    expect(stats?.rate).toBe(80.0);
    // Current streak: 4 consecutive sessions attended
    expect(stats?.currentStreak).toBe(4);

    // Verify history includes all completed sessions
    const history = DataStore.getSwimmerAttendanceHistory(swimmer.id);
    expect(history.length).toBeGreaterThanOrEqual(5);
    const missedRecord = history.find((h) => h.session_id === completed[0].id);
    expect(missedRecord?.status).toBe("absent");
  });

  it("excludes excused sessions from rate denominator without breaking streak", () => {
    const swimmer = DataStore.createSwimmer({
      full_name: "Excused Swimmer",
      email: "excused@test.lk",
    });

    const completed = DataStore.getSessions({ status: "completed" });
    // Mark present for all except one excused
    for (let i = 0; i < completed.length - 1; i++) {
      DataStore.updateAttendanceStatus(completed[i].id, swimmer.id, "present");
    }
    // Excuse the last session
    DataStore.updateAttendanceStatus(completed[completed.length - 1].id, swimmer.id, "excused", "Medical reason");

    const refreshedSwimmer = DataStore.getSwimmerById(swimmer.id);
    const stats = refreshedSwimmer?.attendance_stats;

    expect(stats?.present).toBe(completed.length - 1);
    expect(stats?.excused).toBe(1);
    expect(stats?.absent).toBe(0);
    // Denominator should exclude excused: (completed - 1) / (completed - 1) = 100%
    expect(stats?.total).toBe(completed.length - 1);
    expect(stats?.rate).toBe(100.0);
    expect(stats?.currentStreak).toBe(completed.length - 1);
  });

  describe("Option 1: Swimmer Security PIN System", () => {
    it("hashes and securely verifies swimmer 4-digit PINs", () => {
      const swimmerId = "test-swimmer-id-123";

      // Initially no PIN
      expect(DataStore.hasSwimmerPin(swimmerId)).toBe(false);
      expect(DataStore.getSwimmerPinHash(swimmerId)).toBeNull();

      // Set PIN
      const pin = "4829";
      const hashed = hashSwimmerPin(swimmerId, pin);
      DataStore.setSwimmerPin(swimmerId, hashed);

      // Verify state
      expect(DataStore.hasSwimmerPin(swimmerId)).toBe(true);
      const stored = DataStore.getSwimmerPinHash(swimmerId);
      expect(stored).toBe(hashed);

      // Successful verification
      expect(verifySwimmerPinSecure(swimmerId, "4829", stored)).toBe(true);

      // Failed verifications
      expect(verifySwimmerPinSecure(swimmerId, "0000", stored)).toBe(false);
      expect(verifySwimmerPinSecure(swimmerId, "4828", stored)).toBe(false);
      expect(verifySwimmerPinSecure("different-swimmer-id", "4829", stored)).toBe(false);

      // Deletion (admin reset)
      DataStore.deleteSwimmerPin(swimmerId);
      expect(DataStore.hasSwimmerPin(swimmerId)).toBe(false);
      expect(DataStore.getSwimmerPinHash(swimmerId)).toBeNull();
    });

    it("rate limits brute-force PIN attempts after 5 failures", () => {
      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60 * 1000,
        maxAttempts: 5,
        lockoutMs: 5 * 60 * 1000,
      });

      const key = "pin_attempt_key_abc";

      // First 5 attempts permitted
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(key).allowed).toBe(true);
        limiter.recordFailure(key);
      }

      // 6th attempt locked out
      const checkBlocked = limiter.check(key);
      expect(checkBlocked.allowed).toBe(false);
      expect(checkBlocked.remainingAttempts).toBe(0);
      expect(checkBlocked.retryAfterSeconds).toBeGreaterThan(0);

      // Reset permits again
      limiter.reset(key);
      expect(limiter.check(key).allowed).toBe(true);
    });
  });
});

