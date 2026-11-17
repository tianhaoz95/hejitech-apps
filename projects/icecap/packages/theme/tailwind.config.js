/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#2563eb",   // Blue-600
          success: "#16a34a",   // Green-600
          alert: "#dc2626",     // Red-600
          ai: "#9333ea",        // Purple-600
          "ai-light": "#f5f3ff", // Purple-50
          "ai-border": "#ede9fe", // Purple-100
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "xl": "12px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        "brand": "0 4px 24px rgba(37, 99, 235, 0.15)",
        "card": "0 1px 4px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
}
