import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type SquadReaction,
} from "@/types/database";
import type { MemoryActor } from "./memories-service";

export function isValidReactionEmoji(val: string): val is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(val);
}

export function actorToReactorKey(actor: MemoryActor): string {
  return actor.role === "admin" ? "admin" : `swimmer:${actor.swimmerId}`;
}

function isUuid(val?: string | null): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Toggles an emoji reaction on a Squad Memory or Chalkboard Message.
 * Persists to `public.squad_reactions` in Supabase and mirrors in `DataStore`.
 */
export async function toggleSquadReaction(params: {
  actor: MemoryActor;
  targetType: "memory" | "message";
  targetId: string;
  emoji: ReactionEmoji;
}): Promise<{
  ok: true;
  added: boolean;
  reactions: SquadReaction[];
}> {
  const { actor, targetType, targetId, emoji } = params;
  const reactorKey = actorToReactorKey(actor);
  const reactorName = actor.name;

  const supabase = getSupabaseAdminClient();

  if (!supabase || !isUuid(targetId)) {
    const local = DataStore.toggleReactionLocal({
      target_type: targetType,
      target_id: targetId,
      emoji,
      reactor_key: reactorKey,
      reactor_name: reactorName,
    });
    return { ok: true, added: local.added, reactions: local.reactions };
  }

  try {
    // Check if reaction already exists
    const { data: existing, error: fetchErr } = await supabase
      .from("squad_reactions")
      .select("id")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("emoji", emoji)
      .eq("reactor_key", reactorKey)
      .maybeSingle();

    if (fetchErr) {
      // Fallback gracefully to local store if Tier 1 migration hasn't been run yet
      const local = DataStore.toggleReactionLocal({
        target_type: targetType,
        target_id: targetId,
        emoji,
        reactor_key: reactorKey,
        reactor_name: reactorName,
      });
      return { ok: true, added: local.added, reactions: local.reactions };
    }

    let added = false;
    if (existing?.id) {
      await supabase.from("squad_reactions").delete().eq("id", existing.id);
      added = false;
    } else {
      await supabase.from("squad_reactions").insert({
        target_type: targetType,
        target_id: targetId,
        emoji,
        reactor_key: reactorKey,
        reactor_name: reactorName,
      });
      added = true;
    }

    // Re-read authoritative reaction list for this target
    const { data: allRows } = await supabase
      .from("squad_reactions")
      .select("*")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true });

    const mapped: SquadReaction[] = (allRows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      target_type: row.target_type === "message" ? "message" : "memory",
      target_id: row.target_id as string,
      emoji: row.emoji as ReactionEmoji,
      reactor_key: row.reactor_key as string,
      reactor_name: (row.reactor_name as string) || "Swimmer",
      created_at: (row.created_at as string) || new Date().toISOString(),
    }));

    // Sync local store cache
    DataStore.toggleReactionLocal({
      target_type: targetType,
      target_id: targetId,
      emoji,
      reactor_key: reactorKey,
      reactor_name: reactorName,
    });

    return { ok: true, added, reactions: mapped };
  } catch {
    const local = DataStore.toggleReactionLocal({
      target_type: targetType,
      target_id: targetId,
      emoji,
      reactor_key: reactorKey,
      reactor_name: reactorName,
    });
    return { ok: true, added: local.added, reactions: local.reactions };
  }
}
