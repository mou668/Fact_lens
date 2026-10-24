/** Brand colours live here -- use these names, never raw hex in components. */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2563EB", hover: "#1D4ED8" },
        navy: { DEFAULT: "#0B1A33", light: "#13284D" },
        real: "#16A34A",
        fake: "#DC2626",
        uncertain: "#F59E0B",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
