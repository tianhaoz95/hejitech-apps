const baseConfig = require("../../packages/theme/tailwind.config.js")

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{ts,tsx}",
    "./sidepanel.tsx",
    "./popup.tsx",
    "./options.tsx",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: baseConfig.theme,
  plugins: [],
}
