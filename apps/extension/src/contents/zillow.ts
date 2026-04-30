import type { PlasmoCSConfig } from "plasmo"
import { quickEstimateBest, DEFAULT_ASSUMPTIONS, DEFAULT_STR_ASSUMPTIONS, type PropertyAssumptions, type StrAssumptions } from "../core/math"

export const config: PlasmoCSConfig = {
  matches: ["https://www.zillow.com/*"],
  run_at: "document_idle",
}

function scrapeZillow() {
  // Price
  const priceEl =
    document.querySelector("[data-testid='price']") ??
    document.querySelector(".summary-container .zestimate-price") ??
    document.querySelector("span[data-test='property-card-price']") ??
    document.querySelector(".ds-summary-row .ds-value")

  // Address
  const streetEl = document.querySelector("h1[data-testid='bdp-building-name'], h1.ds-address-container")
  const address = streetEl?.textContent?.trim() ?? document.title.split("|")[0]?.trim() ?? ""

  // Description
  const descEl =
    document.querySelector("[data-testid='listing-description']") ??
    document.querySelector(".ds-overview-section")

  // Taxes/HOA from fact sheet
  const factItems = Array.from(document.querySelectorAll(".ds-fact-list li, [data-testid='facts-category'] li"))
  const taxItem = factItems.find((el) => el.textContent?.toLowerCase().includes("tax"))
  const hoaItem = factItems.find((el) => el.textContent?.toLowerCase().includes("hoa"))

  const priceText = priceEl?.textContent ?? ""
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0

  return {
    price,
    address,
    taxes: parseFloat(taxItem?.textContent?.replace(/[^0-9.]/g, "") ?? "0") || 0,
    hoa: parseFloat(hoaItem?.textContent?.replace(/[^0-9.]/g, "") ?? "0") || 0,
    description: descEl?.textContent?.trim() ?? "",
    url: window.location.href,
  }
}

let currentAssumptions: PropertyAssumptions = { ...DEFAULT_ASSUMPTIONS }
let currentStrAssumptions: StrAssumptions = { ...DEFAULT_STR_ASSUMPTIONS }
let currentMapPinMetric: "ltr" | "str" | "best" = "ltr"

const BADGE_CLASS = "icecap-badge"
const PROCESSED_ATTR = "data-icecap-processed"

const PRICE_SELECTORS = [
  "[data-test='property-card-price']",
  ".list-card-price",
  ".StyledPropertyCardDataArea-c11n-8-84-3__sc-yio82u-0",
]

function parsePrice(text: string): number {
  const clean = text.toLowerCase().replace(/[^0-9.km]/g, "")
  if (clean.endsWith("k")) return parseFloat(clean) * 1000
  if (clean.endsWith("m")) return parseFloat(clean) * 1_000_000
  return parseInt(clean) || 0
}

function injectBadges() {
  const elements = document.querySelectorAll<HTMLElement>(PRICE_SELECTORS.join(","))
  elements.forEach((el) => {
    if (el.getAttribute(PROCESSED_ATTR)) return
    const text = el.textContent?.trim() ?? ""
    if (!text) return
    const price = parsePrice(text)
    if (!price || price < 10_000) return

    const cashFlow = quickEstimateBest(price, currentAssumptions, currentStrAssumptions, currentMapPinMetric)
    el.setAttribute(PROCESSED_ATTR, "true")

    const badge = document.createElement("span")
    badge.className = BADGE_CLASS
    badge.dataset.icecapPrice = String(price)
    badge.textContent = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
    Object.assign(badge.style, {
      marginLeft: "5px",
      padding: "2px 5px",
      borderRadius: "4px",
      fontSize: "10px",
      fontWeight: "900",
      fontFamily: "sans-serif",
      color: "white",
      backgroundColor: cashFlow >= 0 ? "#16a34a" : "#dc2626",
      display: "inline-flex",
      alignItems: "center",
      verticalAlign: "middle",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      border: "1px solid white",
    })
    el.appendChild(badge)
  })
}

// ─── Map pin badge injection (streamlined pill markers) ───────────────────
// Zillow's map uses pill-shaped markers like:
//   <div data-test="property-marker" ...>
//     <div style="overflow:hidden">199K</div>
//   </div>
// The inner div clips overflow, so we append the badge to the outer container.

function injectMapPinBadges() {
  const pins = document.querySelectorAll<HTMLElement>(
    `[data-test="property-marker"]:not([${PROCESSED_ATTR}])`
  )
  pins.forEach((pin) => {
    const priceDiv = pin.querySelector<HTMLElement>("div")
    if (!priceDiv) return
    const text = priceDiv.textContent?.trim() ?? ""
    if (!text) return
    const price = parsePrice(text)
    if (!price || price < 10_000) return

    pin.setAttribute(PROCESSED_ATTR, "true")
    const cashFlow = quickEstimateBest(price, currentAssumptions, currentStrAssumptions, currentMapPinMetric)

    const badge = document.createElement("span")
    badge.className = BADGE_CLASS
    badge.dataset.icecapPrice = String(price)
    badge.textContent = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
    Object.assign(badge.style, {
      marginLeft: "4px",
      padding: "1px 4px",
      borderRadius: "3px",
      fontSize: "9px",
      fontWeight: "900",
      fontFamily: "sans-serif",
      color: "white",
      backgroundColor: cashFlow >= 0 ? "#16a34a" : "#dc2626",
      display: "inline-flex",
      alignItems: "center",
      verticalAlign: "middle",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      border: "1px solid white",
      whiteSpace: "nowrap",
    })
    // Allow the outer container to show the badge beyond the clipped inner div
    pin.style.overflow = "visible"
    pin.appendChild(badge)
  })
}

// ─── Auto-scrape helpers ──────────────────────────────────────────────────

