"use client";

import * as React from "react";
import {
  Camera,
  Calendar,
  MapPin,
  Upload,
  X,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
  ImagePlus,
  AlertCircle,
} from "lucide-react";
import { SquadMemory, SwimSession } from "@/types/database";
import {
  compressMemoryPhoto,
  formatBytes,
  type CompressedPhotoResult,
} from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_PHOTOS_PER_DAY = 3;

function getTodayColomboDate(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export interface MemoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMemories: SquadMemory[];
  sessions?: SwimSession[];
  defaultDate?: string;
  defaultSessionId?: string | null;
  defaultLocation?: string | null;
  defaultTitle?: string | null;
  /** Pass swimmer token when uploading from the Swimmer Portal */
  swimmerToken?: string | null;
  onUploaded: (memory: SquadMemory) => void;
}

interface PendingPhoto extends CompressedPhotoResult {
  id: string;
  caption: string;
}

export function MemoryUploadModal({
  isOpen,
  onClose,
  existingMemories,
  sessions = [],
  defaultDate,
  defaultSessionId,
  defaultLocation,
  defaultTitle,
  swimmerToken,
  onUploaded,
}: MemoryUploadModalProps) {
  const [memoryDate, setMemoryDate] = React.useState(defaultDate || getTodayColomboDate());
  const [title, setTitle] = React.useState(defaultTitle || "");
  const [location, setLocation] = React.useState(defaultLocation || "");
  const [caption, setCaption] = React.useState("");
  const [pendingPhotos, setPendingPhotos] = React.useState<PendingPhoto[]>([]);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync defaults when modal opens
  React.useEffect(() => {
    if (!isOpen) return;
    const initialDate = defaultDate || getTodayColomboDate();
    setMemoryDate(initialDate);
    const matchedMem = existingMemories.find((m) => m.memory_date === initialDate);
    const matchedSess = sessions.find((s) => s.date === initialDate);
    setTitle(matchedMem?.title || defaultTitle || (matchedSess ? `${matchedSess.title} Memories` : ""));
    setLocation(matchedMem?.location || defaultLocation || matchedSess?.location || "");
    setCaption(matchedMem?.caption || "");
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, [isOpen, defaultDate, defaultTitle, defaultLocation, existingMemories, sessions]);

  // Cleanup preview object URLs on unmount
  React.useEffect(() => {
    return () => {
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const existingForDate = existingMemories.find((m) => m.memory_date === memoryDate) || null;
  const matchedSession =
    (defaultSessionId && sessions.find((s) => s.id === defaultSessionId && s.date === memoryDate)) ||
    sessions.find((s) => s.date === memoryDate) ||
    null;

  const alreadyUsedCount = existingForDate?.photos.length || 0;
  const remainingSlots = Math.max(0, MAX_PHOTOS_PER_DAY - alreadyUsedCount);
  const canAddMoreCount = Math.max(0, remainingSlots - pendingPhotos.length);

  function handleDateChange(nextDate: string) {
    setMemoryDate(nextDate);
    const mem = existingMemories.find((m) => m.memory_date === nextDate);
    const sess = sessions.find((s) => s.date === nextDate);
    if (mem) {
      setTitle(mem.title);
      setLocation(mem.location || "");
      setCaption(mem.caption || "");
    } else if (sess) {
      setTitle(`${sess.title} Memories`);
      setLocation(sess.location || "");
      setCaption("");
    }
    // Trim pending photos if new date has fewer remaining slots
    const maxForNext = Math.max(0, MAX_PHOTOS_PER_DAY - (mem?.photos.length || 0));
    setPendingPhotos((prev) => {
      if (prev.length <= maxForNext) return prev;
      prev.slice(maxForNext).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.slice(0, maxForNext);
    });
  }

  async function processFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    if (canAddMoreCount <= 0) {
      toast.error(
        `This date already has all ${MAX_PHOTOS_PER_DAY} photo slots filled (max ${MAX_PHOTOS_PER_DAY} per day).`
      );
      return;
    }

    const toProcess = incoming.slice(0, canAddMoreCount);
    if (incoming.length > canAddMoreCount) {
      toast.info(
        `Only ${canAddMoreCount} slot${canAddMoreCount === 1 ? "" : "s"} left for ${memoryDate} — keeping the first ${canAddMoreCount} photo${canAddMoreCount === 1 ? "" : "s"}.`
      );
    }

    setIsCompressing(true);
    try {
      const processed: PendingPhoto[] = [];
      for (const f of toProcess) {
        try {
          const compressed = await compressMemoryPhoto(f);
          processed.push({
            ...compressed,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            caption: "",
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Could not read ${f.name}`);
        }
      }
      if (processed.length > 0) {
        setPendingPhotos((prev) => [...prev, ...processed].slice(0, remainingSlots));
      }
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removePending(id: string) {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memoryDate) {
      toast.error("Please select the memory date.");
      return;
    }
    if (pendingPhotos.length === 0) {
      toast.error("Please add at least 1 photo.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("memory_date", memoryDate);
      if (title.trim()) formData.append("title", title.trim());
      if (caption.trim() || existingForDate) formData.append("caption", caption.trim());
      if (location.trim() || existingForDate) formData.append("location", location.trim());
      if (matchedSession?.id) formData.append("session_id", matchedSession.id);
      if (swimmerToken) formData.append("swimmer_token", swimmerToken);

      for (const photo of pendingPhotos) {
        formData.append("files", photo.file);
        formData.append("widths", String(photo.width));
        formData.append("heights", String(photo.height));
        formData.append("photo_captions", photo.caption.trim());
      }

      const res = await fetch("/api/memories", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        memory?: SquadMemory;
        error?: string;
      };

      if (!res.ok || !json.success || !json.memory) {
        toast.error(json.error || "Could not upload photos. Please try again.");
        return;
      }

      toast.success(
        `Saved ${pendingPhotos.length} memory photo${pendingPhotos.length === 1 ? "" : "s"} for ${memoryDate}!`
      );
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPhotos([]);
      onUploaded(json.memory);
      onClose();
    } catch {
      toast.error("Network error while uploading memory. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isUploading) onClose();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aqua/15 border border-aqua/30 text-aqua flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Add End-of-Day Squad Photos
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Save 1 to 3 photos per date — visible on every swimmer&apos;s private portal
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            aria-label="Close upload modal"
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Picker + Slot Availability Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="memory-date-input"
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-aqua" />
                <span>Memory Date *</span>
              </label>
              <input
                id="memory-date-input"
                type="date"
                required
                value={memoryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-aqua/60"
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Daily Photo Slots (Max 3)
              </div>
              <div
                className={cn(
                  "px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between",
                  remainingSlots === 0
                    ? "bg-coral/10 border-coral/30 text-coral"
                    : "bg-aqua/10 border-aqua/30 text-aqua"
                )}
              >
                <span>
                  {alreadyUsedCount + pendingPhotos.length} / {MAX_PHOTOS_PER_DAY} slots used
                </span>
                <span className="text-[10px] font-mono opacity-90">
                  {remainingSlots === 0
                    ? "Date Full"
                    : `${canAddMoreCount} left`}
                </span>
              </div>
            </div>
          </div>

          {matchedSession && (
            <div className="px-3.5 py-2 rounded-xl bg-seafoam/10 border border-seafoam/25 text-[11px] text-seafoam flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Auto-linked to practice: <strong>{matchedSession.title}</strong>
              </span>
            </div>
          )}

          {/* Photo Dropzone */}
          {remainingSlots === 0 ? (
            <div className="p-4 rounded-2xl bg-coral/10 border border-coral/30 text-xs text-coral flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>{memoryDate}</strong> already has all 3 memories uploaded. Pick another date or remove one of the photos from that date first.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    processFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => {
                  if (canAddMoreCount > 0 && !isCompressing) {
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer",
                  isDragging
                    ? "border-aqua bg-aqua/10 scale-[1.01]"
                    : canAddMoreCount > 0
                    ? "border-border hover:border-aqua/60 bg-secondary/25 hover:bg-secondary/40"
                    : "border-border/50 bg-secondary/15 opacity-60 cursor-not-allowed"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={canAddMoreCount > 1}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      processFiles(e.target.files);
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-aqua/15 border border-aqua/30 text-aqua flex items-center justify-center">
                    {isCompressing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {isCompressing
                      ? "Optimizing photo for fast squad viewing..."
                      : canAddMoreCount > 0
                      ? `Tap to choose or drop up to ${canAddMoreCount} photo${canAddMoreCount === 1 ? "" : "s"}`
                      : "All 3 slots filled for this date"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    JPG, PNG, or WebP &bull; Auto-resized cleanly for instant mobile loading
                  </p>
                </div>
              </div>

              {/* Pending Photo Previews */}
              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {pendingPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="rounded-2xl border border-border bg-secondary/30 overflow-hidden flex flex-col"
                    >
                      <div className="relative aspect-[4/3] bg-black/40 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.previewUrl}
                          alt={`Selected squad memory ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-bold text-white backdrop-blur-sm">
                          #{alreadyUsedCount + idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePending(photo.id)}
                          aria-label="Remove selected photo"
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-coral transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-2 space-y-1.5">
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                          <span>{photo.width}&times;{photo.height}</span>
                          <span className="text-seafoam font-semibold">
                            {formatBytes(photo.compressedSize)}
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={200}
                          value={photo.caption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingPhotos((prev) =>
                              prev.map((p) => (p.id === photo.id ? { ...p, caption: val } : p))
                            );
                          }}
                          placeholder="Photo caption (optional)"
                          className="w-full px-2 py-1 rounded-lg border border-border bg-background/70 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Day Title, Location & Story */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">
                  Memory Title
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Post-Swim Coffee & Hangout"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-coral" />
                  <span>Place / Hangout Spot</span>
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Barista Cafe after swim"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">
                Day Note / Memory Caption (optional)
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a short memory for the squad to look back on..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua resize-none"
              />
            </div>
          </div>

          {/* Privacy Guarantee + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-aqua shrink-0" />
              <span>Stored privately — only PIN-verified squad members can view.</span>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isUploading}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || isCompressing || pendingPhotos.length === 0 || remainingSlots === 0}
                className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-40"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      Save {pendingPhotos.length > 0 ? `${pendingPhotos.length} ` : ""}Memor{pendingPhotos.length === 1 ? "y" : "ies"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
