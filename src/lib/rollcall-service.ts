import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import { sanitizeString } from "./security";
import type { MemoryActor } from "./memories-service";
import type { RollCallStatus, SessionRollCall } from "@/types/database";

export const VALID_ROLL_CALL_STATUSES: RollCallStatus[] = [
  "awake",
  "on_my_way",
  "need_ride",
  "offering_ride",
  "running_late",
];

function isUuid(val?: string | null): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Sets or updates a swimmer's pre-swim live roll-call status ("Awake", "On My Way", "Need a Ride", etc.).
 */
export async function upsertSessionRollCall(params: {
  actor: MemoryActor;
  sessionId: string;
  status: RollCallStatus;
  note?: string | null;
}): Promise<
  | { ok: true; rollCalls: SessionRollCall[] }
  | { ok: false; status: number; error: string }
> {
  const { actor, sessionId, status } = params;
  if (actor.role !== "swimmer") {
    return { ok: false, status: 400, error: "Roll-call pings are for squad swimmers." };
  }

  if (!VALID_ROLL_CALL_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: "Invalid roll-call status." };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Practice session not found." };
  }

  const cleanNote = sanitizeString(params.note || "", 140) || null;
  const nowIso = new Date().toISOString();

  const entry: SessionRollCall = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    swimmer_id: actor.swimmerId,
    swimmer_name: actor.name,
    status,
    note: cleanNote,
    updated_at: nowIso,
  };

  DataStore.upsertRollCall(entry);

  const supabase = getSupabaseAdminClient();
  if (supabase && isUuid(sessionId) && isUuid(actor.swimmerId)) {
    try {
      const { error } = await supabase.from("session_roll_calls").upsert(
        {
          session_id: sessionId,
          swimmer_id: actor.swimmerId,
          swimmer_name: actor.name,
          status,
          note: cleanNote,
          updated_at: nowIso,
        },
        { onConflict: "session_id,swimmer_id" }
      );
      if (error) {
        const missing =
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("session_roll_calls");
        if (!missing) {
          console.warn("[RollCallService] Supabase upsert warning:", error);
        }
      }
    } catch {
      // Non-fatal fallback to in-memory store if migration not run yet
    }
  }

  return { ok: true, rollCalls: DataStore.getRollCallsForSession(sessionId) };
}

/**
 * Clears a swimmer's pre-swim roll-call ping for a session.
 */
export async function clearSessionRollCall(params: {
  actor: MemoryActor;
  sessionId: string;
}): Promise<{ ok: true; rollCalls: SessionRollCall[] }> {
  const { actor, sessionId } = params;
  if (actor.role === "swimmer") {
    DataStore.deleteRollCall(sessionId, actor.swimmerId);
    const supabase = getSupabaseAdminClient();
    if (supabase && isUuid(sessionId) && isUuid(actor.swimmerId)) {
      try {
        await supabase
          .from("session_roll_calls")
          .delete()
          .eq("session_id", sessionId)
          .eq("swimmer_id", actor.swimmerId);
      } catch {
        // Non-fatal
      }
    }
  }
  return { ok: true, rollCalls: DataStore.getRollCallsForSession(sessionId) };
}
