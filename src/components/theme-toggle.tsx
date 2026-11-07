"use client";

import * as React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center p-1 rounded-xl bg-secondary/80 border border-border/80 text-muted-foreground",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Aquatic Dark theme"
        className={cn(
          "p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center",
          theme === "dark"
            ? "bg-ocean-900 text-aqua shadow-sm border border-aqua/30"
            : "hover:text-foreground"
        )}
      >
        <Moon className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Light pool theme"
        className={cn(
          "p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center",
          theme === "light"
            ? "bg-white text-ocean-900 shadow-sm border border-border"
            : "hover:text-foreground"
        )}
      >
        <Sun className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="System preference"
        className={cn(
          "p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center",
          theme === "system"
            ? "bg-card text-foreground shadow-sm border border-border"
            : "hover:text-foreground"
        )}
      >
        <Laptop className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
