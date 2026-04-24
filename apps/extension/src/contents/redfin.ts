import type { PlasmoCSConfig } from "plasmo"
import { quickEstimate as quickCashFlowEstimate } from "../core/math"

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

    const cashFlow = quickCashFlowEstimate(price)
    el.setAttribute(PROCESSED_ATTR, "true")

    const badge = document.createElement("span")
    badge.className = BADGE_CLASS
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

// ─── Message listener ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrape") {
    sendResponse(scrapeRedfin())
  }
  return true
})

// ─── Badge injection with MutationObserver ────────────────────────────────

injectBadges()
const observer = new MutationObserver(injectBadges)
observer.observe(document.body, { childList: true, subtree: true })
