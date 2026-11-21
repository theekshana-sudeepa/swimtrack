import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import { resolveMemoryActor } from "@/lib/memories-service";
import {
  getExpensesFresh,
  createSquadExpense,
  type CreateExpenseParticipantInput,
} from "@/lib/expenses-service";
import { expenseRateLimiter } from "@/lib/rate-limiter";
import type { ExpenseCategory } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses
 * Lists all after-swim bill splits (Admin or PIN-authenticated Swimmer).
 */
export async function GET(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });
  const tokenHint = request.nextUrl.searchParams.get("token");
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { expenses, migrationNeeded } = await getExpensesFresh();
  return NextResponse.json(
    { success: true, expenses, migrationNeeded },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/**
 * POST /api/expenses
 * Creates a new after-swim bill / pool ticket split (Admin or PIN-authenticated Swimmer).
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
      { success: false, needsLogin: true, error: "Sign in to add a squad bill split." },
      { status: 401 }
    );
  }

  if (actor.role === "swimmer") {
    const key = `exp_${actor.swimmerId}`;
    const rate = expenseRateLimiter.check(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many splits created. Wait ${rate.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }
    expenseRateLimiter.recordFailure(key);
  }

  const rawParticipants = Array.isArray(body.participants)
    ? (body.participants as Record<string, unknown>[])
    : [];
  const participants: CreateExpenseParticipantInput[] = rawParticipants.map((p) => ({
    swimmer_id: String(p.swimmer_id || ""),
    custom_amount:
      p.custom_amount !== undefined && p.custom_amount !== null && p.custom_amount !== ""
        ? Number(p.custom_amount)
        : null,
  }));

  const result = await createSquadExpense({
    actor,
    expenseDate: String(body.expense_date || "").trim(),
    title: String(body.title || ""),
    category: (body.category as ExpenseCategory) || "pool_tickets",
    totalAmount: Number(body.total_amount),
    currency: typeof body.currency === "string" ? body.currency : "LKR",
    paidBySwimmerId:
      typeof body.paid_by_swimmer_id === "string" ? body.paid_by_swimmer_id : null,
    paidByName: typeof body.paid_by_name === "string" ? body.paid_by_name : null,
    sessionId: typeof body.session_id === "string" ? body.session_id : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    participants,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  revalidatePath("/splits");
  revalidatePath("/portal");
  if (actor.swimmerToken) revalidatePath(`/portal/${actor.swimmerToken}`);
  if (result.expense.session_id) revalidatePath(`/sessions/${result.expense.session_id}`);

  return NextResponse.json({ success: true, expense: result.expense });
}
