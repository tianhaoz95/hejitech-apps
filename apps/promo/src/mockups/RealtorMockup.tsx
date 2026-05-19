import { ListingMockup } from './ListingMockup'

export function RealtorMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'realtor',
        name: 'Realtor.com',
        navBg: '#d0021b',
        logo: 'realtor.com',
        // Drop manually: screenshot the listing page, save as apps/promo/public/listing-realtor.png
        screenshotSrc: '/listing-realtor.png',
      }}
    />
  )
}
