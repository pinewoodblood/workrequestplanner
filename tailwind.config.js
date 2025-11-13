import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grundfarben
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 47.4% 11.2%)",
        // Karten, Panels
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(222.2 47.4% 11.2%)",
        // Popovers, Tooltips
        popover: "hsl(0 0% 100%)",
        "popover-foreground": "hsl(222.2 47.4% 11.2%)",
        // DKB-Primärfarbe – kräftiges, seriöses Blau
        primary: "hsl(210 80% 45%)",
        "primary-foreground": "hsl(0 0% 100%)",
        // Sekundär: helles Grau-Blau für UI-Flächen
        secondary: "hsl(210 40% 96%)",
        "secondary-foreground": "hsl(222.2 47.4% 11.2%)",
        // Akzent: leichtes Hellblau für Hover-States
        accent: "hsl(210 70% 94%)",
        "accent-foreground": "hsl(222.2 47.4% 11.2%)",
        // Muted: dezente Hintergründe
        muted: "hsl(210 40% 97%)",
        "muted-foreground": "hsl(215 16% 46%)",
        // Destructive: Fehler oder Warnungen
        destructive: "hsl(0 84% 60%)",
        "destructive-foreground": "hsl(0 0% 98%)",
        // Ringe, Rahmen, Inputs
        border: "hsl(214 31% 91%)",
        input: "hsl(214 31% 91%)",
        ring: "hsl(210 80% 45%)",
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0,0,0,0.04)",
        medium: "0 2px 6px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), // für deine shadcn/ui-Komponenten
  ],
} satisfies Config;
