"use server";

import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { sanitizeString } from "@/lib/security";
import { chalkboardRateLimiter } from "@/lib/rate-limiter";

/**
 * 1-Tap RSVP submission from the Swimmer Pass portal.
 * Token-authenticated (passwordless).
 */
export async function submitRsvpAction(
  token: string,
  sessionId: string,
  status: "attending" | "declined",
  reason?: string
) {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer) {
    return { success: false, error: "Invalid swimmer pass token." };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Swimming session not found." };
  }

  const cleanReason = reason ? sanitizeString(reason, 200) : undefined;

  const record = DataStore.submitSwimmerRsvp(
    swimmer.id,
    sessionId,
    status,
    cleanReason
  );

  // Persist directly to Supabase
  if (record) {
    await SupabaseDB.upsertAttendance(
      record,
      undefined,
      cleanReason ? `RSVP: ${status} (${cleanReason})` : `RSVP: ${status}`
    );
  }

  revalidatePath(`/portal/${token}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, record };
}

/**
 * Posts a message/banter on the Squad Chalkboard.
 * Token-authenticated (passwordless).
 */
export async function postChalkboardMessageAction(token: string, content: string) {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer) {
    return { success: false, error: "Invalid swimmer pass token." };
  }

  // Rate limiting against spamming the squad chalkboard
  const rateCheck = chalkboardRateLimiter.check(`chalk_${token}`);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Posting too quickly. Please wait ${rateCheck.retryAfterSeconds} seconds before posting again.`,
    };
  }

  const cleanContent = sanitizeString(content, 280);
  if (!cleanContent || cleanContent.length < 2) {
    return { success: false, error: "Message must be at least 2 characters." };
  }

  const authorName = swimmer.nickname
    ? `${swimmer.full_name} ("${swimmer.nickname}")`
    : swimmer.full_name;

  const msg = DataStore.postSquadMessage({
    author_name: authorName,
    content: cleanContent,
    author_swimmer_id: swimmer.id,
    is_admin: false,
  });

  chalkboardRateLimiter.recordFailure(`chalk_${token}`);

  revalidatePath(`/portal/${token}`);

  return { success: true, message: msg };
}

