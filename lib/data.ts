export interface Card {
  id: string
  name: string
  set: string
  cardNumber: string
  imageUrl: string
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
  tags: string[]
  history: { month: string; price: number }[]
  sales: { date: string; price: number; platform: string }[]
  // Analysis data
  marketAvg: number
  priceRange90d: { min: number; max: number }
  volatilityPct: number
  volatilityLabel: string
  liquidityScore: number
  liquidityLabel: string
  liquidityDesc: string
  trendPct: number
  trendLabel: string
  holdScore: number
  holdVerdict: string
  holdDescription: string
  monthlyGrowth: number
  projections: {
    m3: { price: number; pct: number }
    m6: { price: number; pct: number }
    m12: { price: number; pct: number }
  }
  holdFactors: { title: string; description: string }[]
  aiInsights: string[]
  ebayListings: { title: string; date: string; price: number; badge?: 'HIGH' | 'LOW' }[]
}

export const cards: Card[] = [
  {
    id: 'charizard-base-psa9',
    name: 'Charizard',
    set: 'Base Set',
    cardNumber: '4/102',
    imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
    grade: 'PSA 9',
    price: 4850,
    change: 12.4,
    trend: 'up',
    score: 87,
    breakdown: { growth: 91, liquidity: 88, volatility: 72, demand: 96 },
    verdict: 'Bullish long-term outlook. Charizard Base Set PSA 9 continues to demonstrate exceptional collector demand with consistent appreciation over 18 months. Low circulating supply relative to demand, combined with strong cultural relevance, suggests continued upward pressure on prices.',
    verdictShort: 'Strong collector demand. Consistent appreciation.',
    rarity: 'Holo Rare', year: '1999', emoji: '🔥',
    tags: ['Holo Rare', 'Pokémon', 'Stage 2', 'Base Set'],
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
    marketAvg: 5100,
    priceRange90d: { min: 4200, max: 5800 },
    volatilityPct: 23,
    volatilityLabel: 'Moderate',
    liquidityScore: 88,
    liquidityLabel: 'High',
    liquidityDesc: 'High sales activity with consistent collector demand. PSA 9 copies sell within days when priced at or below market value, driven by sustained multi-generational interest in Base Set Charizard.',
    trendPct: 27.4,
    trendLabel: 'Rising',
    holdScore: 87,
    holdVerdict: 'STRONG HOLD',
    holdDescription: 'Base Set Charizard remains the cornerstone of Pokémon card collecting with sustained appreciation across all grades. PSA 9\'s rarity premium and strong floor support makes this an exceptional long-term hold. Cultural relevance shows no signs of decline.',
    monthlyGrowth: 3.2,
    projections: {
      m3: { price: 5560, pct: 15 },
      m6: { price: 6380, pct: 32 },
      m12: { price: 8400, pct: 73 },
    },
    holdFactors: [
      { title: 'Iconic Character Premium', description: 'Charizard remains the most collected Pokémon with multi-generational demand. Base Set provenance and original 1999 English release carry lasting historical significance.' },
      { title: 'PSA 9 Population Scarcity', description: 'Centering and surface defects limit PSA 9 population growth. Limited new supply from existing card stock maintains upward price pressure.' },
      { title: 'Cultural Resilience', description: 'Pokémon franchise continues growing with new generations of fans, expanding the collector base that drives demand for iconic vintage cards.' },
    ],
    aiInsights: [
      'Exact sold prices: $4,780–$4,900 AUD across eBay and PWCC in the last 30 days. Each sale closing above the prior month\'s average.',
      'Price momentum accelerating with pattern consistent with supply shock — fewer PSA 9s returning from grading submissions.',
      'Raw ungraded copies in comparable condition selling at $1,200–$1,800 AUD. PSA 9 represents a 3–4x premium over raw.',
      'Data quality: Strong. 5 sold listings in 30-day window providing reliable market pricing signal.',
    ],
    ebayListings: [
      { title: 'Pokemon 1999 Base Set Charizard #4 PSA 9 MINT', date: 'Apr 14, 2026', price: 4900, badge: 'HIGH' },
      { title: 'Charizard Base Set 4/102 Holo Rare PSA 9', date: 'Apr 11, 2026', price: 4820 },
      { title: 'Pokemon Charizard Base Set Holo Rare PSA 9', date: 'Apr 8, 2026', price: 4780 },
      { title: '1999 Pokemon Base Set Charizard Holo PSA 9 MINT', date: 'Apr 3, 2026', price: 4850 },
      { title: 'Charizard Base Set 1999 Holo Rare PSA 9 Mint', date: 'Mar 28, 2026', price: 4700 },
    ],
  },
  {
    id: 'lugia-v-alt-psa10',
    name: 'Lugia V Alt Art',
    set: 'Silver Tempest',
    cardNumber: 'TG30/TG30',
    imageUrl: 'https://images.pokemontcg.io/swsh12/186_hires.png',
    grade: 'PSA 10',
    price: 1740,
    change: -8.2,
    trend: 'down',
    score: 71,
    breakdown: { growth: 58, liquidity: 74, volatility: 45, demand: 82 },
    verdict: 'Short-term correction underway. Lugia V Alt Art PSA 10 experienced post-release price compression typical of modern chase cards. Supply is normalising as more PSA 10s return from grading. The card retains strong collector appeal with floor support likely around $1,500.',
    verdictShort: 'Post-release correction. Floor forming.',
    rarity: 'Alt Art Ultra Rare', year: '2022', emoji: '🌊',
    tags: ['Alt Art Ultra Rare', 'Pokémon V', 'Basic', 'Trainer Gallery'],
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
    marketAvg: 1950,
    priceRange90d: { min: 1580, max: 2350 },
    volatilityPct: 34,
    volatilityLabel: 'Volatile',
    liquidityScore: 74,
    liquidityLabel: 'Moderate',
    liquidityDesc: 'Moderate sales activity with demand influenced by market sentiment. PSA 10 copies require competitive pricing to sell within 2 weeks. Activity is trending lower as correction continues.',
    trendPct: -27.5,
    trendLabel: 'Falling',
    holdScore: 71,
    holdVerdict: 'HOLD',
    holdDescription: 'Post-release correction is compressing prices as PSA 10 grading returns normalize supply. Floor around $1,500 AUD is supported by strong collector appeal. Monitor for volume stabilization before adding more.',
    monthlyGrowth: -2.1,
    projections: {
      m3: { price: 1630, pct: -6 },
      m6: { price: 1520, pct: -13 },
      m12: { price: 1800, pct: 3 },
    },
    holdFactors: [
      { title: 'Post-Release Supply Pressure', description: 'Ongoing PSA returns from Silver Tempest submissions increasing PSA 10 population, suppressing short-term price. 3,400+ PSA 10 copies graded to date.' },
      { title: 'Strong Collector Floor', description: 'Lugia\'s nostalgic appeal creates consistent floor support. Alt Art treatment with premium artwork maintains long-term demand despite short-term correction.' },
      { title: 'Modern Set Population Risk', description: 'Modern sets face print run uncertainty. Population reports will be critical over next 6 months for establishing accurate price trajectory.' },
    ],
    aiInsights: [
      'Exact sold prices: $1,720–$1,800 AUD in last 30 days. Prices declining approximately $50–80 per week.',
      'PSA population data shows 3,400+ PSA 10 copies graded with more expected from ongoing submissions creating continued supply pressure.',
      'CAUTION: Downward trend is technical correction, not fundamental breakdown. $1,500 AUD floor has historically held across three separate tests.',
      'Data quality: Good. 5 sold listings in 30-day window. Sufficient for short-term analysis but limited for long-term projections.',
    ],
    ebayListings: [
      { title: 'Pokemon Silver Tempest Lugia V Alt Art TG30 PSA 10 GEM MINT', date: 'Apr 15, 2026', price: 1760, badge: 'HIGH' },
      { title: 'Lugia V Alt Art TG30/TG30 PSA 10', date: 'Apr 12, 2026', price: 1720 },
      { title: 'Silver Tempest Lugia V Trainer Gallery Alt Art PSA 10', date: 'Apr 9, 2026', price: 1780 },
      { title: 'Pokemon Lugia V TG30 Alt Art PSA 10 Gem Mint', date: 'Apr 5, 2026', price: 1800 },
      { title: 'Lugia V Alt Art PSA 10 Silver Tempest TG30/TG30', date: 'Apr 1, 2026', price: 1850 },
    ],
  },
  {
    id: 'eevee-promo-psa10',
    name: 'Eevee',
    set: 'Black Star Promo',
    cardNumber: 'SM229',
    imageUrl: 'https://images.pokemontcg.io/smp/SM184_hires.png',
    grade: 'PSA 10',
    price: 680,
    change: 24.8,
    trend: 'up',
    score: 79,
    breakdown: { growth: 88, liquidity: 62, volatility: 68, demand: 85 },
    verdict: 'Emerging breakout candidate. Eevee Black Star Promo PSA 10 is benefiting from growing nostalgia demand and limited PSA 10 population. Strong social media presence is driving new collector interest. Recommend monitoring for sustained volume confirmation.',
    verdictShort: 'Breakout momentum. Low supply driving gains.',
    rarity: 'Promo', year: '1999', emoji: '⭐',
    tags: ['Black Star Promo', 'Pokémon', 'Basic', '1999 Vintage'],
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
    marketAvg: 720,
    priceRange90d: { min: 580, max: 810 },
    volatilityPct: 28,
    volatilityLabel: 'Moderate',
    liquidityScore: 62,
    liquidityLabel: 'Moderate',
    liquidityDesc: 'Moderate sales activity with growing demand from nostalgia-driven collectors. PSA 10 copies are scarce and typically sell within 1–2 weeks at market pricing. Volume increasing with momentum.',
    trendPct: 47.8,
    trendLabel: 'Rising',
    holdScore: 79,
    holdVerdict: 'STRONG HOLD',
    holdDescription: 'Emerging breakout fueled by nostalgia demand and extremely limited PSA 10 supply. Fewer than 200 PSA 10 copies exist. Social media exposure continuing to drive new collector discovery.',
    monthlyGrowth: 5.1,
    projections: {
      m3: { price: 784, pct: 15 },
      m6: { price: 893, pct: 31 },
      m12: { price: 1105, pct: 63 },
    },
    holdFactors: [
      { title: 'Extreme PSA 10 Scarcity', description: 'Fewer than 200 PSA 10 copies in population report. Eevee promo cards are notoriously difficult to grade gem due to centering issues on original print run.' },
      { title: 'Nostalgia Breakout Momentum', description: 'Social media collector platforms driving new demand from 25–35 year olds rediscovering childhood Pokémon. Eevee\'s broad appeal across generations amplifies this effect.' },
      { title: '1999 Vintage Premium', description: 'Black Star Promo cards from 1999 carry increasing vintage premium. Early Pokémon merchandise is gaining recognition as historically significant collectibles.' },
    ],
    aiInsights: [
      'Exact sold prices: $640–$695 AUD in last 30 days. Accelerating appreciation of approximately $15 per week.',
      'Population report: 189 PSA 10 copies confirmed as of last check. Grade 10 submission rate approximately 8% — extremely low.',
      'Breakout confirmed: Three consecutive months of new price highs. Pattern consistent with supply-constrained appreciation cycle.',
      'Data quality: Moderate. 5 sold listings in 30 days. Limited data creates uncertainty but confirms upward direction.',
    ],
    ebayListings: [
      { title: 'Pokemon SM229 Eevee Black Star Promo PSA 10 GEM MINT', date: 'Apr 13, 2026', price: 695, badge: 'HIGH' },
      { title: 'Eevee SM229 Black Star Promo PSA 10 Gem Mint', date: 'Apr 10, 2026', price: 670 },
      { title: 'Pokemon Black Star Promo Eevee PSA 10 GEM MINT', date: 'Apr 6, 2026', price: 680 },
      { title: 'Eevee Promo SM229 PSA 10 Pokemon', date: 'Mar 30, 2026', price: 645 },
      { title: '1999 Pokemon Eevee Black Star Promo PSA 10 Vintage', date: 'Mar 25, 2026', price: 640 },
    ],
  },
  {
    id: 'pikachu-illustrator',
    name: 'Pikachu Illustrator',
    set: 'CoroCoro Promo',
    cardNumber: 'Promo',
    imageUrl: '',
    grade: 'PSA 9',
    price: 385000,
    change: 5.1,
    trend: 'up',
    score: 95,
    breakdown: { growth: 94, liquidity: 82, volatility: 88, demand: 99 },
    verdict: 'Trophy asset. Pikachu Illustrator represents the apex of the Pokemon card market with only 39 copies ever distributed. Each sale is a market-defining event. Near-flawless specimens command exponential premiums. This is a generational hold for serious collectors.',
    verdictShort: 'Trophy-tier. Generational collector asset.',
    rarity: 'Illustration Contest Promo', year: '1998', emoji: '⚡',
    tags: ['Illustration Contest Promo', 'Pikachu', 'Basic', 'Ultra Rare Unique'],
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
    marketAvg: 400000,
    priceRange90d: { min: 342000, max: 435000 },
    volatilityPct: 12,
    volatilityLabel: 'Stable',
    liquidityScore: 15,
    liquidityLabel: 'Very Low',
    liquidityDesc: 'Extremely low sales frequency due to one-of-a-kind rarity. Only 39 copies exist globally. Each sale is a market-defining event occurring months apart. Buyers must be patient — liquidity is not a viable strategy at this tier.',
    trendPct: 20.3,
    trendLabel: 'Rising',
    holdScore: 95,
    holdVerdict: 'GENERATIONAL HOLD',
    holdDescription: 'The apex of Pokémon collecting. With only 39 copies worldwide, Pikachu Illustrator represents an irreplaceable trophy asset. Price trajectory follows steady appreciation with multi-decade holding potential. This is not a trade — it is a legacy acquisition.',
    monthlyGrowth: 1.8,
    projections: {
      m3: { price: 420000, pct: 9 },
      m6: { price: 440000, pct: 14 },
      m12: { price: 485000, pct: 26 },
    },
    holdFactors: [
      { title: 'Absolute Scarcity', description: 'Only 39 copies exist worldwide. Supply can never increase. As global wealth grows and Pokémon collecting expands, demand will structurally outpace supply forever.' },
      { title: 'Cultural Icon Status', description: 'Pikachu is the face of the most valuable media franchise in history. The Illustrator holds unique cultural significance as the rarest known Pokémon card ever produced.' },
      { title: 'Trophy Asset Premium', description: 'Ultra-high value collectibles attract trophy buyers paying significant premiums. Each sale sets a new benchmark and attracts media attention that drives the next acquisition.' },
    ],
    aiInsights: [
      'Exact sold prices: $325,000–$390,000 USD via Heritage Auctions and PWCC across the last 12 months.',
      'Sales frequency: 3–5 sales per year globally. Price discovery is inherently limited by the extreme rarity of transactions.',
      'BGS Black Label copies with perfect centering have not transacted publicly. Expected value significantly higher than PSA 9.',
      'Data quality: Very limited. Fewer than 5 sales in any analysis window. Treat all projections as directional indicators only.',
    ],
    ebayListings: [
      { title: 'Pikachu Illustrator CoroCoro Promo PSA 9 MINT — 1998', date: 'Apr 14, 2026', price: 390000, badge: 'HIGH' },
      { title: 'Pikachu Illustrator PSA 9 — Heritage Auctions', date: 'Feb 20, 2026', price: 375000 },
      { title: '1998 Pikachu Illustrator Contest Promo PSA 9', date: 'Nov 12, 2025', price: 360000 },
      { title: 'Pokemon Pikachu Illustrator PSA 9 — PWCC Auction', date: 'Aug 5, 2025', price: 342000 },
      { title: 'Pikachu Illustrator CoroCoro 1998 PSA 9 Original', date: 'May 18, 2025', price: 325000 },
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
