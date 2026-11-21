import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DataStore } from "@/lib/data-store";
import {
  resolveMemoryActor,
  getMemoriesWithSignedUrls,
  addPhotosToMemoryDate,
  detectImageMimeFromBytes,
  MAX_PHOTOS_PER_DAY,
  MAX_UPLOAD_BYTES,
  type UploadMemoryPhotoInput,
} from "@/lib/memories-service";
import { memoryUploadRateLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/memories
 * Returns all Squad Memories (newest date first) with 1-hour signed URLs.
 * Strictly requires either an authenticated Admin session OR a PIN-authenticated Swimmer cookie.
 */
export async function GET(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });

  const tokenHint = request.nextUrl.searchParams.get("token");
  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json(
      { success: false, error: "Sign in to view squad memories." },
      { status: 401 }
    );
  }

  const { memories, migrationNeeded } = await getMemoriesWithSignedUrls();
  return NextResponse.json(
    { success: true, memories, migrationNeeded },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

/**
 * POST /api/memories
 * Multipart upload for 1 to 3 end-of-day squad memory photos for a specific date.
 * Allowed for BOTH authenticated Coach/Admin AND PIN-authenticated Swimmers.
 */
export async function POST(request: NextRequest) {
  await DataStore.syncFromSupabase({ maxAgeMs: 15_000 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid multipart upload payload." },
      { status: 400 }
    );
  }

  const tokenHint =
    typeof formData.get("swimmer_token") === "string"
      ? (formData.get("swimmer_token") as string)
      : null;

  const actor = await resolveMemoryActor(tokenHint);
  if (!actor) {
    return NextResponse.json(
      { success: false, needsLogin: true, error: "Please sign in with your PIN or Admin account to upload memories." },
      { status: 401 }
    );
  }

  // Rate-limit swimmer uploads to prevent abuse
  if (actor.role === "swimmer") {
    const rateKey = `mem_upload_${actor.swimmerId}`;
    const rate = memoryUploadRateLimiter.check(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload limit reached. Please wait ${rate.retryAfterSeconds} seconds before uploading more photos.`,
        },
        { status: 429 }
      );
    }
    memoryUploadRateLimiter.recordFailure(rateKey);
  }

  const memoryDate = String(formData.get("memory_date") || "").trim();
  const title = formData.has("title") ? String(formData.get("title") || "") : undefined;
  const caption = formData.has("caption") ? String(formData.get("caption") || "") : undefined;
  const location = formData.has("location") ? String(formData.get("location") || "") : undefined;
  const sessionId = formData.has("session_id")
    ? String(formData.get("session_id") || "").trim() || null
    : undefined;

  const rawFiles = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (rawFiles.length === 0) {
    const single = formData.get("file");
    if (single instanceof File && single.size > 0) {
      rawFiles.push(single);
    }
  }

  if (rawFiles.length === 0) {
    return NextResponse.json(
      { success: false, error: "Please select at least 1 photo to upload." },
      { status: 400 }
    );
  }

  if (rawFiles.length > MAX_PHOTOS_PER_DAY) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_PHOTOS_PER_DAY} photos can be uploaded per day.` },
      { status: 400 }
    );
  }

  const widths = formData.getAll("widths").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const heights = formData.getAll("heights").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const photoCaptions = formData.getAll("photo_captions").map((v) => String(v || ""));

  const validatedFiles: UploadMemoryPhotoInput[] = [];
  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i];
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `"${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Max size is 3MB per photo.`,
        },
        { status: 413 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const detectedMime = detectImageMimeFromBytes(buffer);
    if (!detectedMime) {
      return NextResponse.json(
        {
          success: false,
          error: `"${file.name}" is not a supported image. Please upload JPG, PNG, or WebP photos.`,
        },
        { status: 400 }
      );
    }

    validatedFiles.push({
      buffer,
      mimeType: detectedMime,
      width: widths[i] ?? null,
      height: heights[i] ?? null,
      caption: photoCaptions[i] || null,
    });
  }

  const result = await addPhotosToMemoryDate({
    actor,
    memoryDate,
    title,
    caption,
    location,
    sessionId,
    files: validatedFiles,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  revalidatePath("/memories");
  revalidatePath("/portal");
  if (actor.swimmerToken) {
    revalidatePath(`/portal/${actor.swimmerToken}`);
  }
  if (result.memory.session_id) {
    revalidatePath(`/sessions/${result.memory.session_id}`);
  }

  return NextResponse.json({
    success: true,
    memory: result.memory,
  });
}
