import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import { createSwimLog } from "@/lib/swim-logs-service";
import { swimLogRateLimiter } from "@/lib/rate-limiter";
import type { SwimFeeling, SwimStroke } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const tokenHint = request.nextUrl.searchParams.get("token");
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(
    { success: true, logs: DataStore.getSwimLogs() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const tokenHint = typeof body.swimmer_token === "string" ? body.swimmer_token : null;
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json(
      { success: false, needsLogin: true, error: "Sign in with your PIN to log your swim." },
      { status: 401 }
    );
  }

  if (actor.role === "swimmer") {
    const key = `slog_${actor.swimmerId}`;
    const rate = swimLogRateLimiter.check(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Slow down! Try again in ${rate.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }
    swimLogRateLimiter.recordFailure(key);
  }

  const result = await createSwimLog({
    actor,
    logDate: String(body.log_date || "").trim(),
    distanceMeters: body.distance_meters != null ? Number(body.distance_meters) : null,
    laps: body.laps != null ? Number(body.laps) : null,
    poolLengthMeters: Number(body.pool_length_meters) === 50 ? 50 : 25,
    stroke: (body.stroke as SwimStroke) || "freestyle",
    durationMinutes:
      body.duration_minutes != null && body.duration_minutes !== ""
        ? Number(body.duration_minutes)
        : null,
    best50mSeconds:
      body.best_50m_seconds != null && body.best_50m_seconds !== ""
        ? Number(body.best_50m_seconds)
        : null,
    best100mSeconds:
      body.best_100m_seconds != null && body.best_100m_seconds !== ""
        ? Number(body.best_100m_seconds)
        : null,
    feeling: (body.feeling as SwimFeeling) || "strong",
    notes: typeof body.notes === "string" ? body.notes : null,
    sessionId: typeof body.session_id === "string" ? body.session_id : null,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  if (actor.swimmerToken) revalidatePath(`/portal/${actor.swimmerToken}`);
  revalidatePath("/analytics");

  return NextResponse.json({ success: true, log: result.log });
}
