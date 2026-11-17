import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.zillow.com/homedetails/*"]
}

const scrapeZillow = () => {
  const priceText = document.querySelector('[data-testid="price"]')?.textContent || 
                    document.querySelector('.ds-value')?.textContent
  const addressText = document.querySelector('[data-testid="address"]')?.textContent || 
                      document.querySelector('.ds-address-container')?.textContent
  const descriptionText = document.querySelector('.ds-overview-section')?.textContent || 
                          document.querySelector('[data-testid="description-content"]')?.textContent

  // Zillow usually hides taxes/HOA in specific sections or data attributes
  // For MVP, we'll try to find them if possible, but they are harder to find without a deep dive
  const hoaText = Array.from(document.querySelectorAll('li'))
    .find(li => li.textContent?.toLowerCase().includes("hoa fee"))?.textContent
  
  const taxText = Array.from(document.querySelectorAll('span'))
    .find(span => span.textContent?.toLowerCase().includes("tax history"))?.parentElement?.textContent

  return {
    price: priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null,
    address: addressText?.trim() || '',
    taxes: taxText ? parseFloat(taxText.replace(/[^0-9.]/g, '').split('.')[0]) : 0, // Very rough
    hoa: hoaText ? parseFloat(hoaText.replace(/[^0-9.]/g, '')) : 0,
    description: descriptionText?.trim() || '',
    url: window.location.href
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeZillow()
    sendResponse(data)
  }
  return true
})
