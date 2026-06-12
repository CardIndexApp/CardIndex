'use client'
import { useState } from 'react'
import { useCurrency } from '@/lib/currency'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolTab = 'fee' | 'roi' | 'grading'
type Platform = 'ebay' | 'tcgplayer' | 'facebook'
type Grader = 'psa' | 'bgs' | 'cgc'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parse(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0
}

function fmt(n: number, symbol: string): string {
  if (!isFinite(n) || n < 0) return `${symbol}0.00`
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolInput({
  label,
  value,
  onChange,
  symbol,
  placeholder = '0.00',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  symbol: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1, color: 'var(--ink3)', marginBottom: 6 }}>
        {label.toUpperCase()}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: focused ? 'var(--gold)' : 'var(--ink3)', pointerEvents: 'none', transition: 'color 0.15s' }}>
          {symbol}
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: `12px 14px 12px ${symbol.length > 1 ? '32px' : '26px'}`,
            borderRadius: 10,
            background: 'var(--surface2)',
            border: `1px solid ${focused ? 'var(--gold)' : 'var(--border2)'}`,
            color: 'var(--ink)',
            fontSize: 16,
            fontWeight: 700,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
      </div>
    </div>
  )
}

function ResultRow({
  label,
  value,
  color = 'var(--ink)',
  bold = false,
}: {
  label: string
  value: string
  color?: string
  bold?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--ink3)', flex: 1 }}>{label}</span>
      <span className="font-num" style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? 700 : 600, color }}>{value}</span>
    </div>
  )
}

function SurfaceCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function InputCard({ children }: { children: React.ReactNode }) {
  return (
    <SurfaceCard>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </SurfaceCard>
  )
}

