/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Headings reuse the same family (bold) — mockup has no serif.
        sans: ['"IBM Plex Sans Thai"', "Segoe UI", "system-ui", "Sarabun", "sans-serif"],
        serif: ['"IBM Plex Sans Thai"', "Segoe UI", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      colors: {
        ink: "#16181d",
        ink2: "#4b5159",
        muted: "#8b9099",
        line: "#d7dade",
        line2: "#e4e6e9",
        canvas: "#f5f6f7",
        card: "#ffffff",
        card2: "#f0f1f2",
        brand: "#0d4d43",
        accent: "#e7522b",
        // kept token names used across existing components, remapped to the palette
        brown: "#0d4d43", // → brand green
        green: "#0f7a52",
        green2: "#0f7a52",
        wait: "#b8791f",
        red: "#b4452a",
        grey: "#b0aca8",
      },
      backgroundColor: {
        "brown-tint": "#eef3f1", // brand-soft
        "green-tint": "#eaf4ef", // ok-soft
        "red-tint": "#fbf1ee", // open-soft
        "accent-tint": "#fdf1ec",
        "wait-tint": "#faf4e8",
      },
      maxWidth: {
        portal: "440px",
        crm: "1240px",
      },
      borderRadius: {
        xl2: "2px", // sharp corners per mockup
      },
    },
  },
  plugins: [],
};
