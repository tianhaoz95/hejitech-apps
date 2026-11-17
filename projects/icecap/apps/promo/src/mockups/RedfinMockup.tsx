import { ListingMockup } from './ListingMockup'

export function RedfinMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'redfin',
        name: 'Redfin',
        navBg: '#cc1818',
        logo: 'redfin',
        // Drop manually: screenshot the listing page, save as apps/promo/public/listing-redfin.png
        screenshotSrc: '/listing-redfin.png',
      }}
    />
  )
}
