"use client";

import type { MonthlySquadWrapped } from "./squad-wrapped";

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

/**
 * Generates a crisp 1080x1350 Apple-Keynote-grade "Squad Wrapped" recap card PNG
 * ready to share into WhatsApp groups or Instagram Stories.
 */
export async function shareOrDownloadWrappedCard(
  wrapped: MonthlySquadWrapped
): Promise<"shared" | "downloaded"> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  // Deep Ocean Matte Slate Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07101C");
  bg.addColorStop(0.5, "#0B1D30");
  bg.addColorStop(1, "#060D16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient glows
  const glow1 = ctx.createRadialGradient(180, 180, 20, 180, 180, 480);
  glow1.addColorStop(0, "rgba(34, 211, 238, 0.16)");
  glow1.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(900, 1180, 20, 900, 1180, 460);
  glow2.addColorStop(0, "rgba(45, 212, 191, 0.14)");
  glow2.addColorStop(1, "rgba(45, 212, 191, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const pad = 64;
  const contentW = W - pad * 2;

  // Header Badge
  ctx.font = "800 24px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillStyle = "#22D3EE";
  ctx.fillText("SWIMTRACK  ·  SQUAD WRAPPED", pad, 108);

  // Month Title
  ctx.font = "900 66px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(wrapped.monthLabel, pad, 192);

  ctx.font = "500 26px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("Official Weekend Squad Performance & Banter Recap", pad, 238);

  // 4 Core KPI Tiles
  const kpis = [
    { label: "TURNOUT", value: `${wrapped.overallTurnoutPct}%`, color: "#22D3EE" },
    { label: "PRACTICES", value: String(wrapped.sessionsHeld), color: "#2DD4BF" },
    {
      label: "DISTANCE",
      value:
        wrapped.totalDistanceMeters >= 1000
          ? `${(wrapped.totalDistanceMeters / 1000).toFixed(1)} km`
          : `${wrapped.totalDistanceMeters} m`,
      color: "#FBBF24",
    },
    { label: "MEMORIES", value: `${wrapped.photosCount} 📸`, color: "#F8FAFC" },
  ];

  const tileGap = 20;
  const tileW = (contentW - tileGap * 3) / 4;
  const tileY = 285;
  const tileH = 148;

  kpis.forEach((kpi, idx) => {
    const tx = pad + idx * (tileW + tileGap);
    drawRoundedRect(ctx, tx, tileY, tileW, tileH, 24);
    ctx.fillStyle = "rgba(15, 30, 46, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "800 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText(kpi.label, tx + 24, tileY + 44);

    ctx.font = "900 44px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
    ctx.fillStyle = kpi.color;
    ctx.fillText(kpi.value, tx + 24, tileY + 112);
  });

  // Awards Section
  let cursorY = 495;
  ctx.font = "800 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("SQUAD AWARDS & CROWNS", pad, cursorY);
  cursorY += 26;

  const awardList = wrapped.awards.slice(0, 4);
  if (awardList.length > 0) {
    const colGap = 22;
    const cardW = (contentW - colGap) / 2;
    const cardH = 152;
    awardList.forEach((aw, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = pad + col * (cardW + colGap);
      const ay = cursorY + row * (cardH + colGap);

      drawRoundedRect(ctx, ax, ay, cardW, cardH, 26);
      ctx.fillStyle = "rgba(15, 30, 46, 0.95)";
      ctx.fill();
      ctx.strokeStyle =
        aw.tone === "gold"
          ? "rgba(251, 191, 36, 0.45)"
          : aw.tone === "coral"
          ? "rgba(251, 113, 133, 0.45)"
          : aw.tone === "seafoam"
          ? "rgba(45, 212, 191, 0.45)"
          : "rgba(34, 211, 238, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "800 20px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(`${aw.emoji}  ${aw.title.toUpperCase()}`, ax + 26, ay + 46);

      ctx.font = "900 36px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
      ctx.fillStyle = "#F8FAFC";
      ctx.fillText(aw.winnerName.slice(0, 18), ax + 26, ay + 96);

      ctx.font = "600 20px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#38BDF8";
      ctx.fillText(aw.metric, ax + 26, ay + 130);
    });
    cursorY += Math.ceil(awardList.length / 2) * (cardH + colGap) + 24;
  } else {
    cursorY += 40;
  }

  // Top 3 Leaderboard Strip
  if (wrapped.topLeaderboard.length > 0) {
    ctx.font = "800 24px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("TOP SQUAD LEADERBOARD", pad, cursorY);
    cursorY += 24;

    wrapped.topLeaderboard.slice(0, 3).forEach((entry, idx) => {
      const rowH = 74;
      const ry = cursorY + idx * (rowH + 14);
      drawRoundedRect(ctx, pad, ry, contentW, rowH, 20);
      ctx.fillStyle = idx === 0 ? "rgba(251, 191, 36, 0.14)" : "rgba(15, 30, 46, 0.85)";
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? "rgba(251, 191, 36, 0.4)" : "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = "900 28px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = idx === 0 ? "#FBBF24" : "#38BDF8";
      ctx.fillText(`#${idx + 1}`, pad + 26, ry + 47);

      ctx.font = "800 28px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
      ctx.fillStyle = "#F8FAFC";
      ctx.fillText(entry.name, pad + 96, ry + 47);

      const rightText = `${entry.points} pts · ${entry.attended} swims`;
      ctx.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#2DD4BF";
      const tw = ctx.measureText(rightText).width;
      ctx.fillText(rightText, pad + contentW - tw - 26, ry + 47);
    });
  }

  // Footer
  ctx.font = "600 20px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(148, 163, 184, 0.72)";
  ctx.fillText("SWIMTRACK · THE AQUATIC CONTROL ROOM", pad, H - 54);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.95)
  );
  if (!blob) throw new Error("Could not render Wrapped card.");

  const file = new File([blob], `swimtrack-wrapped-${wrapped.monthKey}.png`, {
    type: "image/png",
  });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `SwimTrack Squad Wrapped · ${wrapped.monthLabel}`,
        text: `${wrapped.monthLabel}: ${wrapped.overallTurnoutPct}% turnout across ${wrapped.sessionsHeld} practices!`,
        files: [file],
      });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "shared";
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
