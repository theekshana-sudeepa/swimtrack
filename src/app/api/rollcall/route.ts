import { NextRequest, NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import { upsertSessionRollCall, clearSessionRollCall } from "@/lib/rollcall-service";
import { rollCallRateLimiter } from "@/lib/rate-limiter";
import type { RollCallStatus } from "@/types/database";

export const dynamic = "force-dynamic";

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
      { success: false, needsLogin: true, error: "Sign in with your PIN to update roll-call." },
      { status: 401 }
    );
  }

  if (actor.role === "swimmer") {
    const key = `rc_${actor.swimmerId}`;
    const rate = rollCallRateLimiter.check(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many updates. Wait ${rate.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }
    rollCallRateLimiter.recordFailure(key);
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const status = String(body.status || "") as RollCallStatus;
  const note = typeof body.note === "string" ? body.note : null;

  const result = await upsertSessionRollCall({ actor, sessionId, status, note });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, rollCalls: result.rollCalls });
}

export async function DELETE(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
  const tokenHint = request.nextUrl.searchParams.get("token");

  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await clearSessionRollCall({ actor, sessionId });
  return NextResponse.json({ success: true, rollCalls: result.rollCalls });
}
