import { ListingMockup } from './ListingMockup'

export function RealtorMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'realtor',
        name: 'Realtor.com',
        navBg: '#d0021b',
        logo: 'realtor.com',
        // Populated after running: pnpm --filter @icecap/tests run capture:promo
        screenshotSrc: '/listing-realtor.png',
      }}
    />
  )
}
