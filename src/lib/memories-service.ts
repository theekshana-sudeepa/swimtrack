import crypto from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import { getAdminSession, SWIMMER_COOKIE_NAME } from "./auth";
import { sanitizeString, timingSafeMatch } from "./security";
import type { SquadMemory, SquadMemoryPhoto } from "@/types/database";

export const SQUAD_MEMORIES_BUCKET = "squad-memories";
export const MAX_PHOTOS_PER_DAY = 3;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB per compressed photo
export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export type MemoryActor =
  | {
      role: "admin";
      name: string;
      swimmerId: null;
      swimmerToken: null;
    }
  | {
      role: "swimmer";
      name: string;
      swimmerId: string;
      swimmerToken: string;
    };

export type AllowedImageMime = "image/webp" | "image/jpeg" | "image/png";

/**
 * Validates YYYY-MM-DD format and checks that it represents a real calendar date.
 */
export function isValidMemoryDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (y < 2020 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return false;
  }
  // Allow up to 2 days ahead of UTC to accommodate Asia/Colombo & timezone offsets without allowing far-future spam
  const maxFutureMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
  return dt.getTime() <= maxFutureMs;
}

/**
 * Verifies real image magic bytes (JPEG, PNG, WebP) so spoofed MIME types or SVGs are rejected.
 */
export function detectImageMimeFromBytes(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function mimeToExtension(mime: AllowedImageMime): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpg";
}

function isUuid(val?: string | null): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Resolves either an authenticated Coach/Admin or a PIN-authenticated Swimmer from cookies.
 * Returns null if unauthenticated.
 */
export async function resolveMemoryActor(
  swimmerTokenHint?: string | null
): Promise<MemoryActor | null> {
  // 1. Check Admin session first
  const admin = await getAdminSession();
  if (admin) {
    return {
      role: "admin",
      name: "Squad Coach",
      swimmerId: null,
      swimmerToken: null,
    };
  }

  // 2. Check PIN-authenticated Swimmer cookie
  let cookieToken: string | undefined;
  try {
    cookieToken = (await cookies()).get(SWIMMER_COOKIE_NAME)?.value;
  } catch {
    cookieToken = undefined;
  }
  if (!cookieToken) return null;

  if (swimmerTokenHint && !timingSafeMatch(cookieToken, swimmerTokenHint.trim())) {
    return null;
  }

  const swimmer = DataStore.getSwimmerByToken(cookieToken);
  if (!swimmer || swimmer.status !== "active") {
    return null;
  }

  const displayName = swimmer.nickname?.trim() || swimmer.full_name;
  return {
    role: "swimmer",
    name: displayName,
    swimmerId: swimmer.id,
    swimmerToken: cookieToken,
  };
}

/**
 * Ensures the private Supabase Storage bucket exists (auto-creates on first upload if missing).
 */
async function ensurePrivateMemoriesBucket(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    const { data: existing } = await supabase.storage.getBucket(SQUAD_MEMORIES_BUCKET);
    if (!existing) {
      await supabase.storage.createBucket(SQUAD_MEMORIES_BUCKET, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
      });
    }
  } catch {
    // Best-effort auto-bootstrap; SQL migration also creates the bucket
  }
}

/**
 * Attaches ephemeral 1-hour Signed URLs to all photos across a list of memories in ONE batch call.
 * Keeps the storage bucket strictly private while loading images fast in the browser.
 */
