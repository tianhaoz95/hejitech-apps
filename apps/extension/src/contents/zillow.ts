import type { PlasmoCSConfig } from "plasmo"
import { quickEstimate as quickCashFlowEstimate } from "../core/math"

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeZillow())
  }
  return true
})

injectBadges()
const observer = new MutationObserver(injectBadges)
observer.observe(document.body, { childList: true, subtree: true })
