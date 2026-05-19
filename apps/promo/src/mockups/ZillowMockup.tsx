import { ListingMockup } from './ListingMockup'

export function ZillowMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'zillow',
        name: 'Zillow',
        navBg: '#1277e1',
        logo: 'zillow',
        // Populated after running: pnpm --filter @icecap/tests run capture:promo
        screenshotSrc: '/listing-zillow.png',
      }}
    />
  )
}
