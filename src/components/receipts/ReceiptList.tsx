import { useMemo, useState } from 'react';
import type { Receipt, ReceiptCategory } from '../../types';
import { RECEIPT_CATEGORIES } from '../../data/categories';
import { fmtMoney, fmtDate, monthKey, fmtMonth } from '../../lib/money';

interface Props {
  receipts: Receipt[];
  onUpdate: (r: Receipt) => void;
  onDelete: (id: string) => void;
}

export default function ReceiptList({ receipts, onUpdate, onDelete }: Props) {
  const [catFilter, setCatFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const months = useMemo(() => {
    const s = new Set(receipts.map((r) => monthKey(r.date)));
    return [...s].sort().reverse();
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts
      .filter((r) => (catFilter === 'all' ? true : r.category === catFilter))
      .filter((r) => (monthFilter === 'all' ? true : monthKey(r.date) === monthFilter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [receipts, catFilter, monthFilter]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  if (receipts.length === 0) {
    return (
      <div className="card text-center text-ink-500">
        <div className="text-4xl">🧾</div>
        <p className="mt-2 font-semibold">No receipts yet. Add your first one above.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink-900">Receipts ({filtered.length})</h2>
        <div className="flex gap-2">
          <select className="rounded-xl border-2 border-ink-200 px-3 py-2 text-sm font-semibold" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {RECEIPT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="rounded-xl border-2 border-ink-200 px-3 py-2 text-sm font-semibold" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
            {r.imageDataUrl ? (
              <img src={r.imageDataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-2xl">🧾</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink-900">{r.vendor}</p>
              <p className="text-sm text-ink-500">{fmtDate(r.date)}</p>
              <select
                className="mt-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-xs font-bold text-money-800"
                value={r.category}
                onChange={(e) => onUpdate({ ...r, category: e.target.value as ReceiptCategory })}
              >
                {RECEIPT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-ink-900">{fmtMoney(r.amount)}</p>
              <button onClick={() => onDelete(r.id)} className="text-xs font-bold text-red-500 underline hover:text-red-700">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-money-50 px-4 py-3">
        <span className="font-bold text-money-900">Total shown</span>
        <span className="text-2xl font-black text-money-800">{fmtMoney(total)}</span>
      </div>
    </div>
  );
}
