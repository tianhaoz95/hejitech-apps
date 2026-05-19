import { ListingMockup } from './ListingMockup'

export function RedfinMockup() {
  return (
    <ListingMockup
      theme={{
        id: 'redfin',
        name: 'Redfin',
        navBg: '#cc1818',
        logo: 'redfin',
        // Populated after running: pnpm --filter @icecap/tests run capture:promo
        screenshotSrc: '/listing-redfin.png',
      }}
    />
  )
}
