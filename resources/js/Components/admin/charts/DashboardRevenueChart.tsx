import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCurrency } from '@/lib/currency';

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export default function DashboardRevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a66b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#c9a66b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8e1d6" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => new Date(value).getDate().toString()}
          tick={{ fontSize: 12, fill: '#6b6157' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatCurrency(value)}
          tick={{ fontSize: 12, fill: '#6b6157' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(value) => new Date(String(value)).toLocaleDateString()}
          contentStyle={{ borderRadius: 8, borderColor: '#e8e1d6', fontSize: 13 }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#b08d4f" strokeWidth={2} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
