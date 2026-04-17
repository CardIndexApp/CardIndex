'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt } from '@/lib/mockData';

interface Props {
  data: { month: string; price: number }[];
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border2)' }}>
        <p className="text-xs mb-1" style={{ color: 'var(--ink3)' }}>{label}</p>
        <p className="font-mono font-500 text-sm" style={{ color: 'var(--ink)' }}>{fmt(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ data, color = '#e8c547' }: Props) {
  const min = Math.min(...data.map(d => d.price));
  const max = Math.max(...data.map(d => d.price));
  const pad = (max - min) * 0.1;
  const isPositive = data[data.length - 1].price >= data[0].price;
  const lineColor = isPositive ? '#3de88a' : '#e8524a';

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--ink3)', fontSize: 11, fontFamily: 'DM Mono' }}
          axisLine={false} tickLine={false} />
        <YAxis domain={[min - pad, max + pad]}
          tick={{ fill: 'var(--ink3)', fontSize: 11, fontFamily: 'DM Mono' }}
          tickFormatter={v => fmt(v).replace('$', '')}
          axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2}
          fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: lineColor, stroke: 'var(--surface)' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
