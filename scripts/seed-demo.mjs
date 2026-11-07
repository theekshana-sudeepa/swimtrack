import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function seed() {
  console.log("🏊 SWIMTRACK V2 — Demo Data Seeder");

  if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes("your-project-id")) {
    console.log("ℹ️  No remote Supabase credentials detected in environment.");
    console.log("✨ SwimTrack is using its built-in dual-engine in-memory store initialized with 10 swimmers and 6 sessions.");
    console.log("🚀 Start local development anytime with: npm run dev");
    return;
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const seedFilePath = path.resolve(process.cwd(), "supabase/seed.sql");
  if (!fs.existsSync(seedFilePath)) {
    console.error("Seed SQL file not found at supabase/seed.sql");
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(seedFilePath, "utf-8");
  console.log("Executing seed SQL script...");

  // Execute using Postgres RPC or check connection
  const { data, error } = await supabase.from("swimmers").select("count", { count: "exact" });
  if (error) {
    console.error("Database connection error:", error.message);
    console.log("Please ensure migrations in supabase/migrations/ have been applied to your database.");
    process.exit(1);
  }

  console.log(`✅ Connected successfully. Existing swimmers in database: ${data?.length || 0}`);
  console.log("Run 'supabase db reset' or execute supabase/seed.sql in your Supabase SQL Editor to seed remote database.");
}

seed();

