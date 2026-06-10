/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#071018",
        panel: "#0d1722",
        panel2: "#111f2e",
        line: "#213246",
        accent: "#2de2a8",
        gold: "#f7c948",
        danger: "#fb7185"
      },
      boxShadow: {
        glow: "0 0 36px rgba(45, 226, 168, 0.16)"
      }
    }
  },
  plugins: []
};
