import { NextRequest, NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import { isValidReactionEmoji, toggleSquadReaction } from "@/lib/social-service";
import { reactionRateLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * POST /api/reactions
 * Toggles an emoji reaction (`🔥`, `😂`, `❤️`, `🏊`, `☕`) on a Squad Memory or Chalkboard message.
 */
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
      { success: false, needsLogin: true, error: "Sign in to react." },
      { status: 401 }
    );
  }

  if (actor.role === "swimmer") {
    const key = `react_${actor.swimmerId}`;
    const rate = reactionRateLimiter.check(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Slow down! Try again in ${rate.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }
    reactionRateLimiter.recordFailure(key);
  }

  const targetType = body.target_type === "message" ? "message" : body.target_type === "memory" ? "memory" : null;
  const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";

  if (!targetType || !targetId) {
    return NextResponse.json(
      { success: false, error: "Valid target_type and target_id are required." },
      { status: 400 }
    );
  }

  if (!isValidReactionEmoji(emoji)) {
    return NextResponse.json(
      { success: false, error: "Unsupported reaction emoji." },
      { status: 400 }
    );
  }

  const res = await toggleSquadReaction({
    actor,
    targetType,
    targetId,
    emoji,
  });

  return NextResponse.json({
    success: true,
    added: res.added,
    reactions: res.reactions,
  });
}
