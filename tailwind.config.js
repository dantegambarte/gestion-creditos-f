/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        ff: {
          bg: "#0F1117",
          panel: "#1A1D27",
          secondary: "#22263A",
          border: "#2E3347",
          accent: "#4F6EF7",
          mint: "#6EE7B7",
          sidebar: "#0A0C14",
          danger: "#F87171",
          warning: "#FBB040",
          success: "#34D399",
          "text-primary": "#F1F5F9",
          "text-secondary": "#8B97B8",
          "text-muted": "#4A5278",
        },
      },
      fontFamily: {
        ui: ["Inter", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
