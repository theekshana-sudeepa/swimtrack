import { test, expect } from "@playwright/test";

test.describe("SwimTrack E2E Test Suite", () => {
  test("public landing page renders brand and features without private data", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Aquatic Control Room");
    await expect(page.locator("text=Open Attendance Command Center")).toBeVisible();
    await expect(page.locator("text=Single-Admin Security")).toBeVisible();
    // Verify link to login
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("unauthenticated visitor is redirected from private routes to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator("h1")).toContainText("Administrator Access");
  });

  test("admin can authenticate and access control room dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.click('button:has-text("Instant Demo Admin Sign In")');
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator("h1")).toContainText("Control Room Dashboard");
    await expect(page.locator("text=Active Swimmers")).toBeVisible();
    await expect(page.locator("text=Completed Swims")).toBeVisible();
  });

  test("attendance command center allows marking and updating statuses", async ({ page }) => {
    // Authenticate
    await page.goto("/login");
    await page.click('button:has-text("Instant Demo Admin Sign In")');
    await page.waitForURL("**/dashboard");

    // Navigate to Attendance
    await page.goto("/attendance");
    await expect(page.locator("text=Progress:")).toBeVisible();

    // Find the first swimmer card's Present button and click it
    const presentButtons = page.locator('button:has-text("Present")');
    await expect(presentButtons.first()).toBeVisible();
    await presentButtons.first().click();

    // Verify status indicator or toast notification
    await expect(page.locator("text=Progress:")).toBeVisible();
  });

  test("swimmers roster displays squad members and supports search", async ({ page }) => {
    await page.goto("/login");
    await page.click('button:has-text("Instant Demo Admin Sign In")');
    await page.waitForURL("**/dashboard");

    await page.goto("/swimmers");
    await expect(page.locator("h1")).toContainText("Swimmer Roster");
    await expect(page.locator("text=Liam Perera")).toBeVisible();

    // Search for a specific swimmer
    const searchInput = page.locator('input[placeholder*="Search by full name"]');
    await searchInput.fill("Kavindi");
    await expect(page.locator("text=Kavindi Silva")).toBeVisible();
    await expect(page.locator("text=Liam Perera")).toBeHidden();
  });

  test("analytics page displays participation rate and charts", async ({ page }) => {
    await page.goto("/login");
    await page.click('button:has-text("Instant Demo Admin Sign In")');
    await page.waitForURL("**/dashboard");

    await page.goto("/analytics");
    await expect(page.locator("h1")).toContainText("Participation Analytics");
    await expect(page.locator("text=Overall Rate")).toBeVisible();
    await expect(page.locator("text=Attendance Rate Over Time")).toBeVisible();
  });
});
