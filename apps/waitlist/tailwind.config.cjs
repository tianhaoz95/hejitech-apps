const baseConfig = require("../../packages/theme/tailwind.config.js")
module.exports = { ...baseConfig, content: ["./index.html", "./src/**/*.{ts,tsx}"] }
