import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const screenshotDir = path.resolve(process.cwd(), "docs/screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("🚀 Starting SwimTrack Next.js server for screenshots...");
  const server = spawn("npm", ["run", "start"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" },
  });

  // Wait for server to boot
  await wait(5000);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2, // Retina quality
  });

  const page = await context.newPage();

  try {
    console.log("📸 1. Capturing Public Landing Page...");
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotDir, "landing.png") });

    console.log("🔐 Logging in as Admin...");
    await page.goto("http://localhost:3000/login");
    await page.waitForLoadState("networkidle");
    // Click instant demo sign in
    await page.click('button:has-text("Instant Demo Admin Sign In")');
    await page.waitForURL("**/dashboard");
    await page.waitForLoadState("networkidle");
    await wait(1000);

    console.log("📸 2. Capturing Dashboard...");
    await page.screenshot({ path: path.join(screenshotDir, "dashboard.png") });

    console.log("📸 3. Capturing Attendance Command Center...");
    await page.goto("http://localhost:3000/attendance");
    await page.waitForLoadState("networkidle");
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotDir, "attendance.png") });

    console.log("📸 4. Capturing Swimmers Roster...");
    await page.goto("http://localhost:3000/swimmers");
    await page.waitForLoadState("networkidle");
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotDir, "swimmers.png") });

    console.log("📸 5. Capturing Calendar Agenda...");
    await page.goto("http://localhost:3000/calendar");
    await page.waitForLoadState("networkidle");
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotDir, "calendar.png") });

    console.log("📸 6. Capturing Reminders & Email Preview...");
    await page.goto("http://localhost:3000/reminders");
    await page.waitForLoadState("networkidle");
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotDir, "reminders.png") });

    console.log("📸 7. Capturing Participation Analytics...");
    await page.goto("http://localhost:3000/analytics");
    await page.waitForLoadState("networkidle");
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotDir, "analytics.png") });

    console.log("📱 8. Capturing Mobile Attendance Screen...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    // Set admin cookie on mobile context
    await mobileContext.addCookies([
      {
        name: "swimtrack_admin_session",
        value: "swimtrack_demo_admin_authenticated_2026",
        domain: "localhost",
        path: "/",
      },
    ]);
    await mobilePage.goto("http://localhost:3000/attendance");
    await mobilePage.waitForLoadState("networkidle");
    await wait(1000);
    await mobilePage.screenshot({ path: path.join(screenshotDir, "mobile-attendance.png") });

    console.log("✅ All screenshots captured successfully in docs/screenshots/ !");
  } catch (err) {
    console.error("Error capturing screenshots:", err);
  } finally {
    await browser.close();
    server.kill();
  }
}

run();

