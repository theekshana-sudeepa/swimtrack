"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Calendar,
  CalendarDays,
  Mail,
  BarChart3,
  Settings,
  Plus,
} from "lucide-react";
import { Swimmer, SwimSession } from "@/types/database";

interface CommandPaletteProps {
  swimmers?: Swimmer[];
  sessions?: SwimSession[];
}

export function CommandPalette({ swimmers = [], sessions = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const filteredSwimmers = swimmers.filter(
    (s) =>
      s.full_name.toLowerCase().includes(query.toLowerCase()) ||
      (s.nickname && s.nickname.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.date.includes(query)
  );

  function navigateTo(path: string) {
    router.push(path);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden text-foreground animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search swimmers, sessions, or pages... (Esc to close)"
            className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono font-semibold rounded border border-border bg-secondary text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-4 text-xs">
          {/* Quick Actions */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Navigation
            </div>
            <div className="space-y-0.5 mt-1">
              {[
                { title: "Attendance Command Center", href: "/attendance", icon: ClipboardCheck },
                { title: "All Swimmers Roster", href: "/swimmers", icon: Users },
                { title: "Calendar Agenda", href: "/calendar", icon: CalendarDays },
                { title: "Participation Analytics", href: "/analytics", icon: BarChart3 },
                { title: "Email Reminders", href: "/reminders", icon: Mail },
                { title: "Club Settings", href: "/settings", icon: Settings },
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <button
                    key={nav.href}
                    onClick={() => navigateTo(nav.href)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary transition-colors"
                  >
                    <Icon className="w-4 h-4 text-aqua" />
                    <span className="font-medium text-foreground">{nav.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Swimmers Match */}
          {filteredSwimmers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Swimmers ({filteredSwimmers.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredSwimmers.slice(0, 5).map((swimmer) => (
                  <button
                    key={swimmer.id}
                    onClick={() => navigateTo(`/swimmers/${swimmer.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-ocean-800 border border-aqua/30 text-aqua flex items-center justify-center font-bold text-[10px]">
                        {swimmer.nickname ? swimmer.nickname.slice(0, 2) : swimmer.full_name.slice(0, 2)}
                      </div>
                      <span className="font-semibold text-foreground">
                        {swimmer.full_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Profile &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sessions Match */}
          {filteredSessions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Sessions ({filteredSessions.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredSessions.slice(0, 4).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => navigateTo(`/sessions/${session.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-secondary transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{session.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {session.date} &bull; {session.start_time.slice(0, 5)}
                      </div>
                    </div>
                    <span className="text-[10px] text-aqua">Details &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
