import { ListingMockup } from './ListingMockup'

export function RedfinMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'redfin',
        name: 'Redfin',
        navBg: '#cc1818',
        logo: 'redfin',
        // Drop manually: screenshot the listing page, save as services/web/public/promo/listing-redfin.png
        screenshotSrc: '/promo/listing-redfin.png',
      }}
    />
  )
}
