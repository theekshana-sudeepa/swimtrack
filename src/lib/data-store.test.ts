import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";

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
});
