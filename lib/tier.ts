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
  emailAlerts: boolean
  realtimeAlerts: boolean
  advancedAnalytics: boolean
  portfolioTracking: boolean
  dataExport: boolean
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    watchlist: 5,
    savedSearches: 0,
    priceHistory: false,
    trendIndicators: false,
    emailAlerts: false,
    realtimeAlerts: false,
    advancedAnalytics: false,
    portfolioTracking: false,
    dataExport: false,
  },
  standard: {
    watchlist: 30,
    savedSearches: 10,
    priceHistory: true,
    trendIndicators: true,
    emailAlerts: true,
    realtimeAlerts: false,
    advancedAnalytics: false,
    portfolioTracking: false,
    dataExport: false,
  },
  pro: {
    watchlist: 100,
    savedSearches: Infinity,
    priceHistory: true,
    trendIndicators: true,
    emailAlerts: true,
    realtimeAlerts: true,
    advancedAnalytics: true,
    portfolioTracking: true,
    dataExport: true,
  },
}

export function getTierLimits(tier: string | null | undefined): TierLimits {
  return TIER_LIMITS[(tier as Tier) ?? 'free'] ?? TIER_LIMITS.free
}
