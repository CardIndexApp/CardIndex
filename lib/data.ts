export interface Card {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  trend: 'up' | 'down'
  score: number
  breakdown: { growth: number; liquidity: number; volatility: number; demand: number }
  verdict: string
  verdictShort: string
  rarity: string
  year: string
  emoji: string
  history: { month: string; price: number }[]
  sales: { date: string; price: number; platform: string }[]
}

export const cards: Card[] = [
  {
    id: 'charizard-base-psa9',
    name: 'Charizard',
    set: 'Base Set',
    grade: 'PSA 9',
    price: 4850,
    change: 12.4,
    trend: 'up',
    score: 87,
    breakdown: { growth: 91, liquidity: 88, volatility: 72, demand: 96 },
    verdict: 'Bullish long-term outlook. Charizard Base Set PSA 9 continues to demonstrate exceptional collector demand with consistent appreciation over 18 months. Low circulating supply relative to demand, combined with strong cultural relevance, suggests continued upward pressure on prices.',
    verdictShort: 'Strong collector demand. Consistent appreciation.',
    rarity: 'Holo Rare', year: '1999', emoji: '🔥',
    history: [
      { month: 'May', price: 3200 }, { month: 'Jun', price: 3450 }, { month: 'Jul', price: 3380 },
      { month: 'Aug', price: 3750 }, { month: 'Sep', price: 3900 }, { month: 'Oct', price: 4100 },
      { month: 'Nov', price: 4350 }, { month: 'Dec', price: 4200 }, { month: 'Jan', price: 4480 },
      { month: 'Feb', price: 4600 }, { month: 'Mar', price: 4750 }, { month: 'Apr', price: 4850 },
    ],
    sales: [
      { date: 'Apr 14', price: 4900, platform: 'eBay' }, { date: 'Apr 11', price: 4820, platform: 'eBay' },
      { date: 'Apr 8', price: 4780, platform: 'PWCC' }, { date: 'Apr 3', price: 4850, platform: 'eBay' },
      { date: 'Mar 28', price: 4700, platform: 'eBay' },
    ],
  },
  {
    id: 'lugia-v-alt-psa10',
    name: 'Lugia V Alt Art',
    set: 'Silver Tempest',
    grade: 'PSA 10',
    price: 1740,
    change: -8.2,
    trend: 'down',
    score: 71,
    breakdown: { growth: 58, liquidity: 74, volatility: 45, demand: 82 },
    verdict: 'Short-term correction underway. Lugia V Alt Art PSA 10 experienced post-release price compression typical of modern chase cards. Supply is normalising as more PSA 10s return from grading. The card retains strong collector appeal with floor support likely around $1,500.',
    verdictShort: 'Post-release correction. Floor forming.',
    rarity: 'Alt Art Ultra Rare', year: '2022', emoji: '🌊',
    history: [
      { month: 'May', price: 2400 }, { month: 'Jun', price: 2250 }, { month: 'Jul', price: 2100 },
      { month: 'Aug', price: 2050 }, { month: 'Sep', price: 1980 }, { month: 'Oct', price: 1920 },
      { month: 'Nov', price: 2100 }, { month: 'Dec', price: 2200 }, { month: 'Jan', price: 2050 },
      { month: 'Feb', price: 1900 }, { month: 'Mar', price: 1850 }, { month: 'Apr', price: 1740 },
    ],
    sales: [
      { date: 'Apr 15', price: 1760, platform: 'eBay' }, { date: 'Apr 12', price: 1720, platform: 'eBay' },
      { date: 'Apr 9', price: 1780, platform: 'eBay' }, { date: 'Apr 5', price: 1800, platform: 'PWCC' },
      { date: 'Apr 1', price: 1850, platform: 'eBay' },
    ],
  },
  {
    id: 'eevee-promo-psa10',
    name: 'Eevee',
    set: 'Black Star Promo',
    grade: 'PSA 10',
    price: 680,
    change: 24.8,
    trend: 'up',
    score: 79,
    breakdown: { growth: 88, liquidity: 62, volatility: 68, demand: 85 },
    verdict: 'Emerging breakout candidate. Eevee Black Star Promo PSA 10 is benefiting from growing nostalgia demand and limited PSA 10 population. Strong social media presence is driving new collector interest. Recommend monitoring for sustained volume confirmation.',
    verdictShort: 'Breakout momentum. Low supply driving gains.',
    rarity: 'Promo', year: '1999', emoji: '⭐',
    history: [
      { month: 'May', price: 420 }, { month: 'Jun', price: 430 }, { month: 'Jul', price: 455 },
      { month: 'Aug', price: 440 }, { month: 'Sep', price: 470 }, { month: 'Oct', price: 490 },
      { month: 'Nov', price: 520 }, { month: 'Dec', price: 545 }, { month: 'Jan', price: 580 },
      { month: 'Feb', price: 610 }, { month: 'Mar', price: 650 }, { month: 'Apr', price: 680 },
    ],
    sales: [
      { date: 'Apr 13', price: 695, platform: 'eBay' }, { date: 'Apr 10', price: 670, platform: 'eBay' },
      { date: 'Apr 6', price: 680, platform: 'eBay' }, { date: 'Mar 30', price: 645, platform: 'PWCC' },
      { date: 'Mar 25', price: 640, platform: 'eBay' },
    ],
  },
  {
    id: 'pikachu-illustrator',
    name: 'Pikachu Illustrator',
    set: 'CoroCoro Promo',
    grade: 'PSA 9',
    price: 385000,
    change: 5.1,
    trend: 'up',
    score: 95,
    breakdown: { growth: 94, liquidity: 82, volatility: 88, demand: 99 },
    verdict: 'Trophy asset. Pikachu Illustrator represents the apex of the Pokemon card market with only 39 copies ever distributed. Each sale is a market-defining event. Near-flawless specimens command exponential premiums. This is a generational hold for serious collectors.',
    verdictShort: 'Trophy-tier. Generational collector asset.',
    rarity: 'Illustration Contest Promo', year: '1998', emoji: '⚡',
    history: [
      { month: 'May', price: 320000 }, { month: 'Jun', price: 325000 }, { month: 'Jul', price: 318000 },
      { month: 'Aug', price: 335000 }, { month: 'Sep', price: 348000 }, { month: 'Oct', price: 360000 },
      { month: 'Nov', price: 355000 }, { month: 'Dec', price: 370000 }, { month: 'Jan', price: 375000 },
      { month: 'Feb', price: 368000 }, { month: 'Mar', price: 378000 }, { month: 'Apr', price: 385000 },
    ],
    sales: [
      { date: 'Apr 14', price: 390000, platform: 'Heritage' }, { date: 'Feb 20', price: 375000, platform: 'PWCC' },
      { date: 'Nov 12', price: 360000, platform: 'Heritage' }, { date: 'Aug 5', price: 342000, platform: 'eBay' },
      { date: 'May 18', price: 325000, platform: 'Heritage' },
    ],
  },
]

