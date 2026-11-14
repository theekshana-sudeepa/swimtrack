import { DataStore } from "./data-store";
import { SupabaseDB } from "./supabase-db";

/**
 * Returns the swimmer's unguessable pass token, minting + persisting a new one if the current
 * token is missing or weak (e.g. legacy `token_<swimmer-id>`). Returns null if it could not be
 * made durable, so callers never hand out a token the database does not know about.
 */
export async function ensureStrongSwimmerToken(swimmerId: string): Promise<string | null> {
  const result = DataStore.ensureSwimmerToken(swimmerId);
  if (!result) return null;
  if (!result.changed) return result.token;

  const swimmer = DataStore.getSwimmerById(swimmerId);
  const persisted = await SupabaseDB.persistSwimmerToken(
    swimmerId,
    result.prefId,
    result.token,
    swimmer?.reminder_preferences?.email_reminders_enabled ?? false
  );
  return persisted ? result.token : null;
}
