"use client";

import * as React from "react";
import {
  Camera,
  Calendar,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Star,
  X,
  Images,
  Sparkles,
  Grid,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { SquadMemory, SquadMemoryPhoto, SwimSession } from "@/types/database";
import { MemoryUploadModal } from "./memory-upload-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function formatMemoryDateBadge(dateStr: string): {
  weekday: string;
  day: string;
  monthShort: string;
  year: string;
  fullLabel: string;
  monthYear: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  const monthShort = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const monthLong = dt.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const day = String(d || 1).padStart(2, "0");
  const year = String(y || 2026);
  return {
    weekday,
    day,
    monthShort,
    year,
    fullLabel: `${weekday} · ${day} ${monthShort} ${year}`,
    monthYear: `${monthLong} ${year}`,
  };
}

interface SquadMemoriesViewerProps {
  initialMemories: SquadMemory[];
  sessions?: SwimSession[];
  /** Swimmer token & ID when used inside Swimmer Portal */
  swimmerToken?: string | null;
  currentSwimmerId?: string | null;
  isAdmin?: boolean;
  /** Optional externally requested date to jump into the lightbox (e.g. from Attendance History) */
  openDateRequest?: { date: string; nonce: number } | null;
  onMemoriesChange?: (memories: SquadMemory[]) => void;
}

