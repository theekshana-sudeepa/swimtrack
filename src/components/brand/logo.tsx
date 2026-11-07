import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SwimTrackSymbol({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      {/* Background aquatic disc */}
      <rect width="40" height="40" rx="10" fill="#071B2B" />
      
      {/* Subtle lane track lines */}
      <line x1="6" y1="12" x2="34" y2="12" stroke="#173b54" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="6" y1="28" x2="34" y2="28" stroke="#173b54" strokeWidth="1" strokeDasharray="2 2" />
      
      {/* Dynamic Aquatic Wave Streamlines */}
      <path
        d="M8 24C12 21 16 27 20 24C24 21 28 27 32 24"
        stroke="#5BE6CD"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 17C12 14 16 20 20 17C24 14 28 20 32 17"
        stroke="#22C7D8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Swimmer Head / Precision Focal Dot */}
      <circle cx="28" cy="11" r="3" fill="#FF907E" />
    </svg>
  );
}

export function SwimTrackLogo({
  className,
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const pixelSize = size === "sm" ? 24 : size === "lg" ? 40 : 32;

  return (
    <div className={cn("inline-flex items-center gap-2.5 font-bold tracking-tight select-none", className)}>
      <SwimTrackSymbol size={pixelSize} />
      {showWordmark && (
        <div className="flex flex-col">
          <span className="text-foreground tracking-wider font-extrabold flex items-center leading-none text-base">
            SWIM<span className="text-aqua">TRACK</span>
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-tight mt-0.5">
            Control Room
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 group transition-transform duration-150 active:scale-95"
    >
      <SwimTrackLogo />
    </Link>
  );
}