export async function attachSignedUrls(memories: SquadMemory[]): Promise<SquadMemory[]> {
  if (memories.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    // Local / demo in-memory mode: signed_url is already stored as a data URL
    return memories;
  }

  const pathsToSign: string[] = [];
  for (const m of memories) {
    for (const p of m.photos) {
      if (p.storage_path && !p.storage_path.startsWith("memory://")) {
        pathsToSign.push(p.storage_path);
      }
    }
  }

  if (pathsToSign.length === 0) return memories;

  try {
    const { data, error } = await supabase.storage
      .from(SQUAD_MEMORIES_BUCKET)
      .createSignedUrls(pathsToSign, SIGNED_URL_TTL_SECONDS);

    if (error || !Array.isArray(data)) {
      console.warn("[MemoriesService] Could not mint signed URLs:", error);
      return memories;
    }

    const signedByPath = new Map<string, string>();
    for (const entry of data) {
      if (entry.path && entry.signedUrl) {
        signedByPath.set(entry.path, entry.signedUrl);
      }
    }

    return memories.map((m) => ({
      ...m,
      photos: m.photos.map((p) => ({
        ...p,
        signed_url: signedByPath.get(p.storage_path) ?? p.signed_url ?? null,
      })),
    }));
  } catch (err) {
    console.warn("[MemoriesService] Signed URL error:", err);
    return memories;
  }
}

/**
 * Reads fresh squad memories from Supabase (or DataStore fallback) and attaches signed URLs.
 */
export async function getMemoriesWithSignedUrls(): Promise<{
  memories: SquadMemory[];
  migrationNeeded: boolean;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      memories: DataStore.getMemories(),
      migrationNeeded: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from("squad_memories")
      .select("*, squad_memory_photos(*)")
      .order("memory_date", { ascending: false });

    if (error) {
      // Postgres 42P01 = relation does not exist (migration not run yet)
      const isMissingTable =
        error.code === "42P01" ||
        error.message?.toLowerCase().includes("squad_memories") ||
        error.message?.toLowerCase().includes("does not exist");
      if (isMissingTable) {
        return { memories: [], migrationNeeded: true };
      }
      console.warn("[MemoriesService] Failed to query squad_memories:", error);
      return { memories: await attachSignedUrls(DataStore.getMemories()), migrationNeeded: false };
    }

    const mapped: SquadMemory[] = (data || []).map((row: Record<string, unknown>) => {
      const rawPhotos = Array.isArray(row.squad_memory_photos)
        ? (row.squad_memory_photos as Record<string, unknown>[])
        : [];
      const photos: SquadMemoryPhoto[] = rawPhotos
        .map((p) => ({
          id: p.id as string,
          memory_id: p.memory_id as string,
          slot: Math.min(3, Math.max(1, Number(p.slot) || 1)) as 1 | 2 | 3,
          storage_path: p.storage_path as string,
          mime_type: (p.mime_type as AllowedImageMime) || "image/webp",
          size_bytes: Number(p.size_bytes) || 0,
          width: p.width != null ? Number(p.width) : null,
          height: p.height != null ? Number(p.height) : null,
          caption: (p.caption as string) || null,
          uploaded_by_name: (p.uploaded_by_name as string) || "Squad Coach",
          uploaded_by_swimmer_id: (p.uploaded_by_swimmer_id as string) || null,
          uploaded_by_role:
            p.uploaded_by_role === "swimmer" ? ("swimmer" as const) : ("admin" as const),
          created_at: (p.created_at as string) || new Date().toISOString(),
        }))
        .sort((a, b) => a.slot - b.slot);

      return {
        id: row.id as string,
        memory_date: row.memory_date as string,
        session_id: (row.session_id as string) || null,
        title: (row.title as string) || "End-of-Day Squad Memory",
        caption: (row.caption as string) || null,
        location: (row.location as string) || null,
        created_by_name: (row.created_by_name as string) || "Squad Coach",
        created_by_swimmer_id: (row.created_by_swimmer_id as string) || null,
        created_at: (row.created_at as string) || new Date().toISOString(),
        updated_at: (row.updated_at as string) || undefined,
        photos,
      };
    });

    DataStore.hydrateMemories(mapped);
    const hydrated = DataStore.getMemories();
    const withUrls = await attachSignedUrls(hydrated);
    return { memories: withUrls, migrationNeeded: false };
  } catch (err) {
    console.warn("[MemoriesService] Unexpected fetch error:", err);
    return { memories: await attachSignedUrls(DataStore.getMemories()), migrationNeeded: false };
  }
}

