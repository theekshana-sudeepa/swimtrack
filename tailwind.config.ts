import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1360px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // The Aquatic Control Room signature colors
        ocean: {
          950: "#040e17",
          900: "#071B2B", // Deep Ocean
          800: "#0b253b",
          700: "#102A3B", // Navy
          600: "#173b54",
          500: "#1f5072",
          400: "#2b6f9d",
          300: "#4496cc",
          200: "#86c2e7",
          100: "#cce6f6",
          50: "#eef6fc",
        },
        aqua: {
          DEFAULT: "#22C7D8",
          hover: "#18afbf",
          glow: "rgba(34, 199, 216, 0.25)",
          surface: "rgba(34, 199, 216, 0.08)",
        },
        seafoam: {
          DEFAULT: "#5BE6CD",
          hover: "#43cba2",
          glow: "rgba(91, 230, 205, 0.25)",
          surface: "rgba(91, 230, 205, 0.08)",
        },
        coral: {
          DEFAULT: "#FF907E",
          hover: "#f57460",
          glow: "rgba(255, 144, 126, 0.25)",
          surface: "rgba(255, 144, 126, 0.08)",
        },
        pool: {
          surface: "#F2FAFC",
          card: "#FFFFFF",
          border: "#D1EBF3",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "lane-pattern": "repeating-linear-gradient(90deg, transparent, transparent 39px, var(--lane-line) 39px, var(--lane-line) 40px)",
        "mesh-aquatic": "radial-gradient(at 0% 0%, rgba(34, 199, 216, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(91, 230, 205, 0.12) 0px, transparent 50%)",
      },
      keyframes: {
        "water-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        "lane-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "water-pulse": "water-pulse 4s ease-in-out infinite",
        "lane-flow": "lane-flow 12s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

