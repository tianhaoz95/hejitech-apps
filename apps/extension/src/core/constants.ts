export const IS_DEV = process.env.PLASMO_PUBLIC_USE_EMULATOR === "true"
export const HUB_URL = IS_DEV ? "http://localhost:5173" : "https://icecap-hub.web.app"
