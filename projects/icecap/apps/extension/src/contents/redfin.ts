import { quickEstimateBest, DEFAULT_ASSUMPTIONS, DEFAULT_STR_ASSUMPTIONS, type PropertyAssumptions, type StrAssumptions } from "../core/math"

// Runs on the pages manifest.config.ts lists for it (content_scripts), at document_idle.

// ─── Scraping ─────────────────────────────────────────────────────────────

function scrapeRedfin() {
  const priceEl =
    document.querySelector('[data-rf-test-id="abp-price"] .statsValue') ??
    document.querySelector(".price-section .statsValue") ??
    document.querySelector("[data-rf-test-name='price']")

  const streetEl = document.querySelector(".street-address")
  const cityEl = document.querySelector(".citystatezip")
  const address = [streetEl?.textContent, cityEl?.textContent].filter(Boolean).join(", ").trim()

  const descEl =
    document.querySelector("#marketing-remarks-scroll") ??
    document.querySelector(".description-content") ??
    document.querySelector("[data-rf-test-id='listing-description']")

  const keyDetails = Array.from(document.querySelectorAll(".keyDetail, .table-row"))
  const taxDetail = keyDetails.find((d) => d.textContent?.toLowerCase().includes("tax"))
  const hoaDetail = keyDetails.find((d) => d.textContent?.toLowerCase().includes("hoa"))

  const priceText = priceEl
    ? Array.from(priceEl.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent?.trim()).join("").trim()
    : ""
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0

  const taxText = taxDetail?.querySelector(".value, .table-value")?.textContent ?? ""
  const hoaText = hoaDetail?.querySelector(".value, .table-value")?.textContent ?? ""

  return {
    price,
    address,
    taxes: parseFloat(taxText.replace(/[^0-9.]/g, "")) || 0,
    hoa: parseFloat(hoaText.replace(/[^0-9.]/g, "")) || 0,
    description: descEl?.textContent?.trim() ?? "",
    url: window.location.href,
  }
}

// ─── Map badge injection ───────────────────────────────────────────────────

let currentAssumptions: PropertyAssumptions = { ...DEFAULT_ASSUMPTIONS }
let currentStrAssumptions: StrAssumptions = { ...DEFAULT_STR_ASSUMPTIONS }
let currentMapPinMetric: "ltr" | "str" | "best" = "ltr"

const BADGE_CLASS = "icecap-badge"
const PROCESSED_ATTR = "data-icecap-processed"

