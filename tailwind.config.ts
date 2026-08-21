import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201a",
        paper: "#f7f8f3",
        panel: "#ffffff",
        line: "#dce2d7",
        accent: "#236b5b",
        amber: "#b7791f",
        coral: "#c45640"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 32, 26, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
