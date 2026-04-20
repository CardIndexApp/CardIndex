'use client'
/**
 * Currency context — provides client-side USD → target currency conversion.
 *
 * SQL migration required:
 *   ALTER TABLE profiles
 *     ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD';
 *
 * Exchange rates are fetched once per session from /api/fx (which proxies
 * open.er-api.com with a 1-hour server-side cache). Rates are also stored
 * in sessionStorage so they survive same-tab navigation without extra fetches.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Supported currencies ──────────────────────────────────────────────────────

export const CURRENCIES = {
  USD: { symbol: '$',    label: 'US Dollar',          decimals: 2 },
  EUR: { symbol: '€',    label: 'Euro',               decimals: 2 },
  GBP: { symbol: '£',    label: 'British Pound',      decimals: 2 },
  AUD: { symbol: 'A$',   label: 'Australian Dollar',  decimals: 2 },
  CAD: { symbol: 'C$',   label: 'Canadian Dollar',    decimals: 2 },
  JPY: { symbol: '¥',    label: 'Japanese Yen',       decimals: 0 },
  NZD: { symbol: 'NZ$',  label: 'New Zealand Dollar', decimals: 2 },
  SGD: { symbol: 'S$',   label: 'Singapore Dollar',   decimals: 2 },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

const RATES_SESSION_KEY = 'ci_fx_rates'

async function loadRates(): Promise<Record<string, number>> {
  try {
    const cached = sessionStorage.getItem(RATES_SESSION_KEY)
    if (cached) return JSON.parse(cached) as Record<string, number>
  } catch {}
  try {
    const res = await fetch('/api/fx')
    if (!res.ok) throw new Error('fetch failed')
    const json = await res.json()
    const rates = json.rates as Record<string, number>
    try { sessionStorage.setItem(RATES_SESSION_KEY, JSON.stringify(rates)) } catch {}
    return rates
  } catch {
    return { USD: 1, EUR: 0.92, GBP: 0.79, AUD: 1.54, CAD: 1.37, JPY: 149.5, NZD: 1.64, SGD: 1.34 }
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface CurrencyCtx {
  /** Active currency code */
  currency: CurrencyCode
  /** Exchange rates keyed by currency code (base = USD) */
  rates: Record<string, number>
  /** True while rates / user preference are loading */
  ratesLoading: boolean
  /** Change the active currency and persist to the user's profile */
  setCurrency: (c: CurrencyCode) => void
  /** Convert a USD amount to the active currency */
  convert: (usdAmount: number) => number
  /** Format a USD amount in the active currency (e.g. "A$158.40") */
  fmtCurrency: (usdAmount: number) => string
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: 'USD',
  rates: { USD: 1 },
  ratesLoading: false,
  setCurrency: () => {},
  convert: v => v,
  fmtCurrency: v => `$${v.toFixed(2)}`,
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD')
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 })
  const [ratesLoading, setRatesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const [fetchedRates] = await Promise.all([
        loadRates(),
        // Load user preference in parallel
        (async () => {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
              .from('profiles')
              .select('preferred_currency')
              .eq('id', user.id)
              .single()
            if (!cancelled && data?.preferred_currency) {
              setCurrencyState(data.preferred_currency as CurrencyCode)
            }
          } catch {}
        })(),
      ])
      if (!cancelled) {
        setRates(fetchedRates)
        setRatesLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c)
    // Persist async — fire and forget
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('profiles').update({ preferred_currency: c }).eq('id', user.id)
        }
      } catch {}
    })()
  }, [])

  const convert = useCallback(
    (usdAmount: number) => usdAmount * (rates[currency] ?? 1),
    [currency, rates]
  )

  const fmtCurrency = useCallback(
    (usdAmount: number) => {
      const amount = convert(usdAmount)
      const meta = CURRENCIES[currency]
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      })
      return `${meta.symbol}${formatted}`
    },
    [convert, currency]
  )

  return (
    <CurrencyContext.Provider value={{ currency, rates, ratesLoading, setCurrency, convert, fmtCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