export interface UploadMemoryPhotoInput {
  buffer: Buffer;
  mimeType: AllowedImageMime;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

/**
 * Adds 1–3 photos to a specific date's Squad Memory, enforcing the strict 3-photo daily limit.
 */
export async function addPhotosToMemoryDate(params: {
  actor: MemoryActor;
  memoryDate: string;
  title?: string | null;
  caption?: string | null;
  location?: string | null;
  sessionId?: string | null;
  files: UploadMemoryPhotoInput[];
}): Promise<
  | { ok: true; memory: SquadMemory }
  | { ok: false; status: number; error: string }
> {
  const { actor, memoryDate, files } = params;

  if (!isValidMemoryDate(memoryDate)) {
    return { ok: false, status: 400, error: "Please provide a valid memory date (YYYY-MM-DD)." };
  }

  if (!files || files.length === 0) {
    return { ok: false, status: 400, error: "Please attach at least 1 photo." };
  }

  if (files.length > MAX_PHOTOS_PER_DAY) {
    return {
      ok: false,
      status: 400,
      error: `You can upload at most ${MAX_PHOTOS_PER_DAY} photos per day.`,
    };
  }

  // Sync latest memories first so slot counts are accurate
  const latest = await getMemoriesWithSignedUrls();
  if (latest.migrationNeeded) {
    return {
      ok: false,
      status: 503,
      error:
        "Squad Memories database table is not installed yet. Run supabase/migrations/20260105000000_squad_memories.sql in your Supabase SQL Editor first.",
    };
  }

  const existing = DataStore.getMemoryByDate(memoryDate);
  const usedSlots = new Set((existing?.photos || []).map((p) => p.slot));
  const availableSlots = ([1, 2, 3] as const).filter((s) => !usedSlots.has(s));

  if (availableSlots.length === 0) {
    return {
      ok: false,
      status: 409,
      error: `This date (${memoryDate}) already has all ${MAX_PHOTOS_PER_DAY} memories. Remove a photo first to upload a new one.`,
    };
  }

  if (files.length > availableSlots.length) {
    return {
      ok: false,
      status: 409,
      error: `Only ${availableSlots.length} photo slot${availableSlots.length === 1 ? "" : "s"} left for ${memoryDate} (max ${MAX_PHOTOS_PER_DAY} per day).`,
    };
  }

  // Match swim session on that date if none explicitly passed
  const matchingSession =
    (params.sessionId ? DataStore.getSessionById(params.sessionId) : null) ||
    DataStore.getSessions({ status: "all" }).find((s) => s.date === memoryDate) ||
    null;

  const cleanTitle =
    sanitizeString(params.title || "", 120) ||
    existing?.title ||
    (matchingSession ? `${matchingSession.title} Memories` : "End-of-Day Squad Memory");
  const cleanCaption =
    params.caption !== undefined
      ? sanitizeString(params.caption || "", 500) || null
      : existing?.caption ?? null;
  const cleanLocation =
    params.location !== undefined
      ? sanitizeString(params.location || "", 140) || null
      : existing?.location ?? matchingSession?.location ?? null;

  const nowIso = new Date().toISOString();
  const memoryId = existing?.id || crypto.randomUUID();
  const resolvedSessionId =
    (isUuid(params.sessionId) ? params.sessionId : null) ??
    existing?.session_id ??
    (matchingSession && isUuid(matchingSession.id) ? matchingSession.id : null);

  const supabase = getSupabaseAdminClient();

  // ---- DEMO / IN-MEMORY MODE (No Supabase configured) ----
  if (!supabase) {
    const newPhotos: SquadMemoryPhoto[] = files.map((f, idx) => {
      const slot = availableSlots[idx];
      const photoId = crypto.randomUUID();
      const base64 = f.buffer.toString("base64");
      return {
        id: photoId,
        memory_id: memoryId,
        slot,
        storage_path: `memory://${memoryDate}/${photoId}.${mimeToExtension(f.mimeType)}`,
        mime_type: f.mimeType,
        size_bytes: f.buffer.length,
        width: f.width ?? null,
        height: f.height ?? null,
        caption: sanitizeString(f.caption || "", 200) || null,
        uploaded_by_name: actor.name,
        uploaded_by_swimmer_id: actor.swimmerId,
        uploaded_by_role: actor.role,
        created_at: nowIso,
        signed_url: `data:${f.mimeType};base64,${base64}`,
      };
    });

    const merged: SquadMemory = {
      id: memoryId,
      memory_date: memoryDate,
      session_id: resolvedSessionId,
      title: cleanTitle,
      caption: cleanCaption,
      location: cleanLocation,
      created_by_name: existing?.created_by_name || actor.name,
      created_by_swimmer_id: existing?.created_by_swimmer_id ?? actor.swimmerId,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
      photos: [...(existing?.photos || []), ...newPhotos].sort((a, b) => a.slot - b.slot),
      session_title: matchingSession?.title ?? existing?.session_title ?? null,
      session_location: matchingSession?.location ?? existing?.session_location ?? null,
    };

    DataStore.upsertMemory(merged);
    return { ok: true, memory: merged };
  }

  // ---- LIVE SUPABASE POSTGRES + PRIVATE STORAGE ----
  await ensurePrivateMemoriesBucket();

  // 1. Create or update parent squad_memories row
  let persistedMemoryId = memoryId;
  if (!existing) {
    const { data: insertedMem, error: memErr } = await supabase
      .from("squad_memories")
      .insert({
        id: memoryId,
        memory_date: memoryDate,
        session_id: resolvedSessionId,
        title: cleanTitle,
        caption: cleanCaption,
        location: cleanLocation,
        created_by_name: actor.name,
        created_by_swimmer_id: isUuid(actor.swimmerId) ? actor.swimmerId : null,
      })
      .select("id")
      .single();

    if (memErr || !insertedMem) {
      // Handle race condition if another swimmer created the date row concurrently
      if (memErr?.code === "23505") {
        const { data: raceRow } = await supabase
          .from("squad_memories")
          .select("id")
          .eq("memory_date", memoryDate)
          .single();
        if (!raceRow) {
          return { ok: false, status: 500, error: "Could not save memory date. Please try again." };
        }
        persistedMemoryId = raceRow.id as string;
      } else {
        console.error("[MemoriesService] Insert squad_memories failed:", memErr);
        return { ok: false, status: 500, error: "Could not save memory date. Please try again." };
      }
    } else {
      persistedMemoryId = insertedMem.id as string;
    }
  } else {
    // Allow updating title/caption/location if supplied on existing date (admin or creator)
    const canUpdateMeta =
      actor.role === "admin" ||
      (actor.swimmerId && existing.created_by_swimmer_id === actor.swimmerId);
    if (canUpdateMeta && (params.title || params.caption !== undefined || params.location !== undefined)) {
      await supabase
        .from("squad_memories")
        .update({
          title: cleanTitle,
          caption: cleanCaption,
          location: cleanLocation,
          session_id: resolvedSessionId,
          updated_at: nowIso,
        })
        .eq("id", persistedMemoryId);
    }
  }

  // 2. Upload each compressed photo to private Supabase Storage & insert DB row
  const uploadedPaths: string[] = [];
  const insertedPhotos: SquadMemoryPhoto[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const slot = availableSlots[i];
      const photoId = crypto.randomUUID();
      const ext = mimeToExtension(f.mimeType);
      const storagePath = `memories/${memoryDate}/${persistedMemoryId}/${photoId}.${ext}`;

      let uploadRes = await supabase.storage
        .from(SQUAD_MEMORIES_BUCKET)
        .upload(storagePath, f.buffer, {
          contentType: f.mimeType,
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadRes.error && uploadRes.error.message?.toLowerCase().includes("bucket")) {
        await ensurePrivateMemoriesBucket();
        uploadRes = await supabase.storage
          .from(SQUAD_MEMORIES_BUCKET)
          .upload(storagePath, f.buffer, {
            contentType: f.mimeType,
            cacheControl: "31536000",
            upsert: false,
          });
      }

      if (uploadRes.error) {
        throw new Error(uploadRes.error.message || "Storage upload failed");
      }
      uploadedPaths.push(storagePath);

      const photoRow = {
        id: photoId,
        memory_id: persistedMemoryId,
        slot,
        storage_path: storagePath,
        mime_type: f.mimeType,
        size_bytes: f.buffer.length,
        width: f.width ?? null,
        height: f.height ?? null,
        caption: sanitizeString(f.caption || "", 200) || null,
        uploaded_by_name: actor.name,
        uploaded_by_swimmer_id: isUuid(actor.swimmerId) ? actor.swimmerId : null,
        uploaded_by_role: actor.role,
      };

      const { error: photoErr } = await supabase
        .from("squad_memory_photos")
        .insert(photoRow);

      if (photoErr) {
        throw new Error(photoErr.message || "Database insert for photo failed");
      }

      insertedPhotos.push({
        ...photoRow,
        created_at: nowIso,
      });
    }
  } catch (err) {
    // Rollback uploaded storage objects if anything fails mid-batch
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(SQUAD_MEMORIES_BUCKET).remove(uploadedPaths).catch(() => {});
    }
    if (!existing && insertedPhotos.length === 0) {
      await supabase.from("squad_memories").delete().eq("id", persistedMemoryId);
    }
    console.error("[MemoriesService] Photo upload batch failed:", err);
    return {
      ok: false,
      status: 500,
      error: "Failed to upload photo to private storage. Please try again.",
    };
  }

