import { NextRequest, NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor, downloadMemoryPhotoBytes } from "@/lib/memories-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/memories/photo/[photoId]
 * Authenticated photo download endpoint so swimmers & coaches can save any squad memory
 * cleanly to their phone or computer without exposing public bucket URLs.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ photoId: string }> }
) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const { photoId } = await context.params;

  const tokenHint = request.nextUrl.searchParams.get("token");
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const file = await downloadMemoryPhotoBytes(photoId);
  if (!file) {
    return NextResponse.json({ success: false, error: "Memory photo not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