export const getCard = (id: string) => cards.find(c => c.id === id)

export const rising = [
  { id: 'eevee-promo-psa10', name: 'Eevee Black Star Promo', grade: 'PSA 10', change: 24.8, score: 79 },
  { id: 'charizard-base-psa9', name: 'Charizard Base Set', grade: 'PSA 9', change: 12.4, score: 87 },
  { id: 'pikachu-illustrator', name: 'Pikachu Illustrator', grade: 'PSA 9', change: 5.1, score: 95 },
  { id: 'charizard-base-psa9', name: 'Mewtwo Base Set', grade: 'PSA 10', change: 9.3, score: 81 },
  { id: 'charizard-base-psa9', name: 'Blastoise Base Set', grade: 'PSA 9', change: 7.6, score: 74 },
]

export const declining = [
  { id: 'lugia-v-alt-psa10', name: 'Lugia V Alt Art', grade: 'PSA 10', change: -8.2, score: 71 },
  { id: 'lugia-v-alt-psa10', name: 'Umbreon VMAX Alt Art', grade: 'PSA 10', change: -11.4, score: 63 },
  { id: 'lugia-v-alt-psa10', name: 'Charizard VMAX Rainbow', grade: 'PSA 10', change: -6.8, score: 68 },
  { id: 'lugia-v-alt-psa10', name: 'Rayquaza Gold Star', grade: 'PSA 10', change: -4.2, score: 77 },
  { id: 'lugia-v-alt-psa10', name: 'Gengar Holo 1st Ed', grade: 'PSA 10', change: -3.1, score: 72 },
]

export const traded = [
  { id: 'charizard-base-psa9', name: 'Charizard Base Set', grade: 'PSA 9', volume: 284, score: 87 },
  { id: 'lugia-v-alt-psa10', name: 'Lugia V Alt Art', grade: 'PSA 10', volume: 211, score: 71 },
  { id: 'lugia-v-alt-psa10', name: 'Umbreon VMAX Alt Art', grade: 'PSA 10', volume: 198, score: 63 },
  { id: 'pikachu-illustrator', name: 'Pikachu Illustrator', grade: 'PSA 9', volume: 12, score: 95 },
  { id: 'eevee-promo-psa10', name: 'Eevee Black Star Promo', grade: 'PSA 10', volume: 97, score: 79 },
]

export const ticker = [
  { name: 'Charizard PSA 9', price: 4850, change: 12.4 },
  { name: 'Lugia V Alt PSA 10', price: 1740, change: -8.2 },
  { name: 'Pikachu Illustrator PSA 9', price: 385000, change: 5.1 },
  { name: 'Eevee Promo PSA 10', price: 680, change: 24.8 },
  { name: 'Umbreon VMAX PSA 10', price: 2100, change: -11.4 },
  { name: 'Mewtwo Base PSA 10', price: 3200, change: 9.3 },
  { name: 'Blastoise Base PSA 9', price: 1850, change: 7.6 },
  { name: 'Rayquaza Gold Star PSA 10', price: 4200, change: -4.2 },
  { name: 'Gengar 1st Ed PSA 10', price: 8900, change: -3.1 },
]

export const fmt = (n: number): string => {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + n.toLocaleString()
  return '$' + n
}

export const scoreColor = (s: number): string =>
  s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'

export const scoreLabel = (s: number): string =>
  s >= 80 ? 'Strong' : s >= 60 ? 'Moderate' : 'Weak'
