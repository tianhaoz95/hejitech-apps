import type { PlasmoCSConfig } from "plasmo"
import { quickEstimate as quickCashFlowEstimate, DEFAULT_ASSUMPTIONS, type PropertyAssumptions } from "../core/math"

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

    const cashFlow = quickCashFlowEstimate(price, currentAssumptions)
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

const RETRY_DELAYS = [300, 800, 2000]
let pendingScrape: ReturnType<typeof setTimeout> | null = null

function scheduleScrapeTries(pinPrice: number) {
  if (pendingScrape) clearTimeout(pendingScrape)

  if (pinPrice > 0) {
    sendProperty({ price: pinPrice, address: "", taxes: 0, hoa: 0, description: "", url: window.location.href })
  }

  let i = 0
  const next = () => {
    if (i >= RETRY_DELAYS.length) return
    pendingScrape = setTimeout(() => {
      i++
      const full = scrapeZillow()
      if (full.price > 0 || full.address) { sendProperty(full); return }
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
  // Zillow map pins are buttons with data-zpid, or elements with pushpin/marker class names
  const pin = target.closest<HTMLElement>(
    "[data-zpid], button[class*='pushpin'], button[class*='Pushpin'], " +
    "[class*='marker'][class*='price'], [class*='Marker'][class*='price']"
  )
  if (!pin) return
  const priceEl = pin.querySelector<HTMLElement>("[data-test='property-card-price'], [class*='Price']")
  const pinPrice = priceEl ? parsePrice(textNodesOf(priceEl)) : 0
  scheduleScrapeTries(pinPrice)
}, true)

// ─── SPA navigation detection ─────────────────────────────────────────────

let lastDetectedUrl = ""

function onUrlChange() {
  const url = window.location.href
  if (url === lastDetectedUrl) return
  lastDetectedUrl = url
  if (window.location.pathname.startsWith("/homedetails/")) {
    scheduleScrapeTries(0)
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
    const cashFlow = quickCashFlowEstimate(price, currentAssumptions)
    badge.textContent = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
    badge.style.backgroundColor = cashFlow >= 0 ? "#16a34a" : "#dc2626"
  })
  injectBadges()
}

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeZillow())
  }
  return true
})

// ─── Assumptions sync via storage ─────────────────────────────────────────

chrome.storage.local.get("icecap-assumptions", (result) => {
  if (result["icecap-assumptions"]) {
    currentAssumptions = { ...DEFAULT_ASSUMPTIONS, ...result["icecap-assumptions"] }
    refreshBadges()
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes["icecap-assumptions"]) return
  console.log("[Icecap] assumptions updated, refreshing badges")
  currentAssumptions = { ...DEFAULT_ASSUMPTIONS, ...changes["icecap-assumptions"].newValue }
  refreshBadges()
})

// ─── Badge injection with MutationObserver ────────────────────────────────

injectBadges()
onUrlChange()
const observer = new MutationObserver(injectBadges)
observer.observe(document.body, { childList: true, subtree: true })
