import { ListingMockup } from './ListingMockup'

export function ZillowMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'zillow',
        name: 'Zillow',
        navBg: '#1277e1',
        logo: 'zillow',
        // Drop manually: screenshot the listing page, save as apps/promo/public/listing-zillow.png
        screenshotSrc: '/listing-zillow.png',
      }}
    />
  )
}
