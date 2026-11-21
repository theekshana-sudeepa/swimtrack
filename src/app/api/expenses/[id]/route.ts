import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import { toggleExpenseSharePaid, deleteSquadExpense } from "@/lib/expenses-service";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/expenses/[id]
 * Marks a swimmer's share as Paid or Pending (Admin or Payer only).
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
    return NextResponse.json({ success: false, needsLogin: true, error: "Unauthorized." }, { status: 401 });
  }

  const swimmerId = typeof body.swimmer_id === "string" ? body.swimmer_id.trim() : "";
  const isPaid = Boolean(body.is_paid);

  if (!swimmerId) {
    return NextResponse.json({ success: false, error: "swimmer_id is required." }, { status: 400 });
  }

  const result = await toggleExpenseSharePaid({
    actor,
    expenseId: id,
    swimmerId,
    isPaid,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  revalidatePath("/splits");
  revalidatePath("/portal");
  if (actor.swimmerToken) revalidatePath(`/portal/${actor.swimmerToken}`);

  return NextResponse.json({ success: true, expense: result.expense });
}

/**
 * DELETE /api/expenses/[id]
 * Deletes a bill split (Admin or Payer only).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const { id } = await context.params;

  const tokenHint = request.nextUrl.searchParams.get("token");
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, needsLogin: true, error: "Unauthorized." }, { status: 401 });
  }

  const result = await deleteSquadExpense({ actor, expenseId: id });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  revalidatePath("/splits");
  revalidatePath("/portal");
  if (actor.swimmerToken) revalidatePath(`/portal/${actor.swimmerToken}`);

  return NextResponse.json({ success: true });
}
