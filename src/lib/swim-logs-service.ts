import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import { sanitizeString } from "./security";
import { isValidMemoryDate, type MemoryActor } from "./memories-service";
import type { SwimFeeling, SwimLog, SwimStroke } from "@/types/database";

const VALID_STROKES: SwimStroke[] = [
  "freestyle",
  "breaststroke",
  "backstroke",
  "butterfly",
  "mixed",
];
const VALID_FEELINGS: SwimFeeling[] = ["beast", "strong", "steady", "tired"];

function isUuid(val?: string | null): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

export { computeSwimmerPRs, type SwimmerPRSummary } from "./squad-wrapped";

/**
 * Creates a personal swim distance & PR log entry for a swimmer.
 */
export async function createSwimLog(params: {
  actor: MemoryActor;
  logDate: string;
  distanceMeters?: number | null;
  laps?: number | null;
  poolLengthMeters?: 25 | 50;
  stroke?: SwimStroke;
  durationMinutes?: number | null;
  best50mSeconds?: number | null;
  best100mSeconds?: number | null;
  feeling?: SwimFeeling;
  notes?: string | null;
  sessionId?: string | null;
}): Promise<
  | { ok: true; log: SwimLog }
  | { ok: false; status: number; error: string }
> {
  const { actor, logDate } = params;
  if (actor.role !== "swimmer") {
    return { ok: false, status: 400, error: "Sign in to a Swimmer Pass to log a swim." };
  }

  if (!isValidMemoryDate(logDate)) {
    return { ok: false, status: 400, error: "Please choose a valid swim date." };
  }

  const poolLength: 25 | 50 = params.poolLengthMeters === 50 ? 50 : 25;
  const laps =
    params.laps != null && Number.isFinite(Number(params.laps)) && Number(params.laps) > 0
      ? Math.round(Number(params.laps))
      : null;

  let distanceMeters =
    params.distanceMeters != null && Number.isFinite(Number(params.distanceMeters))
      ? Math.round(Number(params.distanceMeters))
      : 0;

  if (distanceMeters <= 0 && laps != null) {
    distanceMeters = laps * poolLength;
  }

  if (distanceMeters < 25 || distanceMeters > 50_000) {
    return {
      ok: false,
      status: 400,
      error: "Distance must be between 25m and 50,000m (enter laps or meters).",
    };
  }

  const stroke: SwimStroke = VALID_STROKES.includes(params.stroke as SwimStroke)
    ? (params.stroke as SwimStroke)
    : "freestyle";
  const feeling: SwimFeeling = VALID_FEELINGS.includes(params.feeling as SwimFeeling)
    ? (params.feeling as SwimFeeling)
    : "strong";

  const durationMinutes =
    params.durationMinutes != null &&
    Number.isFinite(Number(params.durationMinutes)) &&
    Number(params.durationMinutes) >= 1 &&
    Number(params.durationMinutes) <= 600
      ? Math.round(Number(params.durationMinutes))
      : null;

  const best50mSeconds =
    params.best50mSeconds != null &&
    Number.isFinite(Number(params.best50mSeconds)) &&
    Number(params.best50mSeconds) >= 15 &&
    Number(params.best50mSeconds) <= 600
      ? Number(Number(params.best50mSeconds).toFixed(2))
      : null;

  const best100mSeconds =
    params.best100mSeconds != null &&
    Number.isFinite(Number(params.best100mSeconds)) &&
    Number(params.best100mSeconds) >= 35 &&
    Number(params.best100mSeconds) <= 1200
      ? Number(Number(params.best100mSeconds).toFixed(2))
      : null;

  const cleanNotes = sanitizeString(params.notes || "", 240) || null;
  const matchedSession =
    (params.sessionId ? DataStore.getSessionById(params.sessionId) : null) ||
    DataStore.getSessions({ status: "all" }).find((s) => s.date === logDate) ||
    null;

  const newLog: SwimLog = {
    id: crypto.randomUUID(),
    swimmer_id: actor.swimmerId,
    swimmer_name: actor.name,
    session_id: matchedSession && isUuid(matchedSession.id) ? matchedSession.id : null,
    log_date: logDate,
    distance_meters: distanceMeters,
    laps: laps ?? Math.round(distanceMeters / poolLength),
    pool_length_meters: poolLength,
    stroke,
    duration_minutes: durationMinutes,
    best_50m_seconds: best50mSeconds,
    best_100m_seconds: best100mSeconds,
    feeling,
    notes: cleanNotes,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdminClient();
  if (supabase && isUuid(actor.swimmerId)) {
    const { error } = await supabase.from("swim_logs").insert({
      id: newLog.id,
      swimmer_id: newLog.swimmer_id,
      swimmer_name: newLog.swimmer_name,
      session_id: newLog.session_id,
      log_date: newLog.log_date,
      distance_meters: newLog.distance_meters,
      laps: newLog.laps,
      pool_length_meters: newLog.pool_length_meters,
      stroke: newLog.stroke,
      duration_minutes: newLog.duration_minutes,
      best_50m_seconds: newLog.best_50m_seconds,
      best_100m_seconds: newLog.best_100m_seconds,
      feeling: newLog.feeling,
      notes: newLog.notes,
      created_at: newLog.created_at,
    });

    if (error) {
      const missing =
        error.code === "42P01" || error.message?.toLowerCase().includes("swim_logs");
      if (missing) {
        return {
          ok: false,
          status: 503,
          error:
            "Swim Logs table is not installed yet. Run supabase/migrations/20260107000000_tier2_rollcall_and_swim_logs.sql in your Supabase SQL Editor first.",
        };
      }
      console.error("[SwimLogsService] Insert failed:", error);
      return { ok: false, status: 500, error: "Could not save your swim log." };
    }
  }

  DataStore.upsertSwimLog(newLog);
  return { ok: true, log: newLog };
}

/**
 * Deletes a personal swim log (owner swimmer or Coach/Admin only).
 */
export async function deleteSwimLog(params: {
  actor: MemoryActor;
  logId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { actor, logId } = params;
  const existing = DataStore.getSwimLogById(logId);
  if (!existing) {
    return { ok: false, status: 404, error: "Swim log not found." };
  }

  const canDelete =
    actor.role === "admin" ||
    (actor.role === "swimmer" && existing.swimmer_id === actor.swimmerId);

  if (!canDelete) {
    return { ok: false, status: 403, error: "You can only delete your own swim logs." };
  }

  const supabase = getSupabaseAdminClient();
  if (supabase && isUuid(logId)) {
    const { error } = await supabase.from("swim_logs").delete().eq("id", logId);
    if (error) {
      console.error("[SwimLogsService] Delete failed:", error);
      return { ok: false, status: 500, error: "Could not delete swim log." };
    }
  }

  DataStore.deleteSwimLog(logId);
  return { ok: true };
}
