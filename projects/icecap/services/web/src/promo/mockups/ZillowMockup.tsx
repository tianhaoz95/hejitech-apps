import { ListingMockup } from './ListingMockup'

export function ZillowMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'zillow',
        name: 'Zillow',
        navBg: '#1277e1',
        logo: 'zillow',
        // Drop manually: screenshot the listing page, save as services/web/public/promo/listing-zillow.png
        screenshotSrc: '/promo/listing-zillow.png',
      }}
    />
  )
}