const PRICE_SELECTORS = [
  ".bp-Homecard__Price--value",
  ".bp-Homecard__Price",
  "[data-rf-test-name='pushpin-price-text']",
  "[data-rf-test-id='map-home-card-price']",
  "[data-rf-test-id='home-card-price']",
  ".price",
  ".MapHomeCardV2--price",
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
    // Skip elements that have child price elements (avoid duplication)
    const hasChild = PRICE_SELECTORS.some((sel) => el.querySelector(sel))
    if (hasChild) return

    const textContent = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .join("")
      .trim()

    if (!textContent || textContent.length > 20) return

    const price = parsePrice(textContent)
    if (isNaN(price) || price < 10_000) return

    const cashFlow = quickEstimateBest(price, currentAssumptions, currentStrAssumptions, currentMapPinMetric)
    el.setAttribute(PROCESSED_ATTR, "true")

    const badge = document.createElement("span")
    badge.className = BADGE_CLASS
    badge.dataset.icecapPrice = String(price)
    badge.textContent = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
    Object.assign(badge.style, {
      marginLeft: "6px",
      padding: "2px 6px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: "900",
      fontFamily: "sans-serif",
      color: "white",
      backgroundColor: cashFlow >= 0 ? "#16a34a" : "#dc2626",
      display: "inline-flex",
      alignItems: "center",
      verticalAlign: "middle",
      lineHeight: "1",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      border: "1px solid white",
    })
    el.style.display = "inline-flex"
    el.style.alignItems = "baseline"
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

// When Redfin shows a listing preview panel/popup after a pin click,
// try to pull price + address from it.
//
// Redfin keeps stale cards for neighboring properties in the DOM alongside the
// active one. querySelector returns the first match, which may be the wrong
// property. Instead, evaluate all matching cards and pick the one whose price
// is closest to the pin price. If even the best match deviates by more than 50%,
// the card almost certainly belongs to a different listing — use the pin price.
function scrapePreviewCard(fallbackPrice: number) {
  const cards = Array.from(document.querySelectorAll<Element>(
    '[data-rf-test-id="MapHomeCard"], .MapHomeCard, ' +
    '[data-rf-test-id="home-card"], .HomeCard--active, .HomeCard--hovered, ' +
    '.bp-HomeCardContainer, [class*="MapHomeCard"]'
  ))
  if (!cards.length) return null

  let bestCard: Element | null = null
  let bestPrice = 0
  let bestDelta = Infinity

  for (const card of cards) {
    const priceEl = card.querySelector(
      '.bp-Homecard__Price--value, [data-rf-test-id="home-card-price"], ' +
      '[data-rf-test-name="price"], .priceInfo'
    )
    const price = priceEl ? parsePrice(textNodesOf(priceEl)) : 0
    if (!price) continue
    const delta = fallbackPrice > 0 ? Math.abs(price - fallbackPrice) : 0
    if (bestCard === null || delta < bestDelta) {
      bestCard = card
      bestPrice = price
      bestDelta = delta
    }
  }

  if (!bestCard) return null

  const addrEl = bestCard.querySelector(
    '.homeAddressV2, [data-rf-test-name="property-address"], .street-address, .address'
  )
  const address = addrEl?.textContent?.trim() ?? ""

  // If the closest card's price is wildly off from the pin price, trust the pin.
  const price =
    fallbackPrice > 0 && bestDelta / fallbackPrice > 0.5
      ? fallbackPrice
      : bestPrice || fallbackPrice

  if (!price && !address) return null
  return { price, address, taxes: 0, hoa: 0, description: "", url: window.location.href }
}

// Send price immediately on click for instant sidebar feedback, then retry
// to upgrade with full listing data as Redfin's SPA finishes rendering.
//
// Delays start at 1000ms (not 300ms) because Redfin calls history.pushState
// synchronously inside its click handler (bubble phase, after our capture-phase
// listener). That means onUrlChange fires and calls scheduleScrapeTries(0)
// WITHIN THE SAME TICK as the pin click, restarting the retry chain with the
// detail-page URL already set — but React hasn't re-rendered yet. Scraping at
// 300ms reliably returns the PREVIOUS property's stale DOM data. 1000ms gives
// the SPA enough time to fetch and render the new listing.
const RETRY_DELAYS = [1000, 2500, 5000]
let pendingScrape: ReturnType<typeof setTimeout> | null = null
let scrapeGen = 0        // incremented on every scheduleScrapeTries call
let lastPinClickMs = 0   // timestamp of the most recent pin click

function scheduleScrapeTries(pinPrice: number) {
  if (pendingScrape) clearTimeout(pendingScrape)
  const gen = ++scrapeGen

  // Instant feedback: push price right away so the sidebar reacts immediately
  if (pinPrice > 0) {
    sendProperty({ price: pinPrice, address: "", taxes: 0, hoa: 0, description: "", url: window.location.href })
  }

  // Retries: upgrade to full listing data once the page has rendered it.
  // Only call scrapeRedfin() when the URL is a property detail page — calling
  // it on the map URL returns stale DOM data from the previously-viewed listing.
  let i = 0
  const next = () => {
    if (i >= RETRY_DELAYS.length) return
    pendingScrape = setTimeout(() => {
      if (gen !== scrapeGen) return  // superseded by a newer click or navigation
      i++
      if (/\/home\/\d+/.test(window.location.pathname)) {
        const full = scrapeRedfin()
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
// Using document capture so React re-renders don't break per-element listeners.

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // Walk up to find a Redfin map pin ancestor
  const pin = target.closest<HTMLElement>(
    '[data-rf-test-name="home-marker"], [data-dd-action-name="map_pushpin"]'
  )
  if (!pin) return
  lastPinClickMs = Date.now()
  const priceEl = pin.querySelector('[data-rf-test-name="pushpin-price-text"]')
  const pinPrice = priceEl ? parsePrice(textNodesOf(priceEl)) : 0
  scheduleScrapeTries(pinPrice)
}, true) // capture phase fires before React handlers

// ─── SPA navigation detection ─────────────────────────────────────────────
// MutationObserver URL-diff misses pushState; intercept it directly.

let lastDetectedUrl = ""

function onUrlChange() {
  const url = window.location.href
  if (url === lastDetectedUrl) return
  lastDetectedUrl = url
  if (/\/home\/\d+/.test(window.location.pathname)) {
    // If a pin was recently clicked, its own retry chain is already running and
    // timed correctly. Don't restart with a competing chain — that would cancel
    // the pin chain and re-start from t=0 with the stale DOM still in place.
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
}

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeRedfin())
  }
  return true
})

// ─── Assumptions sync via storage ─────────────────────────────────────────

chrome.storage.local.get(["icecap-assumptions", "icecap-str-assumptions", "icecap-map-pin-metric"], (result: Record<string, any>) => {
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

chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange & { newValue?: any }>, area) => {
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
onUrlChange()
const observer = new MutationObserver(injectBadges)
observer.observe(document.body, { childList: true, subtree: true })
