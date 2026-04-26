import type { PlasmoCSConfig } from "plasmo"
import { quickEstimate as quickCashFlowEstimate, DEFAULT_ASSUMPTIONS, type PropertyAssumptions } from "../core/math"

export const config: PlasmoCSConfig = {
  matches: ["https://www.redfin.com/*"],
  run_at: "document_idle",
}

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

  const priceText = priceEl?.textContent ?? ""
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

    const cashFlow = quickCashFlowEstimate(price, currentAssumptions)
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
function scrapePreviewCard(fallbackPrice: number) {
  const card = document.querySelector(
    '[data-rf-test-id="MapHomeCard"], .MapHomeCard, ' +
    '[data-rf-test-id="home-card"], .HomeCard--active, .HomeCard--hovered, ' +
    '.bp-HomeCardContainer, [class*="MapHomeCard"]'
  )
  if (!card) return null

  const addrEl = card.querySelector(
    '.homeAddressV2, [data-rf-test-name="property-address"], .street-address, .address'
  )
  const priceEl = card.querySelector(
    '.bp-Homecard__Price--value, [data-rf-test-id="home-card-price"], ' +
    '[data-rf-test-name="price"], .priceInfo'
  )
  const price = priceEl ? parsePrice(textNodesOf(priceEl)) || fallbackPrice : fallbackPrice
  const address = addrEl?.textContent?.trim() ?? ""
  if (!price && !address) return null
  return { price, address, taxes: 0, hoa: 0, description: "", url: window.location.href }
}

// Send price immediately on click for instant sidebar feedback, then retry
// to upgrade with full listing data as Redfin's SPA finishes rendering.
const RETRY_DELAYS = [300, 800, 2000]
let pendingScrape: ReturnType<typeof setTimeout> | null = null

function scheduleScrapeTries(pinPrice: number) {
  if (pendingScrape) clearTimeout(pendingScrape)

  // Instant feedback: push price right away so the sidebar reacts immediately
  if (pinPrice > 0) {
    sendProperty({ price: pinPrice, address: "", taxes: 0, hoa: 0, description: "", url: window.location.href })
  }

  // Retries: upgrade to full listing data once the page has rendered it
  let i = 0
  const next = () => {
    if (i >= RETRY_DELAYS.length) return
    pendingScrape = setTimeout(() => {
      i++
      const full = scrapeRedfin()
      if (full.price > 0 || full.address) { sendProperty(full); return }
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
    sendResponse(scrapeRedfin())
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