function textNodesOf(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim())
    .join("")
    .trim()
}

function sendProperty(data: object) {
  chrome.runtime.sendMessage({ action: "propertyDetected", data }, () => {
    void chrome.runtime.lastError
  })
}

function scrapePreviewCard(fallbackPrice: number) {
  const card = document.querySelector(
    '[data-test="bdp-map-home-card"], [class*="mapPopup"], ' +
    '[class*="MapCard"], [class*="map-card"]'
  )
  if (!card) return null
  const addrEl = card.querySelector(
    '[data-testid="listing-card-addr"], .list-card-addr, address, [class*="Address"]'
  )
  const priceEl = card.querySelector('[data-test="property-card-price"], [class*="Price"]')
  const price = priceEl ? parsePrice(textNodesOf(priceEl)) || fallbackPrice : fallbackPrice
  const address = addrEl?.textContent?.trim() ?? ""
  if (!price && !address) return null
  return { price, address, taxes: 0, hoa: 0, description: "", url: window.location.href }
}

const RETRY_DELAYS = [1000, 2500, 5000]
let pendingScrape: ReturnType<typeof setTimeout> | null = null
let scrapeGen = 0
let lastPinClickMs = 0

function scheduleScrapeTries(pinPrice: number) {
  if (pendingScrape) clearTimeout(pendingScrape)
  const gen = ++scrapeGen

  if (pinPrice > 0) {
    sendProperty({ price: pinPrice, address: "", taxes: 0, hoa: 0, description: "", url: window.location.href })
  }

  let i = 0
  const next = () => {
    if (i >= RETRY_DELAYS.length) return
    pendingScrape = setTimeout(() => {
      if (gen !== scrapeGen) return
      i++
      if (window.location.pathname.startsWith("/homedetails/")) {
        const full = scrapeZillow()
        if (full.price > 0 || full.address) { sendProperty(full); return }
      }
      const preview = scrapePreviewCard(pinPrice)
      if (preview) { sendProperty(preview); return }
      next()
    }, RETRY_DELAYS[i])
  }
  next()
}

// ─── Document-level pin click detection ──────────────────────────────────

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // Zillow map pins: data-zpid buttons, pushpin classes, or streamlined pill markers
  const pin = target.closest<HTMLElement>(
    "[data-zpid], button[class*='pushpin'], button[class*='Pushpin'], " +
    "[class*='marker'][class*='price'], [class*='Marker'][class*='price'], " +
    "[data-test='property-marker']"
  )
  if (!pin) return
  lastPinClickMs = Date.now()
  const priceEl = pin.querySelector<HTMLElement>("[data-test='property-card-price'], [class*='Price']")
  // For streamlined pill markers the price lives in the first child div
  const mapPillDiv = pin.matches("[data-test='property-marker']") ? pin.querySelector<HTMLElement>("div") : null
  const priceSource = priceEl ?? mapPillDiv
  const pinPrice = priceSource ? parsePrice(textNodesOf(priceSource)) : 0
  scheduleScrapeTries(pinPrice)
}, true)

// ─── SPA navigation detection ─────────────────────────────────────────────

let lastDetectedUrl = ""

function onUrlChange() {
  const url = window.location.href
  if (url === lastDetectedUrl) return
  lastDetectedUrl = url
  if (window.location.pathname.startsWith("/homedetails/")) {
    if (Date.now() - lastPinClickMs > 5000) {
      scheduleScrapeTries(0)
    }
  }
}

const _origPushState = history.pushState.bind(history)
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  _origPushState(...args)
  onUrlChange()
}
window.addEventListener("popstate", onUrlChange)

function refreshBadges() {
  document.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}`).forEach((badge) => {
    const price = Number(badge.dataset.icecapPrice)
    if (!price) return
    const cashFlow = quickEstimateBest(price, currentAssumptions, currentStrAssumptions, currentMapPinMetric)
    badge.textContent = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
    badge.style.backgroundColor = cashFlow >= 0 ? "#16a34a" : "#dc2626"
  })
  injectBadges()
  injectMapPinBadges()
}

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeZillow())
  }
  return true
})

// ─── Assumptions sync via storage ─────────────────────────────────────────

chrome.storage.local.get(["icecap-assumptions", "icecap-str-assumptions", "icecap-map-pin-metric"], (result) => {
  if (result["icecap-assumptions"]) {
    currentAssumptions = { ...DEFAULT_ASSUMPTIONS, ...result["icecap-assumptions"] }
  }
  if (result["icecap-str-assumptions"]) {
    currentStrAssumptions = { ...DEFAULT_STR_ASSUMPTIONS, ...result["icecap-str-assumptions"] }
  }
  if (result["icecap-map-pin-metric"]) {
    currentMapPinMetric = result["icecap-map-pin-metric"]
  }
  refreshBadges()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  let changed = false
  if (changes["icecap-assumptions"]) {
    currentAssumptions = { ...DEFAULT_ASSUMPTIONS, ...changes["icecap-assumptions"].newValue }
    changed = true
  }
  if (changes["icecap-str-assumptions"]) {
    currentStrAssumptions = { ...DEFAULT_STR_ASSUMPTIONS, ...changes["icecap-str-assumptions"].newValue }
    changed = true
  }
  if (changes["icecap-map-pin-metric"]) {
    currentMapPinMetric = changes["icecap-map-pin-metric"].newValue
    changed = true
  }
  
  if (changed) {
    console.log("[Icecap] config updated, refreshing badges")
    refreshBadges()
  }
})

// ─── Badge injection with MutationObserver ────────────────────────────────

injectBadges()
injectMapPinBadges()
onUrlChange()
const observer = new MutationObserver(() => { injectBadges(); injectMapPinBadges() })
observer.observe(document.body, { childList: true, subtree: true })
