import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '@/lib/currency';

const PIE_COLORS = ['#c9a66b', '#8a6a34', '#e8d5b5', '#4f4a46', '#d8c1a0'];

export function RevenueTrendChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece1d6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Area type="monotone" dataKey="revenue" stroke="#c9a66b" fill="#c9a66b" fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PaymentSplitChart({ data }: { data: Array<{ method: string; total: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="method" outerRadius={90}>
          {data.map((_, index) => (
            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopServicesChart({ data }: { data: Array<{ name: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#ece1d6" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="revenue" fill="#c9a66b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
