/**
 * Centralised tier limits and feature flags.
 *
 * Single source of truth — import from here everywhere limits are needed
 * (watchlist route, admin checks, UI copy, etc.)
 */

export type Tier = 'free' | 'standard' | 'pro'

export interface TierLimits {
  watchlist: number      // max watchlist entries
  savedSearches: number  // max saved searches
  priceHistory: boolean  // access to full price history charts
  trendIndicators: boolean
  priceCheck: boolean    // enter a custom price for analysis
  advancedAnalytics: boolean
  compare: boolean       // card comparison tool
  portfolioTracking: boolean
  dataExport: boolean
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    watchlist: 5,
    savedSearches: 0,
    priceHistory: false,
    trendIndicators: false,
    priceCheck: false,
    advancedAnalytics: false,
    compare: false,
    portfolioTracking: false,
    dataExport: false,
  },
  standard: {
    watchlist: 30,
    savedSearches: 10,
    priceHistory: true,
    trendIndicators: true,
    priceCheck: true,
    advancedAnalytics: true,
    compare: false,
    portfolioTracking: false,
    dataExport: false,
  },
  pro: {
    watchlist: 100,
    savedSearches: Infinity,
    priceHistory: true,
    trendIndicators: true,
    priceCheck: true,
    advancedAnalytics: true,
    compare: true,
    portfolioTracking: true,
    dataExport: true,
  },
}

export function getTierLimits(tier: string | null | undefined): TierLimits {
  return TIER_LIMITS[(tier as Tier) ?? 'free'] ?? TIER_LIMITS.free
}
