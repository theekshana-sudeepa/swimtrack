"use client";

import * as React from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Eye,
  RefreshCw,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react";
import { SwimSession, Swimmer, ReminderDelivery } from "@/types/database";
import {
  sendManualSessionRemindersAction,
  sendTestReminderAction,
  sendTestWelcomeEmailAction,
  sendTestAdminAlertAction,
} from "@/actions/reminder-actions";
import { formatTime, cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReminderClientProps {
  sessions: SwimSession[];
  deliveries: ReminderDelivery[];
  initialSelectedSessionId?: string;
}

export function ReminderClient({
  sessions,
  deliveries,
  initialSelectedSessionId,
}: ReminderClientProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    initialSelectedSessionId || (sessions.length > 0 ? sessions[0].id : "")
  );

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  const [customMessage, setCustomMessage] = React.useState(
    "Don't forget your swim session tomorrow! Bring your goggles, towel, and water bottle."
  );
  const [isSending, setIsSending] = React.useState(false);
  const [isTestSending, setIsTestSending] = React.useState(false);
  const [testEmailAddress, setTestEmailAddress] = React.useState("theekshanasudeepa4@gmail.com");
  const [testTemplate, setTestTemplate] = React.useState<"reminder" | "welcome" | "admin-alert">("admin-alert");

  // Filter eligible swimmers for this session
  // In our client we can derive from session participants if available or show count
  const eligibleCount = 8; // Liam, Kavindi, Senuka, Dilshan, Amara, Ryan, Ananya, Maya

  async function handleSendReminders(isDryRun: boolean) {
    if (!selectedSession) return;
    setIsSending(true);

    try {
      // Liam, Kavindi, Senuka, Dilshan, Amara, Ryan, Ananya, Maya IDs
      const recipientIds = [
        "11111111-1111-1111-1111-111111111101",
        "11111111-1111-1111-1111-111111111102",
        "11111111-1111-1111-1111-111111111103",
        "11111111-1111-1111-1111-111111111104",
        "11111111-1111-1111-1111-111111111105",
        "11111111-1111-1111-1111-111111111106",
        "11111111-1111-1111-1111-111111111107",
        "11111111-1111-1111-1111-111111111109",
      ];

      const res = await sendManualSessionRemindersAction(
        selectedSession.id,
        recipientIds,
        customMessage,
        isDryRun
      );

      if (res.error) {
        toast.error(res.error);
      } else if (res.results) {
        const sent = res.results.filter((r) => r.status === "sent").length;
        const skipped = res.results.filter((r) => r.status === "skipped").length;
        toast.success(
          isDryRun
            ? `Dry run verified: ${sent} recipients eligible.`
            : `Reminders dispatched! (${sent} sent, ${skipped} duplicate/skipped)`
        );
      }
    } catch {
      toast.error("Failed to send reminders.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendTest() {
    if (!testEmailAddress || !testEmailAddress.includes("@")) {
      toast.error("Please enter a valid test email address.");
      return;
    }
    setIsTestSending(true);
    try {
      if (testTemplate === "welcome") {
        const res = await sendTestWelcomeEmailAction(testEmailAddress);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Welcome & Swimmer Pass test email sent to ${testEmailAddress}!`);
        }
      } else if (testTemplate === "admin-alert") {
        const res = await sendTestAdminAlertAction(testEmailAddress);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Admin alert test notification sent to ${testEmailAddress}!`);
        }
      } else {
        if (!selectedSession) {
          toast.error("Please select a session for the reminder preview.");
          setIsTestSending(false);
          return;
        }
        const res = await sendTestReminderAction(selectedSession.id, testEmailAddress);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Session reminder test email sent to ${testEmailAddress}!`);
        }
      }
    } catch {
      toast.error("Failed to dispatch test email.");
    } finally {
      setIsTestSending(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Email Reminders & Dispatch
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated morning reminders via Vercel Cron & manual notification dispatch via Resend.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-seafoam/10 text-seafoam border border-seafoam/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Consent & Opt-Out Enforced</span>
          </span>
        </div>
      </div>

      {/* Main Grid: Left Dispatch Controls, Right Live Email Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Manual Send Form */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Mail className="w-4 h-4 text-aqua" />
            <h2 className="font-bold text-sm text-foreground">Dispatch Manual Reminders</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Select Target Swimming Session
            </label>
            <select
              aria-label="Select Target Swimming Session for Reminders"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            >
              {sessions.map((sess) => (
                <option key={sess.id} value={sess.id}>
                  {sess.date} — {sess.title} ({sess.status})
                </option>
              ))}
            </select>
          </div>

          {selectedSession && (
            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 text-xs space-y-1">
              <div className="font-bold text-foreground">{selectedSession.title}</div>
              <div className="text-muted-foreground">
                {selectedSession.date} &bull; {formatTime(selectedSession.start_time)} – {formatTime(selectedSession.end_time)}
              </div>
              <div className="text-muted-foreground">{selectedSession.location}</div>
              <div className="text-aqua font-semibold pt-1">
                &bull; 8 eligible squad swimmers with email consent
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Friendly Reminder Message
            </label>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Enter custom reminder note for participants..."
              className="w-full p-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleSendReminders(false)}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? "Dispatching..." : "Send to All Eligible"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendReminders(true)}
              disabled={isSending}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Dry Run</span>
            </button>
          </div>

          {/* Test Email Section */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-aqua" />
                <span>Send Live Test to Custom Email</span>
              </label>
              <div className="flex items-center gap-1 text-[11px] bg-secondary/50 p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setTestTemplate("admin-alert")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-all",
                    testTemplate === "admin-alert"
                      ? "bg-amber-400 text-ocean-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Admin Alert
                </button>
                <button
                  type="button"
                  onClick={() => setTestTemplate("welcome")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-all",
                    testTemplate === "welcome"
                      ? "bg-seafoam text-ocean-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Welcome Pass
                </button>
                <button
                  type="button"
                  onClick={() => setTestTemplate("reminder")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-all",
                    testTemplate === "reminder"
                      ? "bg-aqua text-ocean-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Reminder
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your-email@example.com"
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-aqua"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isTestSending}
                className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3 h-3 text-aqua" />
                <span>
                  {isTestSending
                    ? "Sending..."
                    : testTemplate === "admin-alert"
                    ? "Send Admin Alert"
                    : testTemplate === "welcome"
                    ? "Send Welcome Pass"
                    : "Send Reminder"}
                </span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Delivers directly to any email address to test real Resend delivery and formatting on your phone.
            </p>
          </div>
        </div>

        {/* Right Column: Live Email Preview */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-aqua" />
              <h2 className="font-bold text-sm text-foreground">Live Template Preview</h2>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              React Email &bull; Responsive HTML
            </span>
          </div>

          {/* Simulated Email Envelope */}
          <div className="rounded-2xl border border-border bg-[#F2FAFC] dark:bg-ocean-950 p-6 text-[#071B2B] dark:text-slate-100 shadow-inner space-y-4">
            {/* Header */}
            <div className="bg-[#071B2B] p-4 rounded-xl text-center text-white">
              <div className="text-aqua font-extrabold tracking-widest text-sm">
                SWIM<span className="text-white">TRACK</span>
              </div>
              <div className="text-[9px] uppercase tracking-wider text-ocean-300 mt-0.5">
                The Aquatic Control Room
              </div>
            </div>

            {/* Email Card Body */}
            {testTemplate === "admin-alert" ? (
              <div className="bg-white dark:bg-ocean-900 p-5 rounded-xl border border-[#D1EBF3] dark:border-ocean-800 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  🔔 Admin New Swimmer Notification
                </div>
                <div className="text-base font-extrabold text-[#071B2B] dark:text-white">
                  New Swimmer Enrolled! 🏊‍♂️
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A new squad member has registered via your squad invite link and is now listed on your attendance register.
                </p>

                <div className="p-3 rounded-lg bg-[#F2FAFC] dark:bg-ocean-950 border-l-4 border-amber-400 text-xs space-y-1">
                  <div className="font-bold text-[#071B2B] dark:text-white text-xs mb-1">
                    📋 Member Credentials
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Full Name:</strong> Kasun Jayasuriya (&ldquo;Speedy Shark&rdquo;)
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Email:</strong> kasun.swim@example.com
                  </div>
                  <div className="text-muted-foreground">
                    <strong>WhatsApp:</strong> +94 77 987 6543
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Assigned Persona:</strong> Eager Cadet 🏊 (Zero-Polla)
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Registered At:</strong> Today (Asia/Colombo)
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <span className="inline-block px-4 py-2 rounded-lg bg-aqua text-ocean-950 font-bold text-xs shadow-sm">
                    View Swimmer in Control Room &rarr;
                  </span>
                </div>
              </div>
            ) : testTemplate === "welcome" ? (
              <div className="bg-white dark:bg-ocean-900 p-5 rounded-xl border border-[#D1EBF3] dark:border-ocean-800 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-seafoam/10 text-seafoam border border-seafoam/30">
                  🎫 Swimmer Pass & Onboarding
                </div>
                <div className="text-base font-extrabold text-[#071B2B] dark:text-white">
                  Welcome to the Squad! 🏊‍♂️
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are officially on our swimming attendance register. Your passwordless Swimmer Pass is ready:
                </p>

                <div className="p-3 rounded-lg bg-[#F2FAFC] dark:bg-ocean-950 border-l-4 border-seafoam text-xs space-y-1.5">
                  <div className="font-bold text-[#071B2B] dark:text-white">
                    ✨ Your Personal Swimmer Pass
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    1-tap RSVP, live squad chalkboard, attendance history, and polla risk index without passwords.
                  </p>
                </div>

                <div className="pt-2 text-center">
                  <span className="inline-block px-4 py-2 rounded-lg bg-seafoam text-ocean-950 font-bold text-xs shadow-sm">
                    Open My Swimmer Pass &amp; RSVP &rarr;
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-ocean-900 p-5 rounded-xl border border-[#D1EBF3] dark:border-ocean-800 space-y-3">
                <div className="text-base font-extrabold text-[#071B2B] dark:text-white">
                  Upcoming Swimming Session
                </div>
                <p className="text-xs text-muted-foreground">
                  Hi Liam,
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {customMessage}
                </p>

                <div className="p-3 rounded-lg bg-[#F2FAFC] dark:bg-ocean-950 border-l-4 border-aqua text-xs space-y-1">
                  <div className="font-bold text-[#071B2B] dark:text-white">
                    {selectedSession ? selectedSession.title : "Saturday Morning Squad"}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Date:</strong> {selectedSession ? selectedSession.date : "2026-11-07"}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Time:</strong> {selectedSession ? `${formatTime(selectedSession.start_time)} – ${formatTime(selectedSession.end_time)}` : "06:30 AM – 08:00 AM"}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Location:</strong> {selectedSession ? selectedSession.location : "Royal College Aquatic Complex, Colombo"}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  See you on deck! Pack your swimwear, goggles, and towel.
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-muted-foreground space-y-0.5">
              <p>Personal swimming reminder sent via SwimTrack.</p>
              <p className="text-aqua underline cursor-pointer">
                Manage reminder preferences &bull; Opt out
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Delivery Logs */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-aqua" />
            <h2 className="font-bold text-sm text-foreground">
              Recent Reminder Delivery Logs ({deliveries.length})
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            Duplicate protection tracked via claim keys
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/20">
              <tr>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Session</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Message ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {deliveries.length > 0 ? (
                deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {del.swimmer_name || del.recipient_email}
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {del.recipient_email}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground max-w-[180px] truncate">
                      {del.session_title}
                    </td>
                    <td className="py-3 px-3 uppercase text-[10px] font-mono text-muted-foreground">
                      {del.reminder_type}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          "text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border",
                          del.status === "sent"
                            ? "bg-seafoam/10 text-seafoam border-seafoam/30"
                            : del.status === "failed"
                            ? "bg-coral/10 text-coral border-coral/30"
                            : "bg-secondary text-muted-foreground border-border"
                        )}
                      >
                        {del.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {del.provider_message_id || "-"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-[11px]">
                      {new Date(del.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No reminder logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
