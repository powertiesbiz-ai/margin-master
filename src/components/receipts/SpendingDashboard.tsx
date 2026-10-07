import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { Receipt } from '../../types';
import { fmtMoney, monthKey, fmtMonth } from '../../lib/money';
import { deductibleNote } from '../../data/categories';

const PIE_COLORS = ['#166534', '#16a34a', '#4ade80', '#65a30d', '#0d9488', '#0284c7', '#7c3aed', '#c026d3', '#e11d48', '#ea580c', '#a16207', '#57534e'];

export default function SpendingDashboard({ receipts }: { receipts: Receipt[] }) {
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of receipts) m.set(r.category, (m.get(r.category) || 0) + r.amount);
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [receipts]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of receipts) m.set(monthKey(r.date), (m.get(monthKey(r.date)) || 0) + r.amount);
    return [...m.entries()].sort().map(([key, total]) => ({ key, month: fmtMonth(key), total: Math.round(total * 100) / 100 }));
  }, [receipts]);

  const topVendors = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of receipts) m.set(r.vendor, (m.get(r.vendor) || 0) + r.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [receipts]);

  const total = receipts.reduce((s, r) => s + r.amount, 0);
  const flagged = receipts.filter((r) => deductibleNote(r.category));

  if (receipts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card text-center">
          <p className="label-big">Total tracked</p>
          <p className="text-3xl font-black text-money-800">{fmtMoney(total)}</p>
        </div>
        <div className="card text-center">
          <p className="label-big">Receipts</p>
          <p className="text-3xl font-black text-ink-900">{receipts.length}</p>
        </div>
        <div className="card text-center">
          <p className="label-big">Top category</p>
          <p className="text-2xl font-black text-ink-900">{byCategory[0]?.name || '—'}</p>
          <p className="text-sm font-bold text-money-700">{fmtMoney(byCategory[0]?.value || 0)}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-ink-900">Spending by category</h3>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tickFormatter={(v: number) => `$${v}`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
              <Bar dataKey="value" fill="#166534" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="text-lg font-bold text-ink-900">Monthly trend</h3>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth} margin={{ left: 8, right: 16 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} />
                <YAxis tickFormatter={(v: number) => `$${v}`} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="#166534" strokeWidth={3} dot={{ fill: '#166534' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-bold text-ink-900">Top vendors</h3>
          <ul className="mt-2 space-y-2">
            {topVendors.map(([name, amt], i) => (
              <li key={name} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2">
                <span className="font-bold text-ink-800">{i + 1}. {name}</span>
                <span className="font-black text-money-800">{fmtMoney(amt)}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-lg font-bold text-ink-900">Category mix</h3>
          <div className="mt-1 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={80} label={false}>
                  {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">⚠️ Heads up for tax time</p>
          <p className="text-sm text-amber-800">
            {flagged.length} receipt{flagged.length > 1 ? 's' : ''} in Meals/Travel — {deductibleNote('Meals/Travel').toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  );
}
