import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";
import { sendSessionReminder, sendAdminNewSwimmerAlert } from "./resend-service";

describe("Reminder Service and Duplicate Protection", () => {
  beforeEach(() => {
    DataStore.resetToDemo();
  });

  it("skips recipients who do not have email consent", async () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    // Tharindu has email_reminders_enabled: false
    const swimmer = DataStore.getSwimmerById("11111111-1111-1111-1111-111111111108")!;

    const result = await sendSessionReminder({
      session,
      swimmer,
      isDryRun: true,
    });

    expect(result.status).toBe("skipped");
    expect(result.error).toContain("opted out or disabled");
  });

  it("prevents duplicate deliveries for the same claim key", async () => {
    const session = DataStore.getSessions({ status: "scheduled" })[0];
    const swimmer = DataStore.getSwimmerById("11111111-1111-1111-1111-111111111101")!;

    // First send
    const firstResult = await sendSessionReminder({
      session,
      swimmer,
      reminderType: "upcoming",
      isDryRun: false,
    });
    expect(firstResult.status).toBe("sent");

    // Attempt second send with identical claim key
    const secondResult = await sendSessionReminder({
      session,
      swimmer,
      reminderType: "upcoming",
      isDryRun: false,
    });
    expect(secondResult.status).toBe("skipped");
    expect(secondResult.error).toContain("already sent");
  });

  it("dispatches admin new swimmer alert with simulated id in test environment", async () => {
    const swimmer = DataStore.getSwimmerById("11111111-1111-1111-1111-111111111101")!;
    const res = await sendAdminNewSwimmerAlert({ swimmer });
    expect(res.success).toBe(true);
    expect(res.messageId).toContain("sim_admin_alert_");
  });

  it("allows custom admin email override", async () => {
    const swimmer = DataStore.getSwimmerById("11111111-1111-1111-1111-111111111101")!;
    const res = await sendAdminNewSwimmerAlert({
      swimmer,
      overrideAdminEmail: "theekshanasudeepa4@gmail.com",
    });
    expect(res.success).toBe(true);
    expect(res.messageId).toBeDefined();
  });
});

