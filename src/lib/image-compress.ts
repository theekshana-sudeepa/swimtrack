"use client";

export interface CompressedPhotoResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

const MAX_DIMENSION = 1600;
const TARGET_QUALITY = 0.84;

function loadImageFromFile(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file)
      .then((bitmap) => ({
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }))
      .catch(() => loadHtmlImage(file));
  }
  return loadHtmlImage(file);
}

function loadHtmlImage(file: File): Promise<{
  source: HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image file. Please try a JPG, PNG, or WebP photo."));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/jpeg",
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Resizes and compresses a phone/camera image in the browser before upload.
 * Keeps photos crisp on retina screens (max 1600px) while cutting 5–10MB originals
 * down to ~200–400KB for fast mobile uploads and minimal Supabase storage usage.
 */
export async function compressMemoryPhoto(inputFile: File): Promise<CompressedPhotoResult> {
  if (!inputFile.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(inputFile.name)) {
    throw new Error("Please select an image file (JPG, PNG, or WebP).");
  }

  const loaded = await loadImageFromFile(inputFile);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(loaded.width, loaded.height));
    const targetWidth = Math.max(1, Math.round(loaded.width * scale));
    const targetHeight = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Browser canvas is unavailable for photo optimization.");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

    // Prefer WebP; fall back cleanly to JPEG if browser cannot encode WebP
    let blob = await canvasToBlob(canvas, "image/webp", TARGET_QUALITY);
    let outputMime: "image/webp" | "image/jpeg" = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", TARGET_QUALITY);
      outputMime = "image/jpeg";
    }

    if (!blob) {
      throw new Error("Could not optimize this image. Please try another photo.");
    }

    // If still larger than 2.4MB (rare), re-encode slightly tighter
    if (blob.size > 2.4 * 1024 * 1024) {
      const tighter = await canvasToBlob(canvas, outputMime, 0.72);
      if (tighter) blob = tighter;
    }

    const ext = outputMime === "image/webp" ? "webp" : "jpg";
    const baseName = inputFile.name.replace(/\.[^.]+$/, "").slice(0, 40) || "squad-memory";
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: outputMime,
      lastModified: Date.now(),
    });

    const previewUrl = URL.createObjectURL(compressedFile);

    return {
      file: compressedFile,
      previewUrl,
      width: targetWidth,
      height: targetHeight,
      originalSize: inputFile.size,
      compressedSize: compressedFile.size,
    };
  } finally {
    loaded.cleanup();
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
