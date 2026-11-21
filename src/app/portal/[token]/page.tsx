import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SWIMMER_COOKIE_NAME } from "@/lib/auth";
import { timingSafeMatch } from "@/lib/security";
import { DataStore } from "@/lib/data-store";
import { getMemoriesWithSignedUrls } from "@/lib/memories-service";
import { getExpensesFresh } from "@/lib/expenses-service";
import { SwimmerPortalClient } from "@/components/portal/swimmer-portal-client";
import { Waves, ArrowLeft, Search } from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export default async function SwimmerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await DataStore.syncFromSupabase({ maxAgeMs: 10_000 });
  const { token } = await params;
  const swimmer = DataStore.getSwimmerByToken(token);

  if (!swimmer) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6">
        <header className="max-w-md mx-auto w-full pt-4">
          <Link href="/">
            <SwimTrackLogo size="md" />
          </Link>
        </header>

        <main className="max-w-md mx-auto w-full p-8 rounded-3xl border border-border bg-card text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
            <Waves className="w-6 h-6 text-aqua" />
          </div>
          <h1 className="text-xl font-black text-foreground">
            Swimmer Pass Not Found
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We couldn&apos;t find an active squad pass matching this link. Please check the link from your welcome email or ask your squad administrator.
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-aqua text-ocean-950 font-bold text-xs shadow-sm hover:bg-aqua-hover transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Home</span>
            </Link>
          </div>
        </main>

        <footer className="text-center text-xs text-muted-foreground pb-4">
          SwimTrack &bull; The Aquatic Control Room
        </footer>
      </div>
    );
  }

  // A pass link alone is not enough: the visitor must have signed in with their PIN on this device.
  // Pre-select their profile on /portal so they only need to type their 4-digit PIN.
  const cookieToken = (await cookies()).get(SWIMMER_COOKIE_NAME)?.value;
  if (!cookieToken || !timingSafeMatch(cookieToken, token.trim())) {
    redirect(`/portal?swimmer=${encodeURIComponent(swimmer.id)}`);
  }

  const nextSession = DataStore.getNextUpcomingSession();
  const history = DataStore.getSwimmerAttendanceHistory(swimmer.id);
  const messages = DataStore.getSquadMessages();
  const squadFriends = DataStore.getSwimmers({ status: "active" });
  const dashboardStats = DataStore.getDashboardStats();
  const savedVenues = DataStore.getSavedVenues();
  const allSessions = DataStore.getSessions({ status: "all" });
  const [{ memories }, { expenses }] = await Promise.all([
    getMemoriesWithSignedUrls(),
    getExpensesFresh(),
  ]);

  const attendeesByDate: Record<string, string[]> = {};
  for (const sess of allSessions) {
    const ids = DataStore.getAttendeesForDate(sess.date, sess.id).map((a) => a.id);
    if (ids.length > 0) attendeesByDate[sess.date] = ids;
  }

  return (
    <SwimmerPortalClient
      swimmer={swimmer}
      token={token}
      nextSession={nextSession}
      savedVenues={savedVenues}
      history={history}
      initialMessages={messages}
      initialMemories={memories}
      initialExpenses={expenses}
      attendeesByDate={attendeesByDate}
      sessions={allSessions}
      squadFriends={squadFriends}
      squadStats={{
        overallRate: dashboardStats.overallAttendanceRate,
        completedSessions: dashboardStats.completedSessions,
        activeSwimmers: dashboardStats.activeSwimmers,
      }}
    />
  );
}

