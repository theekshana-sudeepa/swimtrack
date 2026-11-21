"use client";

import * as React from "react";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type SquadReaction,
} from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReactionBarProps {
  targetType: "memory" | "message";
  targetId: string;
  initialReactions?: SquadReaction[];
  /** "admin" or "swimmer:<id>" */
  currentReactorKey: string;
  currentReactorName: string;
  swimmerToken?: string | null;
  compact?: boolean;
  darkSurface?: boolean;
  onReactionsUpdated?: (reactions: SquadReaction[]) => void;
}

export function ReactionBar({
  targetType,
  targetId,
  initialReactions = [],
  currentReactorKey,
  currentReactorName,
  swimmerToken,
  compact = false,
  darkSurface = false,
  onReactionsUpdated,
}: ReactionBarProps) {
  const [reactions, setReactions] = React.useState<SquadReaction[]>(initialReactions);
  const [busyEmoji, setBusyEmoji] = React.useState<ReactionEmoji | null>(null);

  React.useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  async function handleToggle(emoji: ReactionEmoji) {
    if (busyEmoji) return;
    setBusyEmoji(emoji);

    // Optimistic update
    const prevSnapshot = reactions;
    const alreadyMine = reactions.some(
      (r) => r.emoji === emoji && r.reactor_key === currentReactorKey
    );
    const optimistic = alreadyMine
      ? reactions.filter(
          (r) => !(r.emoji === emoji && r.reactor_key === currentReactorKey)
        )
      : [
          ...reactions,
          {
            id: `opt-${Date.now()}`,
            target_type: targetType,
            target_id: targetId,
            emoji,
            reactor_key: currentReactorKey,
            reactor_name: currentReactorName,
            created_at: new Date().toISOString(),
          },
        ];
    setReactions(optimistic);

    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          emoji,
          swimmer_token: swimmerToken || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        reactions?: SquadReaction[];
        error?: string;
      };
      if (!res.ok || !json.success || !Array.isArray(json.reactions)) {
        setReactions(prevSnapshot);
        toast.error(json.error || "Could not update reaction.");
        return;
      }
      setReactions(json.reactions);
      onReactionsUpdated?.(json.reactions);
    } catch {
      setReactions(prevSnapshot);
      toast.error("Could not update reaction.");
    } finally {
      setBusyEmoji(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const list = reactions.filter((r) => r.emoji === emoji);
        const count = list.length;
        const isMine = list.some((r) => r.reactor_key === currentReactorKey);
        const namesTooltip =
          count > 0
            ? `${emoji} ${list.map((r) => r.reactor_name).join(", ")}`
            : `React with ${emoji}`;

        return (
          <button
            key={emoji}
            type="button"
            disabled={busyEmoji === emoji}
            onClick={() => handleToggle(emoji)}
            title={namesTooltip}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border transition-all active:scale-90 select-none",
              compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              isMine
                ? "bg-aqua/20 border-aqua/50 text-aqua font-extrabold shadow-xs"
                : darkSurface
                ? "bg-white/10 hover:bg-white/20 border-white/15 text-white/85 font-semibold"
                : count > 0
                ? "bg-secondary/70 hover:bg-secondary border-border text-foreground font-bold"
                : "bg-secondary/25 hover:bg-secondary/60 border-border/60 text-muted-foreground opacity-80 hover:opacity-100"
            )}
          >
            <span className="leading-none">{emoji}</span>
            {count > 0 && <span className="font-mono text-[10px] leading-none">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
