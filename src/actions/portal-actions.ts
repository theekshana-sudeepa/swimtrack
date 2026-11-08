"use server";

import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";

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

  const record = DataStore.submitSwimmerRsvp(
    swimmer.id,
    sessionId,
    status,
    reason?.trim() || undefined
  );

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

  const cleanContent = content?.trim();
  if (!cleanContent || cleanContent.length < 2) {
    return { success: false, error: "Message must be at least 2 characters." };
  }

  if (cleanContent.length > 280) {
    return { success: false, error: "Message cannot exceed 280 characters." };
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

  revalidatePath(`/portal/${token}`);

  return { success: true, message: msg };
}