  // Re-fetch & attach fresh signed URLs
  const refreshed = await getMemoriesWithSignedUrls();
  const updatedMemory = refreshed.memories.find((m) => m.id === persistedMemoryId);
  if (!updatedMemory) {
    return { ok: false, status: 500, error: "Photo uploaded, please refresh to view." };
  }
  return { ok: true, memory: updatedMemory };
}

/**
 * Updates a memory day's metadata (title, caption, location, memory_date) or sets Slot #1 cover photo.
 */
export async function updateMemoryDetails(params: {
  actor: MemoryActor;
  memoryId: string;
  title?: string;
  caption?: string | null;
  location?: string | null;
  memoryDate?: string;
  coverPhotoId?: string;
}): Promise<
  | { ok: true; memory: SquadMemory }
  | { ok: false; status: number; error: string }
> {
  const { actor, memoryId } = params;
  await getMemoriesWithSignedUrls();
  const existing = DataStore.getMemoryById(memoryId);
  if (!existing) {
    return { ok: false, status: 404, error: "Squad memory not found." };
  }

  const canEditMeta =
    actor.role === "admin" ||
    (actor.swimmerId && existing.created_by_swimmer_id === actor.swimmerId);
  if (!canEditMeta) {
    return { ok: false, status: 403, error: "Only the coach or memory creator can edit details." };
  }

  if (params.memoryDate && !isValidMemoryDate(params.memoryDate)) {
    return { ok: false, status: 400, error: "Invalid date format (YYYY-MM-DD required)." };
  }

  if (params.memoryDate && params.memoryDate !== existing.memory_date) {
    const conflict = DataStore.getMemoryByDate(params.memoryDate);
    if (conflict && conflict.id !== existing.id) {
      return {
        ok: false,
        status: 409,
        error: `Another memory album already exists for ${params.memoryDate}.`,
      };
    }
  }

  const nextTitle =
    params.title !== undefined
      ? sanitizeString(params.title, 120) || existing.title
      : existing.title;
  const nextCaption =
    params.caption !== undefined
      ? sanitizeString(params.caption || "", 500) || null
      : existing.caption ?? null;
  const nextLocation =
    params.location !== undefined
      ? sanitizeString(params.location || "", 140) || null
      : existing.location ?? null;
  const nextDate = params.memoryDate || existing.memory_date;
  const nowIso = new Date().toISOString();

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    let nextPhotos = [...existing.photos];
    if (params.coverPhotoId && actor.role === "admin") {
      const target = nextPhotos.find((p) => p.id === params.coverPhotoId);
      if (target && target.slot !== 1) {
        const others = nextPhotos.filter((p) => p.id !== target.id).sort((a, b) => a.slot - b.slot);
        nextPhotos = [target, ...others].map((p, idx) => ({
          ...p,
          slot: (idx + 1) as 1 | 2 | 3,
        }));
      }
    }
    const updated: SquadMemory = {
      ...existing,
      memory_date: nextDate,
      title: nextTitle,
      caption: nextCaption,
      location: nextLocation,
      updated_at: nowIso,
      photos: nextPhotos,
    };
    DataStore.upsertMemory(updated);
    return { ok: true, memory: updated };
  }

  const { error: updateErr } = await supabase
    .from("squad_memories")
    .update({
      memory_date: nextDate,
      title: nextTitle,
      caption: nextCaption,
      location: nextLocation,
      updated_at: nowIso,
    })
    .eq("id", memoryId);

  if (updateErr) {
    console.error("[MemoriesService] Update memory failed:", updateErr);
    return { ok: false, status: 500, error: "Could not update memory details." };
  }

  // Promote cover photo to slot 1 (swap via temporary negative/unused ordering safely)
  if (params.coverPhotoId && actor.role === "admin") {
    const target = existing.photos.find((p) => p.id === params.coverPhotoId);
    const currentCover = existing.photos.find((p) => p.slot === 1);
    if (target && target.slot !== 1) {
      if (currentCover) {
        // Re-order via delete+reinsert of slots or safe 2-step if slot 3 is free, or temp swap
        // Because CHECK (slot BETWEEN 1 AND 3) prevents temp slot 99, re-write ordered slots cleanly:
        const ordered = [
          target,
          ...existing.photos.filter((p) => p.id !== target.id).sort((a, b) => a.slot - b.slot),
        ];
        // Delete rows and re-insert with same IDs & new slots (keeps storage files untouched!)
        await supabase.from("squad_memory_photos").delete().eq("memory_id", memoryId);
        await supabase.from("squad_memory_photos").insert(
          ordered.map((p, idx) => ({
            id: p.id,
            memory_id: p.memory_id,
            slot: idx + 1,
            storage_path: p.storage_path,
            mime_type: p.mime_type,
            size_bytes: p.size_bytes,
            width: p.width ?? null,
            height: p.height ?? null,
            caption: p.caption ?? null,
            uploaded_by_name: p.uploaded_by_name,
            uploaded_by_swimmer_id: isUuid(p.uploaded_by_swimmer_id) ? p.uploaded_by_swimmer_id : null,
            uploaded_by_role: p.uploaded_by_role,
            created_at: p.created_at,
          }))
        );
      } else {
        await supabase
          .from("squad_memory_photos")
          .update({ slot: 1 })
          .eq("id", target.id);
      }
    }
  }

  const refreshed = await getMemoriesWithSignedUrls();
  const updated = refreshed.memories.find((m) => m.id === memoryId);
  if (!updated) {
    return { ok: false, status: 404, error: "Memory not found after update." };
  }
  return { ok: true, memory: updated };
}

