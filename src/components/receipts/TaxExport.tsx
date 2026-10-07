import { useState } from 'react';
import type { Receipt } from '../../types';
import { toCSV, downloadTextFile } from '../../lib/csv';
import { fmtMoney, fmtDate } from '../../lib/money';
import { uploadTextFile, isConnected } from '../../lib/drive';

interface Props {
  receipts: Receipt[];
  year: number;
  onYearChange: (y: number) => void;
}

export default function TaxExport({ receipts, year, onYearChange }: Props) {
  const [driveMsg, setDriveMsg] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);

  const yearReceipts = receipts.filter((r) => r.date.startsWith(String(year)));
  const years = [...new Set(receipts.map((r) => Number(r.date.slice(0, 4))))].sort().reverse();

  const byCategory = new Map<string, { count: number; total: number }>();
  for (const r of yearReceipts) {
    const e = byCategory.get(r.category) || { count: 0, total: 0 };
    e.count += 1;
    e.total += r.amount;
    byCategory.set(r.category, e);
  }
  const cats = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);
  const grandTotal = cats.reduce((s, [, v]) => s + v.total, 0);

  const csv = () =>
    toCSV(
      yearReceipts.map((r) => ({
        Date: r.date,
        Vendor: r.vendor,
        Category: r.category,
        Amount: r.amount.toFixed(2),
        Items: r.items.join('; '),
        Deductible: r.deductible ? 'Yes' : 'No',
      })),
      ['Date', 'Vendor', 'Category', 'Amount', 'Items', 'Deductible']
    );

  const summaryText = () => {
    const lines = [
      `TAX SUMMARY ${year} — prepared by Margin Master`,
      `Generated ${new Date().toLocaleDateString()}`,
      ``,
      ...cats.map(([c, v]) => `${c}: ${v.count} receipts, ${fmtMoney(v.total)}`),
      ``,
      `TOTAL: ${fmtMoney(grandTotal)} across ${yearReceipts.length} receipts`,
      ``,
      `Hand this to your accountant with the CSV export.`,
    ];
    return lines.join('\n');
  };

  const saveToDrive = async (kind: 'csv' | 'summary') => {
    setDriveBusy(true);
    setDriveMsg('');
    try {
      const text = kind === 'csv' ? csv() : summaryText();
      const name = kind === 'csv' ? `tax-export-${year}.csv` : `tax-summary-${year}.txt`;
      await uploadTextFile(name, text, kind === 'csv' ? 'text/csv' : 'text/plain');
      setDriveMsg(`✓ Saved ${name} to your Margin Master Drive folder`);
    } catch (e: any) {
      setDriveMsg(`Drive save failed: ${e?.message || 'unknown error'}`);
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">🧾 Tax-time export</h2>
          <p className="text-sm text-ink-600">Hand this to your accountant.</p>
        </div>
        {years.length > 0 && (
          <select className="rounded-xl border-2 border-ink-200 px-3 py-2 font-bold" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        )}
      </div>

      {yearReceipts.length === 0 ? (
        <p className="mt-4 text-ink-500">No receipts for {year} yet.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink-200 text-xs uppercase text-ink-500">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4 text-right">Receipts</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {cats.map(([c, v]) => (
                  <tr key={c} className="border-b border-ink-100">
                    <td className="py-2 pr-4 font-bold">{c}</td>
                    <td className="py-2 pr-4 text-right">{v.count}</td>
                    <td className="py-2 text-right font-black">{fmtMoney(v.total)}</td>
                  </tr>
                ))}
                <tr className="bg-money-50 font-black">
                  <td className="py-3 pr-4">TOTAL</td>
                  <td className="py-3 pr-4 text-right">{yearReceipts.length}</td>
                  <td className="py-3 text-right text-money-800">{fmtMoney(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="no-print mt-5 grid gap-2 md:grid-cols-2">
            <button onClick={() => downloadTextFile(`tax-export-${year}.csv`, csv(), 'text/csv')} className="btn-secondary">
              ⬇️ Download CSV
            </button>
            <button onClick={() => downloadTextFile(`tax-summary-${year}.txt`, summaryText())} className="btn-secondary">
              ⬇️ Download summary
            </button>
            <button onClick={() => window.print()} className="btn-secondary">
              🖨️ Print summary
            </button>
            {isConnected() && (
              <button onClick={() => saveToDrive('csv')} disabled={driveBusy} className="btn-secondary">
                ☁️ {driveBusy ? 'Saving…' : 'Save CSV to Drive'}
              </button>
            )}
          </div>
          {driveMsg && <p className="no-print mt-2 text-sm font-semibold text-money-700">{driveMsg}</p>}
          <p className="mt-3 text-xs text-ink-500">
            Sample line: {yearReceipts[0] ? `${fmtDate(yearReceipts[0].date)} · ${yearReceipts[0].vendor} · ${fmtMoney(yearReceipts[0].amount)}` : '—'}
          </p>
        </>
      )}
    </div>
  );
}
