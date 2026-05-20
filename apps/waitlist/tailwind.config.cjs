const baseConfig = require("../../packages/theme/tailwind.config.js")
module.exports = { ...baseConfig, darkMode: "class", content: ["./index.html", "./src/**/*.{ts,tsx}"] }

