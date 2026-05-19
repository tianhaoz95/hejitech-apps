export const PROPERTY = {
  address: '2847 Maplewood Drive',
  city: 'Austin, TX 78704',
  price: '$485,000',
  beds: 3,
  baths: 2,
  sqft: '1,620',
  rent: '$2,950/mo',
  yearBuilt: 2003,
  lotSize: '0.18 acres',
  type: 'Single Family',
  // Replace with a real house photo URL before recording
  photo: 'https://picsum.photos/seed/maplewood/900/500',
}

export const METRICS = [
  { label: 'Cap Rate',     value: '6.8%',   badge: '✓', status: 'good'    },
  { label: 'CoC Return',   value: '9.2%',   badge: '✓', status: 'good'    },
  { label: '1% Rule',      value: '0.61',   badge: '~', status: 'warn'    },
  { label: 'GRM',          value: '13.7',   badge: null, status: 'neutral' },
  { label: 'Monthly NOI',  value: '$1,872', badge: null, status: 'neutral' },
]

export const HUB_DEALS = [
  { id: 1, address: '2847 Maplewood Dr', city: 'Austin, TX',     price: '$485,000', capRate: '6.8%', coc: '9.2%', saved: '2 days ago',  photo: 'https://picsum.photos/seed/deal1/80/60' },
  { id: 2, address: '1204 Elm Street',   city: 'Denver, CO',     price: '$392,000', capRate: '5.2%', coc: '7.1%', saved: '3 days ago',  photo: 'https://picsum.photos/seed/deal2/80/60' },
  { id: 3, address: '891 Oak Avenue',    city: 'Nashville, TN',  price: '$318,000', capRate: '7.1%', coc: '8.8%', saved: '5 days ago',  photo: 'https://picsum.photos/seed/deal3/80/60' },
  { id: 4, address: '3301 Pine Blvd',    city: 'Charlotte, NC',  price: '$275,000', capRate: '6.3%', coc: '8.2%', saved: '1 week ago',  photo: 'https://picsum.photos/seed/deal4/80/60' },
  { id: 5, address: '445 River Road',    city: 'Phoenix, AZ',    price: '$441,000', capRate: '8.4%', coc: '11.2%', saved: '2 weeks ago', photo: 'https://picsum.photos/seed/deal5/80/60' },
]

export const AI_SUMMARY =
  'This property at 2847 Maplewood Drive presents a compelling investment case. ' +
  'With a cap rate of 6.8% and cash-on-cash return of 9.2%, it outperforms the Austin ' +
  'market average by approximately 1.4 points. The 1% rule shortfall is typical for this ' +
  'submarket and is offset by strong appreciation trends. Recommended for buy-and-hold strategy.'
