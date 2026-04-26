import type { PlasmoCSConfig } from "plasmo"
import { quickEstimate as quickCashFlowEstimate } from "../core/math"

export const config: PlasmoCSConfig = {
  matches: ["https://www.realtor.com/*"],
  run_at: "document_idle",
}

function scrapeRealtor() {
  const priceEl =
    document.querySelector("[data-testid='list-price']") ??
    document.querySelector(".price-section__prices") ??
    document.querySelector("[data-label='pc-price']")

  const addressEl =
    document.querySelector("[data-testid='street-address']") ??
    document.querySelector(".listing-overview__property-address")

  const cityEl = document.querySelector("[data-testid='city-state-zip']")
  const address = [addressEl?.textContent, cityEl?.textContent]
    .filter(Boolean)
    .join(", ")
    .trim()

  const descEl =
    document.querySelector("[data-testid='listing-description']") ??
    document.querySelector(".listing-overview__description")

  const facts = Array.from(document.querySelectorAll("[data-testid='fact-label']"))
  const taxFact = facts.find((el) => el.textContent?.toLowerCase().includes("tax"))
  const hoaFact = facts.find((el) => el.textContent?.toLowerCase().includes("hoa"))

  const priceText = priceEl?.textContent ?? ""
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0

  return {
    price,
    address,
    taxes: parseFloat(taxFact?.nextElementSibling?.textContent?.replace(/[^0-9.]/g, "") ?? "0") || 0,
    hoa: parseFloat(hoaFact?.nextElementSibling?.textContent?.replace(/[^0-9.]/g, "") ?? "0") || 0,
    description: descEl?.textContent?.trim() ?? "",
    url: window.location.href,
  }
}

const BADGE_CLASS = "icecap-badge"
const PROCESSED_ATTR = "data-icecap-processed"

const PRICE_SELECTORS = [
  "[data-label='pc-price']",
  ".property-price",
  "[data-testid='card-price']",
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

    const cashFlow = quickCashFlowEstimate(price)
    el.setAttribute(PROCESSED_ATTR, "true")

    const badge = document.createElement("span")
    badge.className = BADGE_CLASS
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
      const full = scrapeRealtor()
      if (full.price > 0 || full.address) { sendProperty(full); return }
      next()
    }, RETRY_DELAYS[i])
  }
  next()
}

// ─── Document-level pin click detection ──────────────────────────────────

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const pin = target.closest<HTMLElement>(
    "[data-testid='map-pin'], [class*='map-pin'], [class*='MapPin'], " +
    "[class*='marker'][class*='price'], [class*='Marker'][class*='price']"
  )
  if (!pin) return
  const priceEl = pin.querySelector<HTMLElement>("[data-testid='card-price'], [class*='price']")
  const pinPrice = priceEl ? parsePrice(textNodesOf(priceEl)) : 0
  scheduleScrapeTries(pinPrice)
}, true)

// ─── SPA navigation detection ─────────────────────────────────────────────

let lastDetectedUrl = ""

function onUrlChange() {
  const url = window.location.href
  if (url === lastDetectedUrl) return
  lastDetectedUrl = url
  if (window.location.pathname.startsWith("/realestateandhomes-detail/")) {
    scheduleScrapeTries(0)
  }
}

const _origPushState = history.pushState.bind(history)
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  _origPushState(...args)
  onUrlChange()
}
window.addEventListener("popstate", onUrlChange)

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeRealtor())
  }
  return true
})

// ─── Badge injection with MutationObserver ────────────────────────────────

injectBadges()
onUrlChange()
const observer = new MutationObserver(injectBadges)
observer.observe(document.body, { childList: true, subtree: true })
