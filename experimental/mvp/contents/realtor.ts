import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.realtor.com/realestateandhomes-detail/*"]
}

const scrapeRealtor = () => {
  const priceText = document.querySelector('[data-testid="price-container"]')?.textContent || 
                    document.querySelector('.Pricestyles__StyledPrice-rui__sc-1678fdb-0')?.textContent
  const addressText = document.querySelector('[data-testid="address-container"]')?.textContent || 
                      document.querySelector('.Addressstyles__StyledAddress-rui__sc-1596708-0')?.textContent
  const descriptionText = document.querySelector('[data-testid="description-content-text"]')?.textContent

  // Realtor often has detailed tax and HOA data in specific sections
  const hoaText = Array.from(document.querySelectorAll('.rui__sc-1678fdb-0'))
    .find(el => el.textContent?.toLowerCase().includes("monthly hoa fee"))?.textContent || 
    Array.from(document.querySelectorAll('span'))
    .find(el => el.textContent?.toLowerCase().includes("monthly hoa fee"))?.parentElement?.textContent

  return {
    price: priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null,
    address: addressText?.trim() || '',
    taxes: 0, // Harder to find consistently across realtor.com layouts without more work
    hoa: hoaText ? parseFloat(hoaText.replace(/[^0-9.]/g, '')) : 0,
    description: descriptionText?.trim() || '',
    url: window.location.href
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeRealtor()
    sendResponse(data)
  }
  return true
})
