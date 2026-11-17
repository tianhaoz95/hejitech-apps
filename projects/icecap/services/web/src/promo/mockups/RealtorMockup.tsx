import { ListingMockup } from './ListingMockup'

export function RealtorMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'realtor',
        name: 'Realtor.com',
        navBg: '#d0021b',
        logo: 'realtor.com',
        // Drop manually: screenshot the listing page, save as services/web/public/promo/listing-realtor.png
        screenshotSrc: '/promo/listing-realtor.png',
      }}
    />
  )
}