/**
 * Deletes either a single photo (admin = any; swimmer = own uploads only) or an entire memory day (admin only).
 * Automatically cleans up private Supabase Storage objects and compacts remaining slots.
 */
export async function deleteMemoryOrPhoto(params: {
  actor: MemoryActor;
  memoryId: string;
  photoId?: string | null;
}): Promise<
  | { ok: true; deletedMemory: boolean; memory: SquadMemory | null }
  | { ok: false; status: number; error: string }
> {
  const { actor, memoryId, photoId } = params;
  await getMemoriesWithSignedUrls();
  const existing = DataStore.getMemoryById(memoryId);
  if (!existing) {
    return { ok: false, status: 404, error: "Squad memory not found." };
  }

  const supabase = getSupabaseAdminClient();

  // Case A: Delete entire memory day (Admin only)
  if (!photoId) {
    if (actor.role !== "admin") {
      return { ok: false, status: 403, error: "Only the coach can delete an entire memory day." };
    }

    if (supabase) {
      const paths = existing.photos
        .map((p) => p.storage_path)
        .filter((p) => p && !p.startsWith("memory://"));
      if (paths.length > 0) {
        await supabase.storage.from(SQUAD_MEMORIES_BUCKET).remove(paths).catch(() => {});
      }
      const { error } = await supabase.from("squad_memories").delete().eq("id", memoryId);
      if (error) {
        console.error("[MemoriesService] Delete memory failed:", error);
        return { ok: false, status: 500, error: "Could not delete memory day." };
      }
    }

    DataStore.deleteMemory(memoryId);
    return { ok: true, deletedMemory: true, memory: null };
  }

  // Case B: Delete a single photo
  const targetPhoto = existing.photos.find((p) => p.id === photoId);
  if (!targetPhoto) {
    return { ok: false, status: 404, error: "Photo not found." };
  }

  const canDeletePhoto =
    actor.role === "admin" ||
    (actor.role === "swimmer" &&
      targetPhoto.uploaded_by_swimmer_id &&
      targetPhoto.uploaded_by_swimmer_id === actor.swimmerId);

  if (!canDeletePhoto) {
    return {
      ok: false,
      status: 403,
      error: "You can only delete photos you uploaded. Ask the coach to remove other photos.",
    };
  }

  const remaining = existing.photos
    .filter((p) => p.id !== photoId)
    .sort((a, b) => a.slot - b.slot)
    .map((p, idx) => ({ ...p, slot: (idx + 1) as 1 | 2 | 3 }));

  if (!supabase) {
    if (remaining.length === 0) {
      DataStore.deleteMemory(memoryId);
      return { ok: true, deletedMemory: true, memory: null };
    }
    const updated: SquadMemory = {
      ...existing,
      photos: remaining,
      updated_at: new Date().toISOString(),
    };
    DataStore.upsertMemory(updated);
    return { ok: true, deletedMemory: false, memory: updated };
  }

  // Remove object from private storage
  if (targetPhoto.storage_path && !targetPhoto.storage_path.startsWith("memory://")) {
    await supabase.storage
      .from(SQUAD_MEMORIES_BUCKET)
      .remove([targetPhoto.storage_path])
      .catch(() => {});
  }

  if (remaining.length === 0) {
    await supabase.from("squad_memories").delete().eq("id", memoryId);
    DataStore.deleteMemory(memoryId);
    return { ok: true, deletedMemory: true, memory: null };
  }

  // Delete target photo & compact remaining slots cleanly (1..N)
  await supabase.from("squad_memory_photos").delete().eq("id", photoId);
  for (const p of remaining) {
    await supabase
      .from("squad_memory_photos")
      .update({ slot: p.slot })
      .eq("id", p.id);
  }

  const refreshed = await getMemoriesWithSignedUrls();
  const updated = refreshed.memories.find((m) => m.id === memoryId) || null;
  return { ok: true, deletedMemory: !updated, memory: updated };
}

/**
 * Fetches raw bytes of a single photo for authenticated download (Save Photo button on mobile/desktop).
 */
export async function downloadMemoryPhotoBytes(photoId: string): Promise<{
  buffer: Buffer;
  mimeType: AllowedImageMime;
  filename: string;
} | null> {
  await getMemoriesWithSignedUrls();
  const found = DataStore.getMemoryPhotoById(photoId);
  if (!found) return null;

  const { memory, photo } = found;
  const ext = mimeToExtension(photo.mime_type);
  const filename = `swimtrack-memory-${memory.memory_date}-${photo.slot}.${ext}`;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    if (!photo.signed_url?.startsWith("data:")) return null;
    const base64Part = photo.signed_url.split(",")[1];
    if (!base64Part) return null;
    return {
      buffer: Buffer.from(base64Part, "base64"),
      mimeType: photo.mime_type,
      filename,
    };
  }

  const { data, error } = await supabase.storage
    .from(SQUAD_MEMORIES_BUCKET)
    .download(photo.storage_path);
  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: photo.mime_type,
    filename,
  };
}
