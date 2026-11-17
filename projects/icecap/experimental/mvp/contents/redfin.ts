import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.redfin.com/*"]
}

const calculateQuickCashFlow = (price: number) => {
  const estimatedRent = price * 0.007
  const downPayment = price * 0.2
  const loanAmount = price - downPayment
  const interestRate = 0.07
  const monthlyRate = interestRate / 12
  const numPayments = 30 * 12
  
  const monthlyMortgage = 
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  
  const monthlyExpenses = estimatedRent * 0.35
  const cashFlow = estimatedRent - monthlyMortgage - monthlyExpenses
  return Math.round(cashFlow)
}

const transformMapLabels = () => {
  const labels = document.querySelectorAll(`
    .price, 
    .MapHomeCardV2--price,
    [data-rf-test-name="pushpin-price-text"],
    [data-rf-test-id="map-home-card-price"],
    .home-card-price,
    .statsValue,
    [data-rf-test-id="home-card-price"],
    .bp-Homecard__Price--value,
    .bp-Homecard__Price
  `)

  labels.forEach((el) => {
    if (el.getAttribute("data-icecap-processed")) return
    
    // PREVENTION: If this element has children that are ALSO in our label list,
    // skip this one and let the child handle it to avoid duplication.
    const hasLabelChild = Array.from(el.querySelectorAll("*")).some(child => 
      child.classList.contains("bp-Homecard__Price--value") || 
      child.classList.contains("price") ||
      child.hasAttribute("data-rf-test-name")
    )
    if (hasLabelChild) return

    // Get text content, but ignore any existing icecap badges
    const text = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim())
      .join("") || el.textContent?.trim() || ""

    if (!text || text.length > 20) return

    let price = 0
    const cleanText = text.toLowerCase().replace(/[^0-9.km]/g, "")
    
    if (cleanText.endsWith("k")) {
      price = parseFloat(cleanText.replace("k", "")) * 1000
    } else if (cleanText.endsWith("m")) {
      price = parseFloat(cleanText.replace("m", "")) * 1000000
    } else {
      price = parseInt(cleanText)
    }

    if (!isNaN(price) && price > 10000) {
      const cashFlow = calculateQuickCashFlow(price)
      el.setAttribute("data-icecap-processed", "true")
      
      const badge = document.createElement("span")
      const cashFlowText = cashFlow >= 0 ? `+$${cashFlow}` : `-$${Math.abs(cashFlow)}`
      badge.textContent = cashFlowText
      
      // Style the badge
      badge.style.marginLeft = "6px"
      badge.style.padding = "2px 6px"
      badge.style.borderRadius = "4px"
      badge.style.fontSize = "12px"
      badge.style.backgroundColor = cashFlow >= 0 ? "#16a34a" : "#dc2626"
      badge.style.color = "white"
      badge.style.fontWeight = "900"
      badge.style.display = "inline-flex"
      badge.style.alignItems = "center"
      badge.style.verticalAlign = "middle"
      badge.style.lineHeight = "1"
      badge.style.boxShadow = "0 1px 2px rgba(0,0,0,0.2)"
      badge.style.fontFamily = "sans-serif"
      badge.className = "icecap-badge"
      
      if (el instanceof HTMLElement) {
        el.style.display = "inline-flex"
        el.style.alignItems = "baseline"
        el.appendChild(badge)
      }
    }
  })
}

const scrapeRedfin = () => {
  const priceText = document.querySelector('[data-rf-test-id="abp-price"] .statsValue')?.textContent
  const addressText = document.querySelector('.street-address')?.textContent
  const cityStateZip = document.querySelector('.citystatezip')?.textContent
  const descriptionText = document.querySelector('#marketing-remarks-scroll')?.textContent || 
                          document.querySelector('.description-content')?.textContent
  
  const details = Array.from(document.querySelectorAll('.keyDetail'))
  const taxesDetail = details.find(d => d.textContent?.toLowerCase().includes("taxes"))?.querySelector('.value')?.textContent
  const hoaDetail = details.find(d => d.textContent?.toLowerCase().includes("hoa"))?.querySelector('.value')?.textContent

  return {
    price: priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null,
    address: `${addressText || ''} ${cityStateZip || ''}`.trim(),
    taxes: taxesDetail ? parseFloat(taxesDetail.replace(/[^0-9.]/g, '')) : 0,
    hoa: hoaDetail ? parseFloat(hoaDetail.replace(/[^0-9.]/g, '')) : 0,
    description: descriptionText?.trim() || '',
    url: window.location.href
  }
}

const observer = new MutationObserver(() => {
  transformMapLabels()
})

observer.observe(document.body, { childList: true, subtree: true })
setInterval(transformMapLabels, 1500)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeRedfin()
    sendResponse(data)
  }
  return true
})
