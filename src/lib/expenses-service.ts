import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import { sanitizeString } from "./security";
import { isValidMemoryDate, type MemoryActor } from "./memories-service";
import type {
  ExpenseCategory,
  SquadExpense,
  SquadExpenseShare,
} from "@/types/database";

export const VALID_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "pool_tickets",
  "cafe_food",
  "transport",
  "gear",
  "other",
];

function isUuid(val?: string | null): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Splits a total amount evenly across N participants with zero rounding drift.
 * Works in integer cents internally so the sum of shares ALWAYS equals totalAmount exactly.
 */
export function computeEvenShares(totalAmount: number, count: number): number[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || count <= 0) return [];
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents - baseCents * count;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    result.push(Number(((baseCents + extra) / 100).toFixed(2)));
  }
  return result;
}

/**
 * Formats LKR currency cleanly (e.g. "LKR 1,500" or "LKR 1,250.50").
 */
export function formatLkr(amount: number, currency = "LKR"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safe * 100) % 100 !== 0;
  return `${currency} ${safe.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/**
 * Fetches fresh Squad Expenses from Supabase (or DataStore fallback).
 */
export async function getExpensesFresh(): Promise<{
  expenses: SquadExpense[];
  migrationNeeded: boolean;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { expenses: DataStore.getExpenses(), migrationNeeded: false };
  }

  try {
    const { data, error } = await supabase
      .from("squad_expenses")
      .select("*, squad_expense_shares(*)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      const missing =
        error.code === "42P01" ||
        error.message?.toLowerCase().includes("squad_expenses") ||
        error.message?.toLowerCase().includes("does not exist");
      if (missing) {
        return { expenses: [], migrationNeeded: true };
      }
      return { expenses: DataStore.getExpenses(), migrationNeeded: false };
    }

    const mapped: SquadExpense[] = (data || []).map((row: Record<string, unknown>) => {
      const rawShares = Array.isArray(row.squad_expense_shares)
        ? (row.squad_expense_shares as Record<string, unknown>[])
        : [];
      const shares: SquadExpenseShare[] = rawShares.map((s) => ({
        id: s.id as string,
        expense_id: s.expense_id as string,
        swimmer_id: s.swimmer_id as string,
        swimmer_name: (s.swimmer_name as string) || "Swimmer",
        share_amount: Number(s.share_amount) || 0,
        is_paid: Boolean(s.is_paid),
        paid_at: (s.paid_at as string) || null,
        marked_by: (s.marked_by as string) || null,
      }));

      return {
        id: row.id as string,
        expense_date: row.expense_date as string,
        session_id: (row.session_id as string) || null,
        title: (row.title as string) || "Squad Split",
        category: ((row.category as ExpenseCategory) || "pool_tickets"),
        currency: (row.currency as string) || "LKR",
        total_amount: Number(row.total_amount) || 0,
        paid_by_name: (row.paid_by_name as string) || "Squad Coach",
        paid_by_swimmer_id: (row.paid_by_swimmer_id as string) || null,
        notes: (row.notes as string) || null,
        created_at: (row.created_at as string) || new Date().toISOString(),
        updated_at: (row.updated_at as string) || undefined,
        shares,
      };
    });

    DataStore.hydrateExpenses(mapped);
    return { expenses: DataStore.getExpenses(), migrationNeeded: false };
  } catch {
    return { expenses: DataStore.getExpenses(), migrationNeeded: false };
  }
}

export interface CreateExpenseParticipantInput {
  swimmer_id: string;
  custom_amount?: number | null;
}

/**
 * Creates a new after-swim bill / pool ticket split and computes exact per-swimmer shares.
 * Automatically marks the payer's own share as Paid.
 */
export async function createSquadExpense(params: {
  actor: MemoryActor;
  expenseDate: string;
  title: string;
  category: ExpenseCategory;
  totalAmount: number;
  currency?: string;
  paidBySwimmerId?: string | null;
  paidByName?: string | null;
  sessionId?: string | null;
  notes?: string | null;
  participants: CreateExpenseParticipantInput[];
}): Promise<
  | { ok: true; expense: SquadExpense }
  | { ok: false; status: number; error: string }
> {
  const { actor, expenseDate } = params;

  if (!isValidMemoryDate(expenseDate)) {
    return { ok: false, status: 400, error: "Please select a valid date (YYYY-MM-DD)." };
  }

  const cleanTitle = sanitizeString(params.title || "", 120);
  if (!cleanTitle || cleanTitle.length < 2) {
    return { ok: false, status: 400, error: "Please enter a bill title (e.g. Pool Tickets & Barista)." };
  }

  const category: ExpenseCategory = VALID_EXPENSE_CATEGORIES.includes(params.category)
    ? params.category
    : "pool_tickets";

  const rawTotal = Number(params.totalAmount);
  if (!Number.isFinite(rawTotal) || rawTotal <= 0 || rawTotal > 10_000_000) {
    return { ok: false, status: 400, error: "Total amount must be greater than 0." };
  }
  const totalAmount = Number(rawTotal.toFixed(2));
  const currency = sanitizeString(params.currency || "LKR", 8).toUpperCase() || "LKR";
  const notes = sanitizeString(params.notes || "", 300) || null;

  // Deduplicate & resolve valid swimmers
  const swimmersById = new Map(DataStore.getSwimmers({ status: "all" }).map((s) => [s.id, s]));
  const uniqueParticipants: CreateExpenseParticipantInput[] = [];
  const seen = new Set<string>();
  for (const p of params.participants || []) {
    if (!p.swimmer_id || seen.has(p.swimmer_id)) continue;
    if (!swimmersById.has(p.swimmer_id)) continue;
    seen.add(p.swimmer_id);
    uniqueParticipants.push(p);
  }

  if (uniqueParticipants.length === 0) {
    return { ok: false, status: 400, error: "Select at least 1 squad member to split this bill." };
  }

  // Resolve payer identity
  let paidBySwimmerId: string | null = null;
  let paidByName = "Squad Coach";
  if (actor.role === "swimmer") {
    paidBySwimmerId = actor.swimmerId;
    paidByName = actor.name;
  } else if (params.paidBySwimmerId && swimmersById.has(params.paidBySwimmerId)) {
    const payerSw = swimmersById.get(params.paidBySwimmerId)!;
    paidBySwimmerId = payerSw.id;
    paidByName = payerSw.nickname?.trim() || payerSw.full_name;
  } else {
    paidByName = sanitizeString(params.paidByName || "Squad Coach", 100) || "Squad Coach";
  }

  // Compute shares: custom if every participant supplied a valid custom_amount, else even split
  const hasCustom = uniqueParticipants.every(
    (p) => typeof p.custom_amount === "number" && Number.isFinite(p.custom_amount) && p.custom_amount >= 0
  );
  const evenShares = computeEvenShares(totalAmount, uniqueParticipants.length);

  const nowIso = new Date().toISOString();
  const expenseId = crypto.randomUUID();

  const shares: SquadExpenseShare[] = uniqueParticipants.map((p, idx) => {
    const sw = swimmersById.get(p.swimmer_id)!;
    const isPayer = Boolean(paidBySwimmerId && paidBySwimmerId === sw.id);
    const amount = hasCustom
      ? Number(Number(p.custom_amount).toFixed(2))
      : evenShares[idx];
    return {
      id: crypto.randomUUID(),
      expense_id: expenseId,
      swimmer_id: sw.id,
      swimmer_name: sw.nickname?.trim() || sw.full_name,
      share_amount: amount,
      is_paid: isPayer,
      paid_at: isPayer ? nowIso : null,
      marked_by: isPayer ? "Paid upfront" : null,
    };
  });

  const computedTotal = hasCustom
    ? Number(shares.reduce((sum, s) => sum + s.share_amount, 0).toFixed(2))
    : totalAmount;

  if (computedTotal <= 0) {
    return { ok: false, status: 400, error: "Split amounts must sum to more than 0." };
  }

  const matchedSession =
    (params.sessionId ? DataStore.getSessionById(params.sessionId) : null) ||
    DataStore.getSessions({ status: "all" }).find((s) => s.date === expenseDate) ||
    null;

  const resolvedSessionId =
    matchedSession && isUuid(matchedSession.id) ? matchedSession.id : null;

  const newExpense: SquadExpense = {
    id: expenseId,
    expense_date: expenseDate,
    session_id: resolvedSessionId,
    title: cleanTitle,
    category,
    currency,
    total_amount: computedTotal,
    paid_by_name: paidByName,
    paid_by_swimmer_id: paidBySwimmerId,
    notes,
    created_at: nowIso,
    updated_at: nowIso,
    shares,
    session_title: matchedSession?.title || null,
  };

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const saved = DataStore.upsertExpense(newExpense);
    return { ok: true, expense: saved };
  }

  const { error: expErr } = await supabase.from("squad_expenses").insert({
    id: expenseId,
    expense_date: expenseDate,
    session_id: resolvedSessionId,
    title: cleanTitle,
    category,
    currency,
    total_amount: computedTotal,
    paid_by_name: paidByName,
    paid_by_swimmer_id: isUuid(paidBySwimmerId) ? paidBySwimmerId : null,
    notes,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (expErr) {
    const missing =
      expErr.code === "42P01" ||
      expErr.message?.toLowerCase().includes("squad_expenses");
    if (missing) {
      return {
        ok: false,
        status: 503,
        error:
          "Squad Splits table is not installed yet. Run supabase/migrations/20260106000000_tier1_social_and_splits.sql in your Supabase SQL Editor first.",
      };
    }
    console.error("[ExpensesService] Insert expense failed:", expErr);
    return { ok: false, status: 500, error: "Could not save bill split. Please try again." };
  }

  const shareRows = shares
    .filter((s) => isUuid(s.swimmer_id))
    .map((s) => ({
      id: s.id,
      expense_id: expenseId,
      swimmer_id: s.swimmer_id,
      swimmer_name: s.swimmer_name,
      share_amount: s.share_amount,
      is_paid: s.is_paid,
      paid_at: s.paid_at,
      marked_by: s.marked_by,
    }));

  if (shareRows.length > 0) {
    const { error: sharesErr } = await supabase
      .from("squad_expense_shares")
      .insert(shareRows);
    if (sharesErr) {
      await supabase.from("squad_expenses").delete().eq("id", expenseId);
      console.error("[ExpensesService] Insert shares failed:", sharesErr);
      return { ok: false, status: 500, error: "Could not save split shares. Please try again." };
    }
  }

  const saved = DataStore.upsertExpense(newExpense);
  return { ok: true, expense: saved };
}

/**
 * Toggles Paid / Pending status on a single swimmer's share.
 * Authorized for Coach/Admin OR the swimmer who paid the bill upfront.
 */
export async function toggleExpenseSharePaid(params: {
  actor: MemoryActor;
  expenseId: string;
  swimmerId: string;
  isPaid: boolean;
}): Promise<
  | { ok: true; expense: SquadExpense }
  | { ok: false; status: number; error: string }
> {
  const { actor, expenseId, swimmerId, isPaid } = params;
  await getExpensesFresh();

  const existing = DataStore.getExpenseById(expenseId);
  if (!existing) {
    return { ok: false, status: 404, error: "Bill split not found." };
  }

  const canManage =
    actor.role === "admin" ||
    (actor.role === "swimmer" &&
      existing.paid_by_swimmer_id &&
      existing.paid_by_swimmer_id === actor.swimmerId);

  if (!canManage) {
    return {
      ok: false,
      status: 403,
      error: `Only ${existing.paid_by_name} or the coach can mark shares as paid.`,
    };
  }

  const targetShare = existing.shares.find((s) => s.swimmer_id === swimmerId);
  if (!targetShare) {
    return { ok: false, status: 404, error: "Swimmer share not found in this split." };
  }

  const nowIso = new Date().toISOString();
  const updatedShares = existing.shares.map((s) =>
    s.swimmer_id === swimmerId
      ? {
          ...s,
          is_paid: isPaid,
          paid_at: isPaid ? nowIso : null,
          marked_by: isPaid ? actor.name : null,
        }
      : s
  );

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from("squad_expense_shares")
      .update({
        is_paid: isPaid,
        paid_at: isPaid ? nowIso : null,
        marked_by: isPaid ? actor.name : null,
      })
      .eq("expense_id", expenseId)
      .eq("swimmer_id", swimmerId);

    if (error) {
      console.error("[ExpensesService] Toggle share failed:", error);
      return { ok: false, status: 500, error: "Could not update payment status." };
    }
  }

  const updated = DataStore.upsertExpense({
    ...existing,
    shares: updatedShares,
    updated_at: nowIso,
  });
  return { ok: true, expense: updated };
}

/**
 * Deletes an expense split (Coach/Admin or original payer).
 */
export async function deleteSquadExpense(params: {
  actor: MemoryActor;
  expenseId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { actor, expenseId } = params;
  await getExpensesFresh();
  const existing = DataStore.getExpenseById(expenseId);
  if (!existing) {
    return { ok: false, status: 404, error: "Bill split not found." };
  }

  const canDelete =
    actor.role === "admin" ||
    (actor.role === "swimmer" &&
      existing.paid_by_swimmer_id &&
      existing.paid_by_swimmer_id === actor.swimmerId);

  if (!canDelete) {
    return {
      ok: false,
      status: 403,
      error: "Only the coach or bill payer can delete this split.",
    };
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("squad_expenses").delete().eq("id", expenseId);
    if (error) {
      console.error("[ExpensesService] Delete expense failed:", error);
      return { ok: false, status: 500, error: "Could not delete bill split." };
    }
  }

  DataStore.deleteExpense(expenseId);
  return { ok: true };
}
