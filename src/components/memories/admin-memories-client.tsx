"use client";

import * as React from "react";
import {
  Camera,
  Plus,
  Calendar,
  MapPin,
  Search,
  Trash2,
  Edit3,
  ShieldCheck,
  AlertTriangle,
  Images,
  Star,
  Download,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { SquadMemory, SquadMemoryPhoto, SwimSession } from "@/types/database";
import { MemoryUploadModal } from "./memory-upload-modal";
import { formatMemoryDateBadge } from "./squad-memories-viewer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdminMemoriesClientProps {
  initialMemories: SquadMemory[];
  sessions: SwimSession[];
  migrationNeeded: boolean;
}

export function AdminMemoriesClient({
  initialMemories,
  sessions,
  migrationNeeded,
}: AdminMemoriesClientProps) {
  const [memories, setMemories] = React.useState<SquadMemory[]>(initialMemories);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [uploadDefaultDate, setUploadDefaultDate] = React.useState<string | undefined>(undefined);
  const [editingMemory, setEditingMemory] = React.useState<SquadMemory | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editTitle, setEditTitle] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");
  const [editCaption, setEditCaption] = React.useState("");
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = React.useState<{
    memory: SquadMemory;
    photo: SquadMemoryPhoto;
  } | null>(null);

  const filteredMemories = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter(
      (m) =>
        m.memory_date.includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.location && m.location.toLowerCase().includes(q)) ||
        (m.caption && m.caption.toLowerCase().includes(q))
    );
  }, [memories, searchQuery]);

  const totalPhotos = React.useMemo(
    () => memories.reduce((sum, m) => sum + m.photos.length, 0),
    [memories]
  );

  function openEditModal(mem: SquadMemory) {
    setEditingMemory(mem);
    setEditDate(mem.memory_date);
    setEditTitle(mem.title);
    setEditLocation(mem.location || "");
    setEditCaption(mem.caption || "");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMemory) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/memories/${editingMemory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory_date: editDate,
          title: editTitle,
          location: editLocation,
          caption: editCaption,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        memory?: SquadMemory;
        error?: string;
      };
      if (!res.ok || !json.success || !json.memory) {
        toast.error(json.error || "Could not update memory.");
        return;
      }
      setMemories((prev) =>
        prev
          .map((m) => (m.id === json.memory!.id ? json.memory! : m))
          .sort((a, b) => b.memory_date.localeCompare(a.memory_date))
      );
      setEditingMemory(null);
      toast.success("Memory details updated!");
    } catch {
      toast.error("Failed to save memory details.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteDay(mem: SquadMemory) {
    if (
      !window.confirm(
        `Delete all ${mem.photos.length} photo${mem.photos.length === 1 ? "" : "s"} for ${mem.memory_date}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(mem.id);
    try {
      const res = await fetch(`/api/memories/${mem.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not delete memory day.");
        return;
      }
      setMemories((prev) => prev.filter((m) => m.id !== mem.id));
      toast.success(`Deleted memories for ${mem.memory_date}.`);
    } catch {
      toast.error("Failed to delete memory day.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePhoto(mem: SquadMemory, photo: SquadMemoryPhoto) {
    if (!window.confirm("Remove this photo from private storage?")) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(`/api/memories/${mem.id}?photoId=${encodeURIComponent(photo.id)}`, {
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
        setMemories((prev) => prev.filter((m) => m.id !== mem.id));
      } else {
        setMemories((prev) => prev.map((m) => (m.id === json.memory!.id ? json.memory! : m)));
      }
      if (previewPhoto?.photo.id === photo.id) setPreviewPhoto(null);
      toast.success("Photo removed.");
    } catch {
      toast.error("Failed to remove photo.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetCover(mem: SquadMemory, photo: SquadMemoryPhoto) {
    if (photo.slot === 1) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(`/api/memories/${mem.id}`, {
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
        toast.error(json.error || "Could not set cover photo.");
        return;
      }
      setMemories((prev) => prev.map((m) => (m.id === json.memory!.id ? json.memory! : m)));
      toast.success("Cover photo updated!");
    } catch {
      toast.error("Could not set cover photo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <Camera className="w-6 h-6 text-aqua" />
            <span>Squad Memories Vault</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Save 1 to 3 end-of-day photos per date — automatically visible on every swimmer&apos;s private portal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadDefaultDate(undefined);
            setShowUploadModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold text-xs shadow-lg shadow-aqua/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add End-of-Day Photos</span>
        </button>
      </div>

      {/* Migration Needed Callout (only shown if Supabase table hasn't been migrated yet) */}
      {migrationNeeded && (
        <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-foreground">
              One-Time Supabase SQL Setup Required
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Run{" "}
              <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-aqua">
                supabase/migrations/20260105000000_squad_memories.sql
              </code>{" "}
              in your Supabase SQL Editor to create the <code className="font-mono">squad_memories</code> tables and the private <code className="font-mono">squad-memories</code> storage bucket.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground">Memory Days</div>
          <div className="text-2xl font-black text-aqua font-mono mt-1">{memories.length}</div>
        </div>
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground">Photos Stored</div>
          <div className="text-2xl font-black text-foreground font-mono mt-1">{totalPhotos}</div>
        </div>
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground">Latest Date</div>
          <div className="text-sm font-black text-seafoam font-mono mt-2">
            {memories[0]?.memory_date || "—"}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-aqua/25 bg-aqua/5">
          <div className="text-[11px] font-semibold text-aqua flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Storage Privacy</span>
          </div>
          <div className="text-xs font-extrabold text-foreground mt-2">
            Private Bucket &bull; Signed URLs
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {memories.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by date (2026-11-21), title, or hangout spot..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-aqua/50"
          />
        </div>
      )}

      {/* Memories Feed */}
      {filteredMemories.length === 0 ? (
        <div className="p-10 rounded-3xl border border-dashed border-border bg-card/50 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-aqua/10 border border-aqua/30 text-aqua flex items-center justify-center mx-auto">
            <Images className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-foreground">
            {memories.length === 0 ? "Start Your Squad Photo Vault" : "No matching memory dates"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {memories.length === 0
              ? "Upload 1 to 3 photos from today's swim or post-swim hangout. Both Coach and PIN-verified swimmers can contribute up to 3 photos per date."
              : "Try a different date or keyword."}
          </p>
          {memories.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setUploadDefaultDate(undefined);
                setShowUploadModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold text-xs shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Upload Today&apos;s Photo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredMemories.map((mem) => {
            const badge = formatMemoryDateBadge(mem.memory_date);
            return (
              <div
                key={mem.id}
                className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col"
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 border-b border-border/80 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-aqua/15 border border-aqua/35 text-aqua text-[11px] font-black font-mono">
                        <Calendar className="w-3 h-3" />
                        <span>{badge.fullLabel}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-bold font-mono text-muted-foreground">
                        {mem.photos.length}/3 photos
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-foreground truncate">
                      {mem.title}
                    </h3>
                    {mem.location && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-coral shrink-0" />
                        <span className="truncate">{mem.location}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {mem.photos.length < 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadDefaultDate(mem.memory_date);
                          setShowUploadModal(true);
                        }}
                        title="Add more photos to this date"
                        className="p-2 rounded-xl bg-aqua/10 hover:bg-aqua/20 text-aqua border border-aqua/30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(mem)}
                      title="Edit memory details"
                      className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mem.id}
                      onClick={() => handleDeleteDay(mem)}
                      title="Delete memory day"
                      className="p-2 rounded-xl bg-coral/10 hover:bg-coral/20 text-coral border border-coral/30 transition-colors"
                    >
                      {busyId === mem.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Photos Grid (1–3) */}
                <div className="p-4 space-y-3 flex-1">
                  <div
                    className={cn(
                      "grid gap-2",
                      mem.photos.length === 1
                        ? "grid-cols-1"
                        : mem.photos.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                    )}
                  >
                    {mem.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative rounded-2xl border border-border/80 bg-ocean-950 overflow-hidden aspect-[4/3]"
                      >
                        {photo.signed_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.signed_url}
                            alt={photo.caption || mem.title}
                            loading="lazy"
                            onClick={() => setPreviewPhoto({ memory: mem, photo })}
                            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/75 text-[9px] font-bold font-mono text-white">
                            {photo.slot === 1 ? "★ Cover" : `#${photo.slot}`}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.slot !== 1 && (
                            <button
                              type="button"
                              disabled={busyId === photo.id}
                              onClick={() => handleSetCover(mem, photo)}
                              title="Make cover photo"
                              className="p-1.5 rounded-lg bg-black/75 text-amber-300 hover:bg-amber-400 hover:text-ocean-950 transition-colors"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <a
                            href={`/api/memories/photo/${photo.id}`}
                            download
                            title="Download photo"
                            className="p-1.5 rounded-lg bg-black/75 text-white hover:bg-aqua hover:text-ocean-950 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            disabled={busyId === photo.id}
                            onClick={() => handleDeletePhoto(mem, photo)}
                            title="Remove photo"
                            className="p-1.5 rounded-lg bg-black/75 text-coral hover:bg-coral hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[10px] text-white/80 truncate">
                          {photo.uploaded_by_role === "admin" ? "👑 " : "📸 "}
                          {photo.uploaded_by_name}
                        </div>
                      </div>
                    ))}
                  </div>

                  {mem.caption && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {mem.caption}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <MemoryUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        existingMemories={memories}
        sessions={sessions}
        defaultDate={uploadDefaultDate}
        onUploaded={(updatedMemory) => {
          setMemories((prev) => {
            const exists = prev.some((m) => m.id === updatedMemory.id);
            const next = exists
              ? prev.map((m) => (m.id === updatedMemory.id ? updatedMemory : m))
              : [updatedMemory, ...prev];
            return next.sort((a, b) => b.memory_date.localeCompare(a.memory_date));
          });
        }}
      />

      {/* Edit Metadata Modal */}
      {editingMemory && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isSavingEdit && setEditingMemory(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-extrabold text-foreground">Edit Memory Details</h3>
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">Memory Date</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">Title</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">Place / Hangout Spot</label>
                <input
                  type="text"
                  maxLength={140}
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">Caption / Story</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold inline-flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Lightbox Preview */}
      {previewPhoto && previewPhoto.photo.signed_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 gap-4"
          onClick={() => setPreviewPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewPhoto.photo.signed_url}
            alt={previewPhoto.memory.title}
            className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-center text-white space-y-1">
            <div className="text-sm font-extrabold">
              {previewPhoto.memory.title} &bull; {previewPhoto.memory.memory_date}
            </div>
            {previewPhoto.photo.caption && (
              <p className="text-xs text-white/80">{previewPhoto.photo.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
