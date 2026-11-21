import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import { deleteSwimLog } from "@/lib/swim-logs-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const { id } = await context.params;
  const tokenHint = request.nextUrl.searchParams.get("token");

  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await deleteSwimLog({ actor, logId: id });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  if (actor.swimmerToken) revalidatePath(`/portal/${actor.swimmerToken}`);
  revalidatePath("/analytics");

  return NextResponse.json({ success: true });
}