export function SquadMemoriesViewer({
  initialMemories,
  sessions = [],
  swimmerToken,
  currentSwimmerId,
  isAdmin = false,
  openDateRequest,
  onMemoriesChange,
}: SquadMemoriesViewerProps) {
  const [memories, setMemories] = React.useState<SquadMemory[]>(initialMemories);
  const [selectedMemoryId, setSelectedMemoryId] = React.useState<string | null>(
    initialMemories[0]?.id || null
  );
  const [showArchiveModal, setShowArchiveModal] = React.useState(false);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [uploadDefaultDate, setUploadDefaultDate] = React.useState<string | undefined>(undefined);
  const [lightbox, setLightbox] = React.useState<{
    memoryId: string;
    photoIndex: number;
  } | null>(null);
  const [busyPhotoId, setBusyPhotoId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMemories(initialMemories);
    if (initialMemories.length > 0) {
      setSelectedMemoryId((prev) =>
        prev && initialMemories.some((m) => m.id === prev) ? prev : initialMemories[0].id
      );
    } else {
      setSelectedMemoryId(null);
    }
  }, [initialMemories]);

  // Allow external trigger (e.g., clicking 📸 on Attendance History) to open a date's memory in the lightbox
  React.useEffect(() => {
    if (!openDateRequest?.date) return;
    const match = memories.find((m) => m.memory_date === openDateRequest.date);
    if (match && match.photos.length > 0) {
      setSelectedMemoryId(match.id);
      setLightbox({ memoryId: match.id, photoIndex: 0 });
    }
  }, [openDateRequest, memories]);

  const featuredMemory =
    memories.find((m) => m.id === selectedMemoryId) || memories[0] || null;

  const lightboxMemory = lightbox
    ? memories.find((m) => m.id === lightbox.memoryId) || null
    : null;
  const lightboxPhoto: SquadMemoryPhoto | null =
    lightbox && lightboxMemory ? lightboxMemory.photos[lightbox.photoIndex] || null : null;

  // Keyboard navigation in lightbox
  React.useEffect(() => {
    if (!lightbox || !lightboxMemory) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightbox(null);
      } else if (e.key === "ArrowRight") {
        setLightbox((prev) =>
          prev && lightboxMemory
            ? {
                ...prev,
                photoIndex: (prev.photoIndex + 1) % lightboxMemory.photos.length,
              }
            : prev
        );
      } else if (e.key === "ArrowLeft") {
        setLightbox((prev) =>
          prev && lightboxMemory
            ? {
                ...prev,
                photoIndex:
                  (prev.photoIndex - 1 + lightboxMemory.photos.length) %
                  lightboxMemory.photos.length,
              }
            : prev
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, lightboxMemory]);

  function syncMemoriesState(updater: (prev: SquadMemory[]) => SquadMemory[]) {
    setMemories((prev) => {
      const next = updater(prev).sort((a, b) => b.memory_date.localeCompare(a.memory_date));
      onMemoriesChange?.(next);
      return next;
    });
  }

  function handleUploaded(updatedMemory: SquadMemory) {
    syncMemoriesState((prev) => {
      const exists = prev.some((m) => m.id === updatedMemory.id);
      return exists
        ? prev.map((m) => (m.id === updatedMemory.id ? updatedMemory : m))
        : [updatedMemory, ...prev];
    });
    setSelectedMemoryId(updatedMemory.id);
  }

  function canDeletePhoto(photo: SquadMemoryPhoto): boolean {
    if (isAdmin) return true;
    return Boolean(
      currentSwimmerId &&
        photo.uploaded_by_swimmer_id &&
        photo.uploaded_by_swimmer_id === currentSwimmerId
    );
  }

  async function handleDeletePhoto(memory: SquadMemory, photo: SquadMemoryPhoto) {
    if (!window.confirm("Remove this photo from Squad Memories?")) return;
    setBusyPhotoId(photo.id);
    try {
      const query = new URLSearchParams({ photoId: photo.id });
      if (swimmerToken) query.set("token", swimmerToken);
      const res = await fetch(`/api/memories/${memory.id}?${query.toString()}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        deletedMemory?: boolean;
        memory?: SquadMemory | null;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not remove photo.");
        return;
      }

      if (json.deletedMemory || !json.memory) {
        syncMemoriesState((prev) => prev.filter((m) => m.id !== memory.id));
        setLightbox(null);
      } else {
        const nextMem = json.memory;
        syncMemoriesState((prev) => prev.map((m) => (m.id === nextMem.id ? nextMem : m)));
        setLightbox((prev) => {
          if (!prev || prev.memoryId !== nextMem.id) return prev;
          if (nextMem.photos.length === 0) return null;
          return {
            memoryId: nextMem.id,
            photoIndex: Math.min(prev.photoIndex, nextMem.photos.length - 1),
          };
        });
      }
      toast.success("Photo removed from memories.");
    } catch {
      toast.error("Failed to remove photo. Please try again.");
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleSetCover(memory: SquadMemory, photo: SquadMemoryPhoto) {
    if (!isAdmin || photo.slot === 1) return;
    setBusyPhotoId(photo.id);
    try {
      const res = await fetch(`/api/memories/${memory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_photo_id: photo.id }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        memory?: SquadMemory;
        error?: string;
      };
      if (!res.ok || !json.success || !json.memory) {
        toast.error(json.error || "Could not update cover photo.");
        return;
      }
      syncMemoriesState((prev) =>
        prev.map((m) => (m.id === json.memory!.id ? json.memory! : m))
      );
      setLightbox({ memoryId: json.memory.id, photoIndex: 0 });
      toast.success("Cover photo updated!");
    } catch {
      toast.error("Could not update cover photo.");
    } finally {
      setBusyPhotoId(null);
    }
  }

  function getDownloadHref(photoId: string): string {
    const query = swimmerToken ? `?token=${encodeURIComponent(swimmerToken)}` : "";
    return `/api/memories/photo/${photoId}${query}`;
  }

  // Group all memories by Month & Year for the full archive modal
  const memoriesByMonth = React.useMemo(() => {
    const groups: { label: string; items: SquadMemory[] }[] = [];
    for (const m of memories) {
      const { monthYear } = formatMemoryDateBadge(m.memory_date);
      const existingGroup = groups.find((g) => g.label === monthYear);
      if (existingGroup) existingGroup.items.push(m);
      else groups.push({ label: monthYear, items: [m] });
    }
    return groups;
  }, [memories]);

  const totalPhotosCount = React.useMemo(
    () => memories.reduce((sum, m) => sum + m.photos.length, 0),
    [memories]
  );

  return (
    <>
      <section
        id="squad-memories"
        className="scroll-mt-20 p-5 sm:p-6 rounded-3xl border border-aqua/30 bg-card shadow-lg space-y-4"
      >
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-aqua/15 border border-aqua/30 text-aqua flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground leading-tight">
                Squad Memories 📸
              </h2>
              <p className="text-[11px] text-muted-foreground">
                End-of-day squad photos saved by date &bull; up to 3 per day
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {memories.length > 1 && (
              <button
                type="button"
                onClick={() => setShowArchiveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-foreground text-[11px] font-bold transition-colors"
              >
                <Grid className="w-3.5 h-3.5 text-aqua" />
                <span>All Dates ({memories.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setUploadDefaultDate(undefined);
                setShowUploadModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-[11px] font-extrabold shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Photo</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {!featuredMemory ? (
          <div className="py-8 px-4 rounded-2xl border border-dashed border-border bg-secondary/20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-aqua/10 border border-aqua/25 text-aqua flex items-center justify-center mx-auto">
              <Images className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-foreground">
                No squad memories saved yet
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Drop today&apos;s end-of-day group photo (1 to 3 shots per date) so every friend in the squad can relive the weekend together.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUploadDefaultDate(undefined);
                setShowUploadModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold text-xs shadow-sm transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Add Today&apos;s First Memory</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Featured Memory Day Metadata Strip */}
            {(() => {
              const badge = formatMemoryDateBadge(featuredMemory.memory_date);
              const photoCount = featuredMemory.photos.length;
              return (
                <motion.div
                  key={featuredMemory.id}
                  initial={{ opacity: 0.7, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aqua/15 border border-aqua/35 text-aqua text-[11px] font-black tracking-wide font-mono">
                        <Calendar className="w-3 h-3" />
                        <span>{badge.fullLabel}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-bold text-muted-foreground font-mono">
                        {photoCount}/3 photos
                      </span>
                      {featuredMemory.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium truncate">
                          <MapPin className="w-3 h-3 text-coral shrink-0" />
                          <span className="truncate">{featuredMemory.location}</span>
                        </span>
                      )}
                    </div>

                    {photoCount < 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadDefaultDate(featuredMemory.memory_date);
                          setShowUploadModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-aqua hover:underline underline-offset-4"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add {3 - photoCount} more for this day</span>
                      </button>
                    )}
                  </div>

                  {/* Adaptive 1 / 2 / 3 Photo Magazine Collage */}
                  <div
                    className={cn(
                      "grid gap-2",
                      photoCount === 1
                        ? "grid-cols-1"
                        : photoCount === 2
                        ? "grid-cols-2"
                        : "grid-cols-1 sm:grid-cols-3"
                    )}
                  >
                    {featuredMemory.photos.map((photo, idx) => {
                      const isBentoHero = photoCount === 3 && idx === 0;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() =>
                            setLightbox({ memoryId: featuredMemory.id, photoIndex: idx })
                          }
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border border-border/80 bg-ocean-950 text-left focus:outline-none focus:ring-2 focus:ring-aqua",
                            photoCount === 1
                              ? "aspect-[16/10] sm:aspect-[16/9]"
                              : photoCount === 2
                              ? "aspect-[4/3]"
                              : isBentoHero
                              ? "sm:col-span-2 sm:row-span-2 aspect-[4/3] sm:aspect-auto sm:min-h-[300px]"
                              : "aspect-[4/3] sm:aspect-auto sm:min-h-[146px]"
                          )}
                        >
                          {photo.signed_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.signed_url}
                              alt={photo.caption || `${featuredMemory.title} — ${featuredMemory.memory_date}`}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              Photo unavailable
                            </div>
                          )}

                          {/* Subtle Date Stamp & Hover Caption Overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              {idx === 0 && (
                                <div className="text-xs sm:text-sm font-extrabold text-white truncate drop-shadow">
                                  {featuredMemory.title}
                                </div>
                              )}
                              {(photo.caption || (idx === 0 && featuredMemory.caption)) && (
                                <p className="text-[11px] text-white/85 line-clamp-1">
                                  {photo.caption || featuredMemory.caption}
                                </p>
                              )}
                              <div className="text-[10px] text-white/70 font-medium mt-0.5">
                                {photo.uploaded_by_role === "admin" ? "👑 " : "📸 "}
                                {photo.uploaded_by_name}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-black/55 border border-white/15 text-[10px] font-mono font-bold text-white/90 shrink-0 backdrop-blur-sm">
                              {idx + 1}/{photoCount}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Story Caption (when not already shown or multi-line) */}
                  {featuredMemory.caption && (
                    <p className="text-xs text-muted-foreground bg-secondary/30 border border-border/70 rounded-2xl px-3.5 py-2.5 leading-relaxed">
                      <Sparkles className="w-3.5 h-3.5 text-aqua inline mr-1.5 -mt-0.5" />
                      {featuredMemory.caption}
                    </p>
                  )}
                </motion.div>
              );
            })()}

            {/* Horizontal Memory Date Strip (switch between dates effortlessly) */}
            {memories.length > 1 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
                  <span>Memory Timeline ({totalPhotosCount} photos across {memories.length} days)</span>
                  <span>Tap a date to view</span>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {memories.slice(0, 12).map((mem) => {
                    const badge = formatMemoryDateBadge(mem.memory_date);
                    const cover = mem.photos[0];
                    const isSelected = mem.id === featuredMemory.id;
                    return (
                      <button
                        key={mem.id}
                        type="button"
                        onClick={() => setSelectedMemoryId(mem.id)}
                        className={cn(
                          "group shrink-0 w-28 rounded-2xl border overflow-hidden text-left transition-all",
                          isSelected
                            ? "border-aqua ring-2 ring-aqua/40 shadow-md"
                            : "border-border/80 hover:border-aqua/40 opacity-85 hover:opacity-100"
                        )}
                      >
                        <div className="relative h-16 bg-ocean-950 overflow-hidden">
                          {cover?.signed_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover.signed_url}
                              alt={mem.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-mono font-bold text-white">
                            {mem.photos.length}
                          </span>
                        </div>
                        <div className="px-2 py-1.5 bg-card">
                          <div className="text-[10px] font-black font-mono text-aqua">
                            {badge.day} {badge.monthShort}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {mem.title}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Full-Screen Lightbox Modal */}
      {lightbox && lightboxMemory && lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setLightbox(null)}
        >
          {/* Top Bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 max-w-5xl w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-aqua/20 border border-aqua/40 text-aqua text-xs font-black font-mono shrink-0">
                {formatMemoryDateBadge(lightboxMemory.memory_date).fullLabel}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">
                  {lightboxMemory.title}
                </div>
                {lightboxMemory.location && (
                  <div className="text-[11px] text-white/70 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-coral shrink-0" />
                    <span>{lightboxMemory.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && lightboxPhoto.slot !== 1 && (
                <button
                  type="button"
                  disabled={busyPhotoId === lightboxPhoto.id}
                  onClick={() => handleSetCover(lightboxMemory, lightboxPhoto)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-xs font-bold transition-colors"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Set Cover</span>
                </button>
              )}

              <a
                href={getDownloadHref(lightboxPhoto.id)}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Photo</span>
              </a>

              {canDeletePhoto(lightboxPhoto) && (
                <button
                  type="button"
                  disabled={busyPhotoId === lightboxPhoto.id}
                  onClick={() => handleDeletePhoto(lightboxMemory, lightboxPhoto)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-coral/20 hover:bg-coral/35 border border-coral/40 text-coral text-xs font-bold transition-colors"
                >
                  {busyPhotoId === lightboxPhoto.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close lightbox"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Image Stage */}
          <div
            className="relative flex-1 flex items-center justify-center my-3 max-w-5xl w-full mx-auto min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxMemory.photos.length > 1 && (
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? {
                          ...prev,
                          photoIndex:
                            (prev.photoIndex - 1 + lightboxMemory.photos.length) %
                            lightboxMemory.photos.length,
                        }
                      : null
                  )
                }
                className="absolute left-1 sm:left-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {lightboxPhoto.signed_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxPhoto.signed_url}
                alt={lightboxPhoto.caption || lightboxMemory.title}
                className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
              />
            )}

            {lightboxMemory.photos.length > 1 && (
              <button
                type="button"
                aria-label="Next photo"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? {
                          ...prev,
                          photoIndex: (prev.photoIndex + 1) % lightboxMemory.photos.length,
                        }
                      : null
                  )
                }
                className="absolute right-1 sm:right-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-all active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Bottom Caption & Thumbnail Switcher */}
          <div
            className="max-w-3xl w-full mx-auto space-y-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {(lightboxPhoto.caption || lightboxMemory.caption) && (
                <p className="text-xs sm:text-sm text-white/90 font-medium">
                  {lightboxPhoto.caption || lightboxMemory.caption}
                </p>
              )}
              <p className="text-[11px] text-white/60">
                Photo {lightbox.photoIndex + 1} of {lightboxMemory.photos.length} &bull; Added by{" "}
                <strong className="text-white/85">{lightboxPhoto.uploaded_by_name}</strong>
              </p>
            </div>

            {lightboxMemory.photos.length > 1 && (
              <div className="flex items-center justify-center gap-2">
                {lightboxMemory.photos.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox({ memoryId: lightboxMemory.id, photoIndex: idx })}
                    className={cn(
                      "w-16 h-12 rounded-xl overflow-hidden border-2 transition-all",
                      idx === lightbox.photoIndex
                        ? "border-aqua scale-105"
                        : "border-white/20 opacity-60 hover:opacity-100"
                    )}
                  >
                    {p.signed_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.signed_url}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Month-by-Month Memory Archive Modal */}
      {showArchiveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl p-5 sm:p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Images className="w-4 h-4 text-aqua" />
                  <span>Full Squad Memory Vault</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalPhotosCount} photos across {memories.length} memorable days
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {memoriesByMonth.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-aqua flex items-center gap-2">
                    <span>{group.label}</span>
                    <span className="h-px flex-1 bg-border/80" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map((mem) => {
                      const badge = formatMemoryDateBadge(mem.memory_date);
                      const cover = mem.photos[0];
                      return (
                        <button
                          key={mem.id}
                          type="button"
                          onClick={() => {
                            setSelectedMemoryId(mem.id);
                            setShowArchiveModal(false);
                            setLightbox({ memoryId: mem.id, photoIndex: 0 });
                          }}
                          className="group rounded-2xl border border-border bg-secondary/20 hover:border-aqua/50 overflow-hidden text-left transition-all"
                        >
                          <div className="relative aspect-[16/10] bg-ocean-950 overflow-hidden">
                            {cover?.signed_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover.signed_url}
                                alt={mem.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                            <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 border border-white/15 text-[10px] font-black font-mono text-aqua backdrop-blur-sm">
                              {badge.fullLabel}
                            </span>
                            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-mono font-bold text-white">
                              {mem.photos.length}/3
                            </span>
                          </div>
                          <div className="p-3 space-y-1">
                            <div className="text-xs font-extrabold text-foreground truncate">
                              {mem.title}
                            </div>
                            {mem.location && (
                              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-coral shrink-0" />
                                <span>{mem.location}</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <MemoryUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        existingMemories={memories}
        sessions={sessions}
        defaultDate={uploadDefaultDate}
        swimmerToken={swimmerToken}
        onUploaded={handleUploaded}
      />
    </>
  );
}
