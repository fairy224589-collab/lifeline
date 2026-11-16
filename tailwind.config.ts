import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Primary brand: deep burgundy */
        blood: {
          DEFAULT: "#7A1F2B",
          light: "#93283A",
          dark: "#5E1822",
          50: "rgba(122, 31, 43, 0.05)",
          10: "rgba(122, 31, 43, 0.10)",
        },
        /* Restrained medical red — ONLY for urgent / critical actions */
        emergency: {
          DEFAULT: "#B42318",
          dark: "#912018",
          soft: "#FEF3F2",
        },
        /* Charcoal text, with warm-grey tints */
        ink: {
          DEFAULT: "#1C1917",
          60: "rgba(28, 25, 23, 0.68)",
          50: "rgba(28, 25, 23, 0.58)",
          40: "rgba(28, 25, 23, 0.50)",
          20: "rgba(28, 25, 23, 0.16)",
          10: "rgba(28, 25, 23, 0.10)",
          5: "rgba(28, 25, 23, 0.04)",
        },
        /* Warm ivory page background and slightly deeper ivory for panels */
        clay: {
          DEFAULT: "#FAF7F2",
          deep: "#F3EEE6",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,0.04), 0 4px 16px rgba(28,25,23,0.04)",
        lift: "0 2px 4px rgba(28,25,23,0.04), 0 12px 32px rgba(28,25,23,0.08)",
      },
      animation: {
        "fade-slide-up": "fadeSlideUp 0.4s ease-out both",
        "fade-in": "fadeIn 0.35s ease-out both",
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
