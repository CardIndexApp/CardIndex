'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface ChartPoint { month: string; value: number }

function IndexTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 2 }}>{label}</p>
      <p className="font-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{payload[0].value.toFixed(1)}</p>
    </div>
  )
}

interface Props {
  chartData: ChartPoint[]
  chartColor: string
  gridStroke: string
  tickFill: string
  cursorStroke: string
}

export default function MarketAreaChart({ chartData, chartColor, gridStroke, tickFill, cursorStroke }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: tickFill, fontSize: 10, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: tickFill, fontSize: 10, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v.toFixed(0)} />
        <Tooltip content={<IndexTooltip />} cursor={{ stroke: cursorStroke, strokeWidth: 1 }} />
        <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill="url(#mktGrad)" dot={false} activeDot={{ r: 4, fill: chartColor, stroke: 'var(--surface)' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
