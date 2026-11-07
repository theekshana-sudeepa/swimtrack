"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  Lock,
  Plus,
} from "lucide-react";
import { SwimSession } from "@/types/database";
import { formatTime, cn } from "@/lib/utils";

export function CalendarClient({ initialSessions }: { initialSessions: SwimSession[] }) {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date("2026-11-01"));
  const [viewMode, setViewMode] = React.useState<"month" | "week">("month");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  // Calculate calendar days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthName = currentDate.toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Session Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Squad agenda and session timetable (Asia/Colombo).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-foreground px-2 min-w-[120px] text-center">
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            href="/sessions"
            className="px-3.5 py-2 rounded-xl bg-aqua text-ocean-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </Link>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4 rounded-3xl border border-border bg-card shadow-sm">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 gap-2 pb-3 mb-2 border-b border-border text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[100px] p-2 rounded-xl bg-secondary/10 border border-transparent"
                />
              );
            }

            const dayDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const daySessions = initialSessions.filter((s) => s.date === dayDateStr);

            return (
              <div
                key={`day-${day}`}
                className={cn(
                  "min-h-[100px] p-2 rounded-2xl border transition-colors flex flex-col justify-between",
                  daySessions.length > 0
                    ? "border-aqua/30 bg-secondary/30"
                    : "border-border/50 bg-secondary/10 hover:border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{day}</span>
                  {daySessions.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-aqua" />
                  )}
                </div>

                <div className="mt-1 space-y-1 overflow-y-auto">
                  {daySessions.map((sess) => (
                    <Link
                      key={sess.id}
                      href={`/sessions/${sess.id}`}
                      className={cn(
                        "block p-1.5 rounded-lg text-[10px] font-semibold truncate transition-colors leading-tight",
                        sess.status === "scheduled"
                          ? "bg-seafoam/20 text-seafoam hover:bg-seafoam/30"
                          : sess.status === "completed"
                          ? "bg-ocean-900 text-aqua hover:bg-ocean-800"
                          : "bg-coral/20 text-coral hover:bg-coral/30"
                      )}
                    >
                      <div className="truncate font-bold">{sess.title}</div>
                      <div className="text-[9px] opacity-80">
                        {formatTime(sess.start_time)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

