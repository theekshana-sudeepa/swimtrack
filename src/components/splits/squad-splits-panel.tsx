"use client";

import * as React from "react";
import {
  Wallet,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Coffee,
  Waves,
  Car,
  ShoppingBag,
  Receipt,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  SquadExpense,
  Swimmer,
  SwimSession,
  ExpenseCategory,
} from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; emoji: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pool_tickets: { label: "Pool Tickets", emoji: "🏊", icon: Waves },
  cafe_food: { label: "Cafe & Food", emoji: "☕", icon: Coffee },
  transport: { label: "Transport", emoji: "🚗", icon: Car },
  gear: { label: "Swim Gear", emoji: "🥽", icon: ShoppingBag },
  other: { label: "Other", emoji: "🧾", icon: Receipt },
};

function formatCurrency(amount: number, currency = "LKR"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safe * 100) % 100 !== 0;
  return `${currency} ${safe.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

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

interface SquadSplitsPanelProps {
  initialExpenses: SquadExpense[];
  swimmers: Swimmer[];
  sessions?: SwimSession[];
  /** Map of YYYY-MM-DD -> swimmer IDs who attended that day (for 1-tap auto-select) */
  attendeesByDate?: Record<string, string[]>;
  isAdmin?: boolean;
  currentSwimmer?: Swimmer | null;
  swimmerToken?: string | null;
  defaultDate?: string;
  onExpensesChange?: (expenses: SquadExpense[]) => void;
}

export function SquadSplitsPanel({
  initialExpenses,
  swimmers,
  sessions = [],
  attendeesByDate = {},
  isAdmin = false,
  currentSwimmer = null,
  swimmerToken = null,
  defaultDate,
  onExpensesChange,
}: SquadSplitsPanelProps) {
  const [expenses, setExpenses] = React.useState<SquadExpense[]>(initialExpenses);
  const [filterMode, setFilterMode] = React.useState<"all" | "open" | "settled">("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(
    initialExpenses[0]?.id || null
  );
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  // Create form state
  const [expenseDate, setExpenseDate] = React.useState(defaultDate || getTodayColomboDate());
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("cafe_food");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [paidBySwimmerId, setPaidBySwimmerId] = React.useState<string>(
    currentSwimmer?.id || "coach"
  );
  const [notes, setNotes] = React.useState("");
  const [splitMode, setSplitMode] = React.useState<"even" | "custom">("even");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = React.useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const activeSwimmers = React.useMemo(
    () => swimmers.filter((s) => s.status === "active"),
    [swimmers]
  );

  function syncExpenses(updater: (prev: SquadExpense[]) => SquadExpense[]) {
    setExpenses((prev) => {
      const next = updater(prev);
      onExpensesChange?.(next);
      return next;
    });
  }

  function openCreateModal() {
    const dt = defaultDate || getTodayColomboDate();
    setExpenseDate(dt);
    setTitle("");
    setCategory("cafe_food");
    setTotalAmount("");
    setNotes("");
    setSplitMode("even");
    setPaidBySwimmerId(currentSwimmer?.id || "coach");
    const dayAttendees = attendeesByDate[dt];
    if (dayAttendees && dayAttendees.length > 0) {
      setSelectedIds(dayAttendees);
    } else {
      setSelectedIds(activeSwimmers.map((s) => s.id));
    }
    setCustomAmounts({});
    setShowCreateModal(true);
  }

  function handleDateChangeInModal(nextDate: string) {
    setExpenseDate(nextDate);
    const dayAttendees = attendeesByDate[nextDate];
    if (dayAttendees && dayAttendees.length > 0) {
      setSelectedIds(dayAttendees);
    }
  }

  function toggleParticipant(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const parsedTotal = Number(totalAmount);
  const perPersonPreview =
    splitMode === "even" && Number.isFinite(parsedTotal) && parsedTotal > 0 && selectedIds.length > 0
      ? parsedTotal / selectedIds.length
      : 0;

  const customSumPreview = React.useMemo(() => {
    if (splitMode !== "custom") return 0;
    return selectedIds.reduce((sum, id) => {
      const v = Number(customAmounts[id] || 0);
      return sum + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }, [splitMode, selectedIds, customAmounts]);

  async function handleCreateSplit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast.error("Select at least 1 squad member to split this bill.");
      return;
    }
    const finalTotal = splitMode === "custom" ? customSumPreview : parsedTotal;
    if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
      toast.error("Please enter a valid total amount in LKR.");
      return;
    }

    setIsCreating(true);
    try {
      const matchedSession = sessions.find((s) => s.date === expenseDate);
      const participants = selectedIds.map((id) => ({
        swimmer_id: id,
        custom_amount: splitMode === "custom" ? Number(customAmounts[id] || 0) : null,
      }));

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: expenseDate,
          title: title.trim() || `${CATEGORY_META[category].label} Split`,
          category,
          currency: "LKR",
          total_amount: finalTotal,
          paid_by_swimmer_id: paidBySwimmerId === "coach" ? null : paidBySwimmerId,
          paid_by_name: paidBySwimmerId === "coach" ? "Squad Coach" : undefined,
          session_id: matchedSession?.id || null,
          notes: notes.trim() || null,
          participants,
          swimmer_token: swimmerToken || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        expense?: SquadExpense;
        error?: string;
      };
      if (!res.ok || !json.success || !json.expense) {
        toast.error(json.error || "Could not create bill split.");
        return;
      }

      syncExpenses((prev) => [json.expense!, ...prev]);
      setExpandedId(json.expense.id);
      setShowCreateModal(false);
      toast.success("After-swim bill split added!");
    } catch {
      toast.error("Network error while saving bill split.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleTogglePaid(
    expense: SquadExpense,
    swimmerId: string,
    nextPaid: boolean
  ) {
    const key = `${expense.id}:${swimmerId}`;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swimmer_id: swimmerId,
          is_paid: nextPaid,
          swimmer_token: swimmerToken || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        expense?: SquadExpense;
        error?: string;
      };
      if (!res.ok || !json.success || !json.expense) {
        toast.error(json.error || "Could not update payment status.");
        return;
      }
      syncExpenses((prev) => prev.map((e) => (e.id === json.expense!.id ? json.expense! : e)));
      toast.success(nextPaid ? "Marked as Paid!" : "Marked back as Pending.");
    } catch {
      toast.error("Failed to update payment status.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteExpense(expense: SquadExpense) {
    if (!window.confirm(`Delete "${expense.title}" (${formatCurrency(expense.total_amount, expense.currency)})?`)) {
      return;
    }
    setBusyKey(expense.id);
    try {
      const query = swimmerToken ? `?token=${encodeURIComponent(swimmerToken)}` : "";
      const res = await fetch(`/api/expenses/${expense.id}${query}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not delete bill split.");
        return;
      }
      syncExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      toast.success("Bill split deleted.");
    } catch {
      toast.error("Failed to delete bill split.");
    } finally {
      setBusyKey(null);
    }
  }

  // Personal balance summary for logged-in swimmer
  const personalSummary = React.useMemo(() => {
    if (!currentSwimmer) return null;
    let iOwe = 0;
    let iOweCount = 0;
    let owedToMe = 0;
    let owedToMeCount = 0;
    const owedToNames = new Set<string>();

    for (const exp of expenses) {
      for (const sh of exp.shares) {
        if (sh.is_paid) continue;
        if (sh.swimmer_id === currentSwimmer.id && exp.paid_by_swimmer_id !== currentSwimmer.id) {
          iOwe += sh.share_amount;
          iOweCount++;
          owedToNames.add(exp.paid_by_name);
        } else if (
          exp.paid_by_swimmer_id === currentSwimmer.id &&
          sh.swimmer_id !== currentSwimmer.id
        ) {
          owedToMe += sh.share_amount;
          owedToMeCount++;
        }
      }
    }
    return {
      iOwe: Number(iOwe.toFixed(2)),
      iOweCount,
      owedToMe: Number(owedToMe.toFixed(2)),
      owedToMeCount,
      owedToNames: Array.from(owedToNames),
    };
  }, [expenses, currentSwimmer]);

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter((exp) => {
      const allPaid = exp.shares.length > 0 && exp.shares.every((s) => s.is_paid);
      if (filterMode === "open") return !allPaid;
      if (filterMode === "settled") return allPaid;
      return true;
    });
  }, [expenses, filterMode]);

  return (
    <>
      <section
        id="squad-splits"
        className="scroll-mt-20 p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground leading-tight">
                Squad Kitty &amp; After-Swim Splits 💸
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Pool entry tickets, Barista coffee &amp; group bills split cleanly in LKR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {expenses.length > 0 && (
              <div className="inline-flex rounded-xl border border-border bg-secondary/40 p-0.5 text-[10px] font-bold">
                {(["all", "open", "settled"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterMode(tab)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg capitalize transition-colors",
                      filterMode === tab
                        ? "bg-card text-aqua shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-[11px] font-extrabold shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Split</span>
            </button>
          </div>
        </div>

        {/* Personal Balance Strip (Swimmer Portal) */}
        {personalSummary && expenses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {personalSummary.iOwe > 0 ? (
              <div className="p-3.5 rounded-2xl bg-coral/10 border border-coral/30 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-coral">
                    Pending To Pay
                  </div>
                  <div className="text-base font-black font-mono text-foreground mt-0.5">
                    {formatCurrency(personalSummary.iOwe)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    To {personalSummary.owedToNames.join(", ")} ({personalSummary.iOweCount} split
                    {personalSummary.iOweCount === 1 ? "" : "s"})
                  </div>
                </div>
                <Clock className="w-5 h-5 text-coral shrink-0" />
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-seafoam/10 border border-seafoam/30 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-seafoam">
                    Your Tab
                  </div>
                  <div className="text-xs font-extrabold text-foreground mt-0.5">
                    All settled up! Zero pending bills
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-seafoam shrink-0" />
              </div>
            )}

            {personalSummary.owedToMe > 0 && (
              <div className="p-3.5 rounded-2xl bg-aqua/10 border border-aqua/30 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-aqua">
                    Friends Owe You
                  </div>
                  <div className="text-base font-black font-mono text-aqua mt-0.5">
                    {formatCurrency(personalSummary.owedToMe)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {personalSummary.owedToMeCount} unpaid share
                    {personalSummary.owedToMeCount === 1 ? "" : "s"} &bull; tap names below to mark paid
                  </div>
                </div>
                <Sparkles className="w-5 h-5 text-aqua shrink-0" />
              </div>
            )}
          </div>
        )}

        {/* Splits List */}
        {filteredExpenses.length === 0 ? (
          <div className="py-7 px-4 rounded-2xl border border-dashed border-border bg-secondary/20 text-center space-y-2.5">
            <p className="text-xs font-bold text-foreground">
              {expenses.length === 0
                ? "No pool ticket or coffee splits logged yet"
                : `No ${filterMode} bill splits right now`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Split lane tickets or post-swim coffee in 10 seconds — SwimTrack auto-selects who attended and tracks who&apos;s paid.
            </p>
            {expenses.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log First After-Swim Split</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredExpenses.map((exp) => {
              const cat = CATEGORY_META[exp.category] || CATEGORY_META.other;
              const paidCount = exp.shares.filter((s) => s.is_paid).length;
              const totalShares = exp.shares.length;
              const isSettled = totalShares > 0 && paidCount === totalShares;
              const isExpanded = expandedId === exp.id;
              const canManage =
                isAdmin ||
                Boolean(
                  currentSwimmer &&
                    exp.paid_by_swimmer_id &&
                    exp.paid_by_swimmer_id === currentSwimmer.id
                );
              const myShare = currentSwimmer
                ? exp.shares.find((s) => s.swimmer_id === currentSwimmer.id)
                : null;

              return (
                <div
                  key={exp.id}
                  className={cn(
                    "rounded-2xl border transition-all overflow-hidden",
                    isSettled
                      ? "bg-secondary/20 border-border/70"
                      : myShare && !myShare.is_paid
                      ? "bg-coral/5 border-coral/35"
                      : "bg-secondary/30 border-border"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                    className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-base shrink-0">
                        {cat.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                            {exp.title}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                              isSettled
                                ? "bg-seafoam/15 text-seafoam border-seafoam/30"
                                : "bg-amber-400/15 text-amber-300 border-amber-400/30"
                            )}
                          >
                            {isSettled ? "Settled ✓" : `${paidCount}/${totalShares} Paid`}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono">{exp.expense_date}</span>
                          <span>&bull;</span>
                          <span>
                            Paid by <strong className="text-foreground">{exp.paid_by_name}</strong>
                          </span>
                          {myShare && (
                            <>
                              <span>&bull;</span>
                              <span
                                className={cn(
                                  "font-bold font-mono",
                                  myShare.is_paid ? "text-seafoam" : "text-coral"
                                )}
                              >
                                Your share: {formatCurrency(myShare.share_amount, exp.currency)}{" "}
                                {myShare.is_paid ? "(Paid)" : "(Pending)"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-black font-mono text-aqua">
                          {formatCurrency(exp.total_amount, exp.currency)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {totalShares} {totalShares === 1 ? "person" : "people"}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-aqua" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 sm:px-4 pb-4 pt-3 border-t border-border/70 bg-background/40 space-y-3">
                      {exp.notes && (
                        <p className="text-[11px] text-muted-foreground italic">{exp.notes}</p>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>
                          Split Breakdown {canManage ? "(Tap any swimmer to toggle Paid)" : ""}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            disabled={busyKey === exp.id}
                            onClick={() => handleDeleteExpense(exp)}
                            className="inline-flex items-center gap-1 text-coral hover:underline normal-case font-semibold"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Split</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {exp.shares.map((sh) => {
                          const shareBusy = busyKey === `${exp.id}:${sh.swimmer_id}`;
                          const isMe = currentSwimmer?.id === sh.swimmer_id;
                          return (
                            <button
                              key={sh.id}
                              type="button"
                              disabled={!canManage || shareBusy}
                              onClick={() =>
                                canManage && handleTogglePaid(exp, sh.swimmer_id, !sh.is_paid)
                              }
                              className={cn(
                                "p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs transition-all",
                                sh.is_paid
                                  ? "bg-seafoam/10 border-seafoam/30 text-foreground"
                                  : "bg-secondary/40 border-border text-foreground",
                                canManage && "hover:border-aqua/50 cursor-pointer active:scale-[0.99]",
                                !canManage && "cursor-default"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="font-bold truncate flex items-center gap-1.5">
                                  <span>{sh.swimmer_name}</span>
                                  {isMe && (
                                    <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-aqua/20 text-aqua">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {formatCurrency(sh.share_amount, exp.currency)}
                                </div>
                              </div>

                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold shrink-0",
                                  sh.is_paid
                                    ? "bg-seafoam/20 text-seafoam"
                                    : "bg-coral/15 text-coral"
                                )}
                              >
                                {shareBusy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : sh.is_paid ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                <span>{sh.is_paid ? "Paid" : "Pending"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create Bill Split Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => !isCreating && setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-400/15 border border-amber-400/35 text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    New After-Swim Bill Split
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Pool tickets, coffee, or snacks split cleanly across the squad
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSplit} className="space-y-4 text-xs">
              {/* Category Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((catKey) => {
                    const meta = CATEGORY_META[catKey];
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setCategory(catKey)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all",
                          category === catKey
                            ? "bg-aqua/15 border-aqua/50 text-aqua"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {meta.emoji} {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-aqua" />
                    <span>Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => handleDateChangeInModal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Total Bill (LKR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required={splitMode === "even"}
                    disabled={splitMode === "custom"}
                    value={splitMode === "custom" ? String(customSumPreview) : totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="e.g. 7500"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground font-mono font-bold disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">
                    Bill Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Barista Coffee + Pool Entry"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                  />
                </div>

                {isAdmin && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Paid Upfront By
                    </label>
                    <select
                      value={paidBySwimmerId}
                      onChange={(e) => setPaidBySwimmerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                    >
                      <option value="coach">Squad Coach</option>
                      {activeSwimmers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nickname ? `${s.full_name} ("${s.nickname}")` : s.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Split Participants */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-aqua" />
                    <span>Split Between ({selectedIds.length} selected)</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {attendeesByDate[expenseDate]?.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedIds(attendeesByDate[expenseDate])}
                        className="px-2 py-0.5 rounded-lg bg-seafoam/15 text-seafoam border border-seafoam/30 font-bold"
                      >
                        Today&apos;s Swimmers ({attendeesByDate[expenseDate].length})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedIds(activeSwimmers.map((s) => s.id))}
                      className="px-2 py-0.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground font-bold"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode(splitMode === "even" ? "custom" : "even")}
                      className="px-2 py-0.5 rounded-lg bg-aqua/10 text-aqua border border-aqua/30 font-bold"
                    >
                      {splitMode === "even" ? "Custom Amounts" : "Split Evenly"}
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {activeSwimmers.map((sw) => {
                    const checked = selectedIds.includes(sw.id);
                    const name = sw.nickname?.trim() || sw.full_name;
                    return (
                      <div
                        key={sw.id}
                        className={cn(
                          "px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-colors",
                          checked
                            ? "bg-aqua/10 border-aqua/40"
                            : "bg-secondary/25 border-border/70 opacity-75"
                        )}
                      >
                        <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant(sw.id)}
                            className="rounded border-border accent-aqua"
                          />
                          <span className="font-bold text-foreground truncate">{name}</span>
                        </label>

                        {checked && splitMode === "even" && perPersonPreview > 0 && (
                          <span className="text-[11px] font-mono font-bold text-aqua shrink-0">
                            {formatCurrency(perPersonPreview)}
                          </span>
                        )}

                        {checked && splitMode === "custom" && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customAmounts[sw.id] || ""}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [sw.id]: e.target.value }))
                            }
                            placeholder="LKR"
                            className="w-24 px-2 py-1 rounded-lg border border-border bg-background text-right font-mono text-[11px]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">
                  Notes (optional — e.g. Bank/Frimi details)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Transfer via FriMi / Bank or pay cash next Saturday"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || selectedIds.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-extrabold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                >
                  {isCreating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wallet className="w-3.5 h-3.5" />
                  )}
                  <span>Save Bill Split</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
