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

    const markedCount = DataStore.markAllPresent(session.id).length;
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

  it("deletes a session and cascades cleanup to attendance and audit logs", () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    const initialAttendance = DataStore.getSessionAttendance(session.id);
    expect(initialAttendance.length).toBeGreaterThan(0);

    const deleted = DataStore.deleteSession(session.id);
    expect(deleted).toBe(true);

    // Session is no longer in store
    expect(DataStore.getSessionById(session.id)).toBeNull();

    // Attendance records for this session are cleaned up
    const remainingAttendance = DataStore.getSessionAttendance(session.id);
    expect(remainingAttendance.length).toBe(0);

    // Audit logs for this session are cleaned up
    const remainingAudit = DataStore.getAttendanceAuditLogs({ sessionId: session.id });
    expect(remainingAudit.length).toBe(0);
  });

  it("does not return expired past sessions as upcoming and handles self-reported excuses", () => {
    // In initial demo data, sessions are scheduled on 2026-11-07 and 2026-11-11
    // Which are in the past relative to current local date
    const swimmer = DataStore.getSwimmers({ status: "active" })[0];

    // Create a real future session
    const futureSession = DataStore.createSession({
      title: "Tomorrow Sunrise Practice",
      date: "2099-12-01",
      start_time: "06:00:00",
      end_time: "07:30:00",
      location: "Olympic Pool Complex",
    });

    const nextUpcoming = DataStore.getNextUpcomingSession();
    expect(nextUpcoming).not.toBeNull();
    expect(nextUpcoming?.id).toBe(futureSession.id);

    // Swimmer self-reports an excuse for the future session
    const excuse = DataStore.submitSwimmerExcuse(swimmer.id, futureSession.id, "declare", "Exam");
    expect(excuse.success).toBe(true);
    if (excuse.success) {
      expect(excuse.record.status).toBe("excused");
    }

    // ...and can clear it again, returning to not_marked (never present)
    const cleared = DataStore.submitSwimmerExcuse(swimmer.id, futureSession.id, "clear");
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect(cleared.record.status).toBe("not_marked");
    }

    // Clean up future session
    DataStore.deleteSession(futureSession.id);

    // Now all sessions in store are past (from early November 2026)
    // getNextUpcomingSession MUST return null instead of falling back to stale past sessions
    const expiredNext = DataStore.getNextUpcomingSession();
    expect(expiredNext).toBeNull();
  });

  describe("Swimmer excuse integrity", () => {
    function makeSession() {
      return DataStore.createSession({
        title: "Integrity Practice",
        date: "2099-12-02",
        start_time: "06:00:00",
        end_time: "07:30:00",
        location: "Olympic Pool Complex",
      });
    }

    it("never lets a swimmer overwrite a verified present/late record", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      const session = makeSession();
      DataStore.checkInSwimmerWithGeofence(swimmer.id, session.id, "present", 10, 8, "Self check-in");

      const res = DataStore.submitSwimmerExcuse(swimmer.id, session.id, "declare", "Changed my mind");
      expect(res.success).toBe(false);
      const rec = DataStore.getSessionAttendance(session.id).find((a) => a.swimmer_id === swimmer.id);
      expect(rec?.status).toBe("present");
      DataStore.deleteSession(session.id);
    });

    it("never lets a swimmer launder a coach-marked absence into an excuse or clear it", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      const session = makeSession();
      DataStore.updateAttendanceStatus(session.id, swimmer.id, "absent", "No show");

      expect(DataStore.submitSwimmerExcuse(swimmer.id, session.id, "declare", "x").success).toBe(false);
      expect(DataStore.submitSwimmerExcuse(swimmer.id, session.id, "clear").success).toBe(false);
      DataStore.deleteSession(session.id);
    });

    it("cannot clear a coach-recorded excuse", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      const session = makeSession();
      DataStore.updateAttendanceStatus(session.id, swimmer.id, "excused", "Excused: Sick");

      expect(DataStore.submitSwimmerExcuse(swimmer.id, session.id, "declare", "x").success).toBe(false);
      DataStore.deleteSession(session.id);
    });
  });

  describe("Bulk actions and check-in provenance", () => {
    function makeSession() {
      return DataStore.createSession({
        title: "Bulk Practice",
        date: "2099-12-03",
        start_time: "06:00:00",
        end_time: "07:30:00",
        location: "Olympic Pool Complex",
      });
    }

    it("markAllPresent only changes unmarked swimmers and never overwrites late/excused/absent/GPS", () => {
      const [a, b, c, d] = DataStore.getSwimmers({ status: "active" });
      const session = makeSession();
      DataStore.updateAttendanceStatus(session.id, a.id, "late", "Late 10m");
      DataStore.updateAttendanceStatus(session.id, b.id, "excused", "Excused: Sick");
      DataStore.updateAttendanceStatus(session.id, c.id, "absent", "No show");
      DataStore.checkInSwimmerWithGeofence(d.id, session.id, "present", 12, 8, "GPS");

      const changed = DataStore.markAllPresent(session.id);
      const get = (id: string) =>
        DataStore.getSessionAttendance(session.id).find((r) => r.swimmer_id === id)!;

      expect(get(a.id).status).toBe("late");
      expect(get(b.id).status).toBe("excused");
      expect(get(c.id).status).toBe("absent");
      expect(get(d.id).checkin_method).toBe("geofence_self");
      expect(changed.every((r) => r.status === "present" && r.checkin_method === "bulk")).toBe(true);
      DataStore.deleteSession(session.id);
    });

    it("a coach status change replaces GPS provenance, a note-only edit keeps it", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      const session = makeSession();
      DataStore.checkInSwimmerWithGeofence(swimmer.id, session.id, "present", 12, 8, "GPS");

      const noteOnly = DataStore.updateAttendanceStatus(session.id, swimmer.id, "present", "extra note");
      expect(noteOnly.record.checkin_method).toBe("geofence_self");
      expect(noteOnly.record.checkin_distance).toBe(12);

      const changed = DataStore.updateAttendanceStatus(session.id, swimmer.id, "absent", "left early");
      expect(changed.record.checkin_method).toBe("coach_manual");
      expect(changed.record.checkin_distance).toBeNull();
      DataStore.deleteSession(session.id);
    });

    it("revertAttendanceChange restores the previous record and drops the audit entry", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      const session = makeSession();

      const result = DataStore.checkInSwimmerWithGeofence(swimmer.id, session.id, "present", 12, 8, "GPS");
      DataStore.revertAttendanceChange(session.id, swimmer.id, null, result.auditLog.id);

      const rec = DataStore.getSessionAttendance(session.id).find((r) => r.swimmer_id === swimmer.id);
      expect(rec?.status ?? "not_marked").toBe("not_marked");
      expect(DataStore.getAttendanceAuditLogs({ sessionId: session.id }).some((l) => l.id === result.auditLog.id)).toBe(false);
      DataStore.deleteSession(session.id);
    });
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

    it("never resolves a swimmer pass by email address or raw swimmer ID", () => {
      const swimmer = DataStore.getSwimmers({ status: "active" })[0];
      expect(swimmer.email).toBeTruthy();

      // Discoverable identifiers must NEVER authenticate a swimmer pass
      expect(DataStore.getSwimmerByToken(swimmer.id)).toBeNull();
      expect(DataStore.getSwimmerByToken(swimmer.email!)).toBeNull();

      // Only the secret pass token resolves the swimmer
      const validToken = swimmer.reminder_preferences?.opt_out_token;
      expect(validToken).toBeTruthy();
      expect(DataStore.getSwimmerByToken(validToken!)?.id).toBe(swimmer.id);
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

    it("resolves known pool coordinates and persists custom pool location updates", () => {
      const session = DataStore.createSession({
        title: "Pool Change Test",
        date: "2099-12-10",
        start_time: "15:00:00",
        end_time: "16:45:00",
        location: "Ranaviru Apparels Swimming Pool, Yakkala",
      });

      expect(session.latitude).toBeCloseTo(7.0785, 4);
      expect(session.longitude).toBeCloseTo(80.036, 3);
      expect(session.geofence_radius).toBe(75);

      const updated = DataStore.updateSession(session.id, {
        location: "Custom Pinned Pool",
        latitude: 6.9271,
        longitude: 79.8612,
        geofence_radius: 100,
      });

      expect(updated?.location).toBe("Custom Pinned Pool");
      expect(updated?.latitude).toBeCloseTo(6.9271, 4);
      expect(updated?.longitude).toBeCloseTo(79.8612, 4);
      expect(updated?.geofence_radius).toBe(100);

      const override = DataStore.getSessionGeofenceOverride(session.id);
      expect(override?.location).toBe("Custom Pinned Pool");
      expect(override?.latitude).toBeCloseTo(6.9271, 4);
      expect(override?.longitude).toBeCloseTo(79.8612, 4);
      expect(override?.geofence_radius).toBe(100);

      DataStore.deleteSession(session.id);
    });
  });
});

