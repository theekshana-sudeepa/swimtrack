import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import {
  resolveMemoryActor,
  updateMemoryDetails,
  deleteMemoryOrPhoto,
} from "@/lib/memories-service";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/memories/[id]
 * Updates memory metadata (date, title, caption, location) or promotes a photo to Slot #1 cover.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const { id } = await context.params;

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
      { success: false, needsLogin: true, error: "Authentication required." },
      { status: 401 }
    );
  }

  const result = await updateMemoryDetails({
    actor,
    memoryId: id,
    title: typeof body.title === "string" ? body.title : undefined,
    caption:
      body.caption === null || typeof body.caption === "string"
        ? (body.caption as string | null)
        : undefined,
    location:
      body.location === null || typeof body.location === "string"
        ? (body.location as string | null)
        : undefined,
    memoryDate: typeof body.memory_date === "string" ? body.memory_date : undefined,
    coverPhotoId: typeof body.cover_photo_id === "string" ? body.cover_photo_id : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  revalidatePath("/memories");
  revalidatePath("/portal");
  if (actor.swimmerToken) {
    revalidatePath(`/portal/${actor.swimmerToken}`);
  }

  return NextResponse.json({ success: true, memory: result.memory });
}

/**
 * DELETE /api/memories/[id]?photoId=...
 * Deletes a single photo (admin = any; swimmer = own uploads only) or an entire memory day (admin only).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const { id } = await context.params;

  const photoId = request.nextUrl.searchParams.get("photoId");
  const tokenHint = request.nextUrl.searchParams.get("token");

  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json(
      { success: false, needsLogin: true, error: "Authentication required." },
      { status: 401 }
    );
  }

  const result = await deleteMemoryOrPhoto({
    actor,
    memoryId: id,
    photoId,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  revalidatePath("/memories");
  revalidatePath("/portal");
  if (actor.swimmerToken) {
    revalidatePath(`/portal/${actor.swimmerToken}`);
  }

  return NextResponse.json({
    success: true,
    deletedMemory: result.deletedMemory,
    memory: result.memory,
  });
}
