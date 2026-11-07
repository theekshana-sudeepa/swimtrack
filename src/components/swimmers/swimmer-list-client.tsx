"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Download,
  Mail,
  Phone,
  Flame,
  Archive,
  RotateCcw,
  Edit2,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { Swimmer } from "@/types/database";
import { getSwimmerSquadRank } from "@/lib/squad-ranks";
import {
  createSwimmerAction,
  updateSwimmerAction,
  archiveSwimmerAction,
  restoreSwimmerAction,
} from "@/actions/swimmer-actions";
import { getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";

export function SwimmerListClient({ initialSwimmers }: { initialSwimmers: Swimmer[] }) {
  const [swimmers, setSwimmers] = React.useState<Swimmer[]>(initialSwimmers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"active" | "archived" | "all">("active");

  // Modal State
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingSwimmer, setEditingSwimmer] = React.useState<Swimmer | null>(null);

  React.useEffect(() => {
    setSwimmers(initialSwimmers);
  }, [initialSwimmers]);

  const filteredSwimmers = swimmers.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = s.full_name.toLowerCase().includes(q);
      const matchNick = s.nickname && s.nickname.toLowerCase().includes(q);
      const matchEmail = s.email && s.email.toLowerCase().includes(q);
      return matchName || matchNick || matchEmail;
    }
    return true;
  });

  // CSV Export
  function exportCSV() {
    const headers = ["Full Name", "Nickname", "Email", "Phone", "Status", "Join Date", "Attendance Rate %", "Sessions Attended", "Current Streak"];
    const rows = swimmers.map((s) => [
      `"${s.full_name}"`,
      `"${s.nickname || ""}"`,
      `"${s.email || ""}"`,
      `"${s.phone || ""}"`,
      s.status,
      s.join_date,
      s.attendance_stats?.rate || 0,
      (s.attendance_stats?.present || 0) + (s.attendance_stats?.late || 0),
      s.attendance_stats?.currentStreak || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `swimtrack_swimmers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Swimmers roster exported as CSV.");
  }

  // Handle Add Form
  async function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createSwimmerAction(formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Swimmer enrolled successfully!");
      setShowAddModal(false);
    }
  }

  // Handle Edit Form
  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSwimmer) return;
    const formData = new FormData(e.currentTarget);
    const res = await updateSwimmerAction(editingSwimmer.id, formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Swimmer profile updated!");
      setEditingSwimmer(null);
    }
  }

  // Handle Archive
  async function handleArchive(id: string) {
    if (confirm("Archive this swimmer? They will no longer appear on active session attendance registers.")) {
      await archiveSwimmerAction(id);
      toast.info("Swimmer moved to archive.");
    }
  }

  // Handle Restore
  async function handleRestore(id: string) {
    await restoreSwimmerAction(id);
    toast.success("Swimmer restored to active squad roster.");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Swimmer Roster
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your friends, attendance streaks, and email reminder consent preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Swimmer</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by full name, nickname, or email..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-border bg-secondary/40 text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              statusFilter === "active"
                ? "bg-ocean-900 text-aqua border border-aqua/30"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            Active ({swimmers.filter((s) => s.status === "active").length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              statusFilter === "archived"
                ? "bg-ocean-900 text-aqua border border-aqua/30"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            Archived ({swimmers.filter((s) => s.status === "archived").length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              statusFilter === "all"
                ? "bg-ocean-900 text-aqua border border-aqua/30"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            All ({swimmers.length})
          </button>
        </div>
      </div>

      {/* Swimmers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSwimmers.length > 0 ? (
          filteredSwimmers.map((swimmer) => {
            const stats = swimmer.attendance_stats;
            const isArchived = swimmer.status === "archived";
            const rank = getSwimmerSquadRank(stats);

            return (
              <div
                key={swimmer.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-150 bg-card flex flex-col justify-between shadow-sm relative group",
                  isArchived ? "opacity-60 border-dashed border-border" : "border-border hover:border-aqua/40"
                )}
              >
                <div>
                  {/* Top Swimmer Card Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-ocean-900 border border-aqua/30 text-aqua flex items-center justify-center font-extrabold text-base shadow-sm shrink-0">
                        {getInitials(swimmer.full_name)}
                      </div>
                      <div>
                        <Link
                          href={`/swimmers/${swimmer.id}`}
                          className="font-bold text-sm text-foreground hover:text-aqua transition-colors flex items-center gap-1.5"
                        >
                          <span>{swimmer.full_name}</span>
                          {swimmer.nickname && (
                            <span className="text-xs text-muted-foreground font-normal">
                              ({swimmer.nickname})
                            </span>
                          )}
                        </Link>
                        {/* Funny Squad Rank */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            title={rank.description}
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-help",
                              rank.colorScheme.pillBg
                            )}
                          >
                            <span>{rank.emoji}</span>
                            <span>{rank.title}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {stats && stats.currentStreak > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-coral/10 text-coral text-xs font-bold border border-coral/30">
                        <Flame className="w-3.5 h-3.5 fill-coral" />
                        <span>{stats.currentStreak}</span>
                      </div>
                    )}
                  </div>

                  {/* Funny Squad Description */}
                  <p className="mt-2.5 text-[11px] text-muted-foreground italic leading-relaxed">
                    &ldquo;{rank.description}&rdquo;
                  </p>

                  {/* Contact Info Pills */}
                  <div className="mt-3.5 space-y-1 text-xs text-muted-foreground">
                    {swimmer.email ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-aqua shrink-0" />
                        <span className="truncate">{swimmer.email}</span>
                        {swimmer.reminder_preferences?.email_reminders_enabled ? (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-seafoam/10 text-seafoam font-semibold">
                            Consented
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-secondary text-muted-foreground">
                            Opted out
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground/70 italic">
                        No email (Reminders inactive)
                      </div>
                    )}

                    {swimmer.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{swimmer.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Attendance Performance Metrics */}
                  <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-secondary/30">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold">
                        Rate
                      </div>
                      <div className="font-extrabold text-foreground mt-0.5">
                        {stats?.rate || 0}%
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-secondary/30">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold">
                        Attended
                      </div>
                      <div className="font-extrabold text-foreground mt-0.5">
                        {(stats?.present || 0) + (stats?.late || 0)}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-secondary/30">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold">
                        Max Streak
                      </div>
                      <div className="font-extrabold text-foreground mt-0.5">
                        {stats?.longestStreak || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <Link
                    href={`/swimmers/${swimmer.id}`}
                    className="text-aqua hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Full Profile</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingSwimmer(swimmer)}
                      title="Edit swimmer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {isArchived ? (
                      <button
                        type="button"
                        onClick={() => handleRestore(swimmer.id)}
                        title="Restore to active roster"
                        className="p-1.5 rounded-lg text-seafoam hover:bg-seafoam/10"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleArchive(swimmer.id)}
                        title="Archive swimmer"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-coral hover:bg-coral/10"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-border bg-card">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No swimmers found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Try adjusting your search query or filters.
            </p>
          </div>
        )}
      </div>

      {/* Add Swimmer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Add New Swimmer</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Full Name *
                </label>
                <input
                  name="full_name"
                  required
                  placeholder="e.g. Liam Perera"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Nickname (Optional)
                </label>
                <input
                  name="nickname"
                  placeholder="e.g. Liam"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Email Address (Optional)
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="e.g. liam@example.test"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Phone (Optional)
                </label>
                <input
                  name="phone"
                  placeholder="e.g. +94 77 123 4567"
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Distance lanes, preferred stroke..."
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="email_reminders_enabled"
                  name="email_reminders_enabled"
                  type="checkbox"
                  defaultChecked
                  className="rounded border-border text-aqua focus:ring-aqua"
                />
                <label htmlFor="email_reminders_enabled" className="text-muted-foreground">
                  Send email session reminders (Requires consent)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs"
                >
                  Save Swimmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Swimmer Modal */}
      {editingSwimmer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Edit Swimmer</h3>
              <button
                type="button"
                onClick={() => setEditingSwimmer(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Full Name *
                </label>
                <input
                  name="full_name"
                  required
                  defaultValue={editingSwimmer.full_name}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Nickname (Optional)
                </label>
                <input
                  name="nickname"
                  defaultValue={editingSwimmer.nickname || ""}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Email Address
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingSwimmer.email || ""}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Phone</label>
                <input
                  name="phone"
                  defaultValue={editingSwimmer.phone || ""}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingSwimmer.notes || ""}
                  className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="edit_email_reminders"
                  name="email_reminders_enabled"
                  type="checkbox"
                  defaultChecked={editingSwimmer.reminder_preferences?.email_reminders_enabled ?? false}
                  className="rounded border-border text-aqua focus:ring-aqua"
                />
                <label htmlFor="edit_email_reminders" className="text-muted-foreground">
                  Consent: Send email session reminders
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingSwimmer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

