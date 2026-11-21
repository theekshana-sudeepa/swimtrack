"use client";

import type { SquadMemory, SquadMemoryPhoto } from "@/types/database";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:\s]+$/, "")}…`;
  }
  return lines;
}

function formatPolaroidDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  const month = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return `${weekday} · ${String(d || 1).padStart(2, "0")} ${month} ${y || 2026}`;
}

async function loadPhotoBlobImage(
  photo: SquadMemoryPhoto,
  swimmerToken?: string | null
): Promise<HTMLImageElement> {
  // Always load via our same-origin authenticated photo endpoint so canvas never hits CORS taint!
  const query = swimmerToken ? `?token=${encodeURIComponent(swimmerToken)}` : "";
  const url = `/api/memories/photo/${photo.id}${query}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not load photo for Polaroid card.");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode memory photo."));
    };
    img.src = objectUrl;
  });
}

/**
 * Generates a crisp 1080x1350 (4:5 Instagram / WhatsApp Story ready) SwimTrack Polaroid Card
 * framed in deep ocean slate with date stamp, title, location, caption, and checked-in squad roster.
 */
export async function buildPolaroidCardFile(params: {
  memory: SquadMemory;
  photo: SquadMemoryPhoto;
  swimmerToken?: string | null;
}): Promise<File> {
  const { memory, photo, swimmerToken } = params;
  const img = await loadPhotoBlobImage(photo, swimmerToken);

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  // 1. Deep Ocean Gradient Backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#06101B");
  bg.addColorStop(0.55, "#0B1D30");
  bg.addColorStop(1, "#071320");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle ambient aqua glow top-right
  const glow = ctx.createRadialGradient(W * 0.85, 110, 20, W * 0.85, 110, 420);
  glow.addColorStop(0, "rgba(34, 211, 238, 0.16)");
  glow.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 2. Polaroid Inner Card Frame
  const pad = 54;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.fillStyle = "#0F1E2E";
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 3. Top Header Strip (Brand + Date Stamp)
  const innerPad = 42;
  const contentX = cardX + innerPad;
  const contentW = cardW - innerPad * 2;
  const headerY = cardY + 52;

  ctx.font = "800 24px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillStyle = "#38BDF8";
  ctx.fillText("SWIMTRACK  ·  SQUAD MEMORY", contentX, headerY + 20);

  // Date Pill on right
  const dateText = formatPolaroidDate(memory.memory_date);
  ctx.font = "800 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  const dateMetrics = ctx.measureText(dateText);
  const pillW = dateMetrics.width + 38;
  const pillH = 44;
  const pillX = contentX + contentW - pillW;
  const pillY = headerY - 10;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(34, 211, 238, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#22D3EE";
  ctx.fillText(dateText, pillX + 19, pillY + 29);

  // 4. Crisp Rounded Photo Area (center-cropped cover)
  const photoX = contentX;
  const photoY = cardY + 124;
  const photoW = contentW;
  const photoH = 740;

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 28);
  ctx.clip();

  const srcRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const dstRatio = photoW / photoH;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);

  // Soft bottom photo gradient for depth
  const imgShade = ctx.createLinearGradient(0, photoY + photoH - 130, 0, photoY + photoH);
  imgShade.addColorStop(0, "rgba(0,0,0,0)");
  imgShade.addColorStop(1, "rgba(6,16,27,0.45)");
  ctx.fillStyle = imgShade;
  ctx.fillRect(photoX, photoY + photoH - 130, photoW, 130);
  ctx.restore();

  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 28);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. Title, Location & Caption
  let cursorY = photoY + photoH + 62;

  ctx.font = "900 42px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillStyle = "#F8FAFC";
  const titleLines = wrapTextLines(ctx, memory.title || "End-of-Day Squad Memory", contentW, 2);
  for (const line of titleLines) {
    ctx.fillText(line, contentX, cursorY);
    cursorY += 48;
  }

  if (memory.location) {
    cursorY += 4;
    ctx.font = "600 24px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = "#94A3B8";
    const locLines = wrapTextLines(ctx, `📍 ${memory.location}`, contentW, 1);
    ctx.fillText(locLines[0] || "", contentX, cursorY);
    cursorY += 40;
  }

  const story = photo.caption || memory.caption;
  if (story) {
    cursorY += 2;
    ctx.font = "500 24px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = "#CBD5E1";
    const captionLines = wrapTextLines(ctx, `“${story}”`, contentW, 2);
    for (const line of captionLines) {
      ctx.fillText(line, contentX, cursorY);
      cursorY += 34;
    }
  }

  // 6. Auto-Tagged "Who Swam That Day" Roster Strip (Bottom)
  const footerLineY = cardY + cardH - 110;
  ctx.beginPath();
  ctx.moveTo(contentX, footerLineY);
  ctx.lineTo(contentX + contentW, footerLineY);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const attendees = memory.attendees || [];
  if (attendees.length > 0) {
    const names = attendees
      .slice(0, 6)
      .map((a) => a.name)
      .join(", ");
    const extra = attendees.length > 6 ? ` +${attendees.length - 6}` : "";
    ctx.font = "700 22px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = "#2DD4BF";
    const line = wrapTextLines(
      ctx,
      `🏊 ${attendees.length} in the water: ${names}${extra}`,
      contentW,
      1
    )[0];
    ctx.fillText(line || "", contentX, footerLineY + 42);
  } else {
    ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText(`📸 Captured by ${photo.uploaded_by_name}`, contentX, footerLineY + 42);
  }

  ctx.font = "600 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(148, 163, 184, 0.72)";
  ctx.fillText(
    `SWIMTRACK AQUATIC CONTROL ROOM  ·  PHOTO ${photo.slot}/${memory.photos.length}`,
    contentX,
    footerLineY + 78
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.95)
  );
  if (!blob) throw new Error("Failed to render Polaroid card.");

  return new File([blob], `swimtrack-polaroid-${memory.memory_date}-${photo.slot}.png`, {
    type: "image/png",
  });
}

/**
 * Shares the generated Polaroid card via native mobile Share Sheet (WhatsApp/IG) if supported,
 * or triggers an instant crisp PNG download on desktop.
 */
export async function shareOrDownloadPolaroid(params: {
  memory: SquadMemory;
  photo: SquadMemoryPhoto;
  swimmerToken?: string | null;
}): Promise<"shared" | "downloaded"> {
  const file = await buildPolaroidCardFile(params);

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `${params.memory.title} (${params.memory.memory_date})`,
        text: `SwimTrack Squad Memory · ${params.memory.memory_date}`,
        files: [file],
      });
      return "shared";
    } catch (err) {
      // If user dismissed share sheet, do not fall back to forced download
      if (err instanceof Error && err.name === "AbortError") {
        return "shared";
      }
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}
