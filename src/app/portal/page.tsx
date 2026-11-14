import * as React from "react";
import { cookies } from "next/headers";
import { DataStore } from "@/lib/data-store";
import { SWIMMER_COOKIE_NAME } from "@/lib/auth";
import {
  SwimmerPortalLoginClient,
  PortalSquadMember,
  RememberedSwimmer,
} from "@/components/portal/swimmer-portal-login-client";

export const dynamic = "force-dynamic";

export default async function SwimmerPortalEntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ swimmer?: string }>;
}) {
  await DataStore.syncFromSupabase({ maxAgeMs: 10_000 });
  const resolvedParams = searchParams ? await searchParams : undefined;
  const preselectedSwimmerId = resolvedParams?.swimmer || null;

  // Read device persistent cookie
  const cookieStore = await cookies();
  const savedToken = cookieStore.get(SWIMMER_COOKIE_NAME)?.value;

  let rememberedSwimmer: RememberedSwimmer | null = null;
  if (savedToken) {
    const swimmer = DataStore.getSwimmerByToken(savedToken);
    if (swimmer && swimmer.status === "active") {
      rememberedSwimmer = {
        id: swimmer.id,
        full_name: swimmer.full_name,
        nickname: swimmer.nickname || null,
        avatar_color: swimmer.avatar_color || "ocean",
        token: savedToken,
      };
    }
  }

  // Get all active squad members for the pass selector
  const squadMembers: PortalSquadMember[] = DataStore.getSwimmers({
    status: "active",
  }).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    nickname: s.nickname || null,
    avatar_color: s.avatar_color || "ocean",
    hasPin: DataStore.hasSwimmerPin(s.id),
  }));

  return (
    <SwimmerPortalLoginClient
      initialMembers={squadMembers}
      rememberedSwimmer={rememberedSwimmer}
      preselectedSwimmerId={preselectedSwimmerId}
    />
  );
}