function ResultsCard({ children }: { children: React.ReactNode }) {
  return (
    <SurfaceCard>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </SurfaceCard>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      onClick={() => onChange(!checked)}
    >
      <span style={{ fontSize: 14, color: 'var(--ink2)' }}>{label}</span>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: checked ? 'var(--gold)' : 'var(--surface2)',
        border: `1px solid ${checked ? 'var(--gold)' : 'var(--border2)'}`,
        position: 'relative', transition: 'all 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: checked ? '#080810' : 'var(--ink3)',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}

function ChipGroup<T extends string>({
  options,
  active,
  onSelect,
  label,
}: {
  options: { value: T; label: string; color?: string }[]
  active: T
  onSelect: (v: T) => void
  label: string
}) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--ink3)', marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            style={{
              padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: active === o.value ? 700 : 400,
              background: active === o.value ? (o.color ?? 'var(--gold)') : 'var(--surface2)',
              color: active === o.value ? '#080810' : 'var(--ink3)',
              outline: `1px solid ${active === o.value ? (o.color ?? 'var(--gold)') : 'var(--border2)'}`,
              transition: 'all 0.15s',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Fee Calculator ─────────────────────────────────────────────────────────────

const PLATFORMS: { value: Platform; label: string; rate: number; fixed: number; color: string }[] = [
  { value: 'ebay',      label: 'eBay',      rate: 0.1325, fixed: 0.30, color: '#e53238' },
  { value: 'tcgplayer', label: 'TCGPlayer', rate: 0.1025, fixed: 0.00, color: '#e5a823' },
  { value: 'facebook',  label: 'Facebook',  rate: 0.00,   fixed: 0.00, color: '#1877f2' },
]

function FeeCalculator() {
  const { fmtCurrency } = useCurrency()
  const sym = '$'

  const [salePriceText,     setSalePriceText]     = useState('')
  const [platform,          setPlatform]          = useState<Platform>('ebay')
  const [includeShipping,   setIncludeShipping]   = useState(false)
  const [shippingText,      setShippingText]      = useState('')
  const [purchasePriceText, setPurchasePriceText] = useState('')

  const salePrice     = parse(salePriceText)
  const shipping      = parse(shippingText)
  const purchasePrice = parse(purchasePriceText)
  const plat          = PLATFORMS.find(p => p.value === platform)!
  const totalSale     = salePrice + (includeShipping ? shipping : 0)
  const platformFee   = totalSale * plat.rate + plat.fixed
  const netProceeds   = Math.max(0, salePrice - platformFee - (includeShipping ? shipping : 0))
  const profit        = purchasePrice > 0 ? netProceeds - purchasePrice : 0
  const roi           = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InputCard>
        <ToolInput label="Sale price" value={salePriceText} onChange={setSalePriceText} symbol={sym} />

        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--ink3)', marginBottom: 8 }}>PLATFORM</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                style={{
                  padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: platform === p.value ? 700 : 400,
                  background: platform === p.value ? p.color : 'var(--surface2)',
                  color: platform === p.value ? '#fff' : 'var(--ink3)',
                  outline: `1px solid ${platform === p.value ? p.color : 'var(--border2)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Toggle label="Include shipping in fee" checked={includeShipping} onChange={setIncludeShipping} />

        {includeShipping && (
          <ToolInput label="Shipping cost" value={shippingText} onChange={setShippingText} symbol={sym} />
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <ToolInput label="Purchase price (optional)" value={purchasePriceText} onChange={setPurchasePriceText} symbol={sym} />
        </div>
      </InputCard>

      {salePrice > 0 && (
        <ResultsCard>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 4 }}>NET PROCEEDS</div>
            <div className="font-num" style={{ fontSize: 36, fontWeight: 800, color: 'var(--green)', letterSpacing: '-1px' }}>
              {fmt(netProceeds, sym)}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ResultRow
              label={`${plat.label} fee (${(plat.rate * 100).toFixed(2)}%${plat.fixed > 0 ? ` + $${plat.fixed.toFixed(2)}` : ''})`}
              value={`−${fmt(platformFee, sym)}`}
              color="var(--red)"
            />
            {includeShipping && shipping > 0 && (
              <ResultRow label="Shipping (not in fee)" value={fmt(shipping, sym)} color="var(--ink3)" />
            )}
            {purchasePrice > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <ResultRow
                  label="Profit / Loss"
                  value={`${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit), sym)}`}
                  color={profit >= 0 ? 'var(--green)' : 'var(--red)'}
                  bold
                />
                <ResultRow
                  label="ROI"
                  value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
                  color={roi >= 0 ? 'var(--green)' : 'var(--red)'}
                  bold
                />
              </>
            )}
          </div>
        </ResultsCard>
      )}
    </div>
  )
}

// ── ROI / Break-even Calculator ───────────────────────────────────────────────

function ROICalculator() {
  const sym = '$'

  const [purchasePriceText, setPurchasePriceText] = useState('')
  const [currentPriceText,  setCurrentPriceText]  = useState('')
  const [includeFees,       setIncludeFees]        = useState(true)
  const [feeRate,           setFeeRate]            = useState(13.25)

  const purchasePrice = parse(purchasePriceText)
  const currentPrice  = parse(currentPriceText)
  const feeMultiplier = 1 - (includeFees ? feeRate / 100 : 0)
  const netCurrent    = currentPrice * feeMultiplier
  const profit        = purchasePrice > 0 ? netCurrent - purchasePrice : 0
  const roi           = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0
  const breakEven     = purchasePrice > 0 ? purchasePrice / feeMultiplier : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InputCard>
        <ToolInput label="Purchase price" value={purchasePriceText} onChange={setPurchasePriceText} symbol={sym} />
        <ToolInput label="Current / target price" value={currentPriceText} onChange={setCurrentPriceText} symbol={sym} />

        <Toggle label="Deduct platform fees" checked={includeFees} onChange={setIncludeFees} />

        {includeFees && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--ink2)' }}>Fee rate</span>
              <span className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                {feeRate.toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.25"
              value={feeRate}
              onChange={e => setFeeRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)', height: 4, cursor: 'pointer' }}
            />
          </div>
        )}
      </InputCard>

      {purchasePrice > 0 && (
        <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 4 }}>BREAK-EVEN PRICE</div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.5px' }}>
                {fmt(breakEven, sym)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                {includeFees ? 'Price needed to cover cost + fees' : 'Price needed to cover cost'}
              </div>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(232,197,71,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 17 17 7"/><polyline points="7 7 17 7 17 17"/>
            </svg>
          </div>
        </div>
      )}

      {purchasePrice > 0 && currentPrice > 0 && (
        <ResultsCard>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 4 }}>RETURN ON INVESTMENT</div>
            <div className="font-num" style={{ fontSize: 40, fontWeight: 800, color: profit >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-1px' }}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {includeFees && (
              <ResultRow label="Net after fees" value={fmt(netCurrent, sym)} color="var(--ink)" />
            )}
            <ResultRow
              label="Profit / Loss"
              value={`${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit), sym)}`}
              color={profit >= 0 ? 'var(--green)' : 'var(--red)'}
              bold
            />
          </div>
        </ResultsCard>
      )}
    </div>
  )
}

// ── Grading ROI Calculator ────────────────────────────────────────────────────

const GRADE_OPTIONS: Record<Grader, string[]> = {
  psa: ['PSA 10', 'PSA 9', 'PSA 8'],
  bgs: ['BGS 10', 'BGS 9.5', 'BGS 9', 'BGS 8.5'],
  cgc: ['CGC 10', 'CGC 9.5', 'CGC 9'],
}

function GradingROI() {
  const sym = '$'

  const [rawPriceText,    setRawPriceText]    = useState('')
  const [gradedValueText, setGradedValueText] = useState('')
  const [gradingCostText, setGradingCostText] = useState('25')
  const [shippingText,    setShippingText]    = useState('15')
  const [grader,          setGrader]          = useState<Grader>('psa')
  const [expectedGrade,   setExpectedGrade]   = useState('PSA 10')
  const [sellFeeRate,     setSellFeeRate]      = useState(13.25)

  const rawPrice    = parse(rawPriceText)
  const gradedValue = parse(gradedValueText)
  const gradingCost = parse(gradingCostText)
  const shipping    = parse(shippingText)
  const totalCost   = rawPrice + gradingCost + shipping
  const netSale     = gradedValue * (1 - sellFeeRate / 100)
  const profit      = netSale - totalCost
  const roi         = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const breakEven   = totalCost > 0 ? totalCost / (1 - sellFeeRate / 100) : 0
  const worthGrading = gradedValue > 0 && profit > 0

  function handleGraderChange(g: Grader) {
    setGrader(g)
    setExpectedGrade(GRADE_OPTIONS[g][0])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info banner */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(232,197,71,0.07)', border: '1px solid rgba(232,197,71,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>
          Look up a card&apos;s graded value in the Price tab, then enter it below.
        </span>
      </div>

      <InputCard>
        <ToolInput label="Raw card price" value={rawPriceText} onChange={setRawPriceText} symbol={sym} />

        <ChipGroup
          label="Grader"
          options={[
            { value: 'psa' as Grader, label: 'PSA' },
            { value: 'bgs' as Grader, label: 'BGS' },
            { value: 'cgc' as Grader, label: 'CGC' },
          ]}
          active={grader}
          onSelect={handleGraderChange}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--ink2)' }}>Expected grade</span>
          <select
            value={expectedGrade}
            onChange={e => setExpectedGrade(e.target.value)}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--gold)', borderRadius: 8, padding: '6px 10px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none',
            }}
          >
            {GRADE_OPTIONS[grader].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <ToolInput label="Graded card value" value={gradedValueText} onChange={setGradedValueText} symbol={sym} />
      </InputCard>

      <InputCard>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>COSTS</div>
        <ToolInput label="Grading fee" value={gradingCostText} onChange={setGradingCostText} symbol={sym} />
        <ToolInput label="Shipping + insurance" value={shippingText} onChange={setShippingText} symbol={sym} />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--ink2)' }}>Sell fee rate</span>
            <span className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
              {sellFeeRate.toFixed(2)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            step="0.25"
            value={sellFeeRate}
            onChange={e => setSellFeeRate(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gold)', height: 4, cursor: 'pointer' }}
          />
        </div>
      </InputCard>

      {(rawPrice > 0 || gradedValue > 0) && (
        <>
          {gradedValue > 0 ? (
            <SurfaceCard>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Verdict banner */}
                <div style={{
                  padding: 14, borderRadius: 12,
                  background: worthGrading ? 'rgba(61,232,138,0.06)' : 'rgba(232,82,74,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: worthGrading ? 'rgba(61,232,138,0.15)' : 'rgba(232,82,74,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 16, color: worthGrading ? 'var(--green)' : 'var(--red)' }}>
                        {worthGrading ? '✓' : '✗'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: worthGrading ? 'var(--green)' : 'var(--red)' }}>
                        {worthGrading ? 'Worth grading' : 'Not profitable'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>at {expectedGrade}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-num" style={{ fontSize: 24, fontWeight: 800, color: worthGrading ? 'var(--green)' : 'var(--red)' }}>
                      {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)' }}>ROI</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ResultRow label="Total cost" value={fmt(totalCost, sym)} />
                  <ResultRow label="Net after sell fees" value={fmt(netSale, sym)} />
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                  <ResultRow label="Break-even sale price" value={fmt(breakEven, sym)} color="var(--gold)" />
                  <ResultRow
                    label="Profit / Loss"
                    value={`${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit), sym)}`}
                    color={profit >= 0 ? 'var(--green)' : 'var(--red)'}
                    bold
                  />
                </div>
              </div>
            </SurfaceCard>
          ) : (
            <ResultsCard>
              <ResultRow label="Total cost (raw + grading + shipping)" value={fmt(totalCost, sym)} />
            </ResultsCard>
          )}
        </>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS: { key: ToolTab; label: string; icon: string }[] = [
  { key: 'fee',     label: 'Fee Calc',    icon: '%' },
  { key: 'roi',     label: 'ROI Calc',    icon: '↗' },
  { key: 'grading', label: 'Grading ROI', icon: '★' },
]

export default function ToolsClient() {
  const [tab, setTab] = useState<ToolTab>('fee')

  return (
    <>
      {/* Tab strip */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 0,
        position: 'sticky',
        top: 56,
        zIndex: 10,
        background: 'var(--bg)',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '14px 0',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t.key ? 'var(--gold)' : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition: 'border-color 0.2s',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? 'var(--gold)' : 'var(--ink3)' }}>
              {t.icon}
            </span>
            <span style={{ fontSize: 11, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? 'var(--gold)' : 'var(--ink3)', letterSpacing: 0.2 }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '24px 0 40px' }}>
        {tab === 'fee'     && <FeeCalculator />}
        {tab === 'roi'     && <ROICalculator />}
        {tab === 'grading' && <GradingROI />}
      </div>
    </>
  )
}
