'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '@/lib/data'

interface Props {
  data: { month: string; price: number }[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
        <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 2 }}>{label}</p>
        <p className="font-mono-custom" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function PriceChart({ data }: Props) {
  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.1
  const isUp = data[data.length - 1].price >= data[0].price
  const color = isUp ? '#3de88a' : '#e8524a'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
        <YAxis domain={[min - pad, max + pad]} tick={{ fill: '#55556a', fontSize: 11, fontFamily: 'DM Mono' }} tickFormatter={v => fmt(v).replace('$', '')} axisLine={false} tickLine={false} width={52} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: color, stroke: 'var(--surface)' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
