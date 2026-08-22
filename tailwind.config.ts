import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        panel: "var(--panel)",
        line: "var(--line)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        amber: "var(--amber)",
        coral: "var(--coral)"
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent)"
      }
    }
  },
  plugins: []
};

export default config;
