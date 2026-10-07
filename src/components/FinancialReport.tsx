import { useState } from 'react';
import type { Receipt, Estimate, ReportBusinessInfo } from '../types';
import { downloadFinancialReportDocx, buildFinancialReportBlob } from '../lib/report-docx';
import { toCSV, downloadTextFile } from '../lib/csv';
import { uploadTextFile, uploadBlobFile, isConnected } from '../lib/drive';
import { load, save } from '../lib/storage';

interface Props {
  receipts: Receipt[];
  estimates: Estimate[];
}

export default function FinancialReport({ receipts, estimates }: Props) {
  const [business, setBusiness] = useState<ReportBusinessInfo>(() =>
    load('report-business', { businessName: '', industry: '', location: '' })
  );
  const [year, setYear] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const years = [...new Set([
    ...receipts.map((r) => r.date.slice(0, 4)),
    ...estimates.map((e) => e.createdAt.slice(0, 4)),
  ])].sort().reverse();

  const inPeriod = <T extends { date?: string; createdAt?: string }>(x: T): boolean => {
    if (year === 'all') return true;
    const d = (x.date || x.createdAt || '').slice(0, 4);
    return d === year;
  };
  const periodReceipts = receipts.filter(inPeriod);
  const periodEstimates = estimates.filter(inPeriod);
  const periodLabel = year === 'all' ? 'all time' : year;

  const set = (k: keyof ReportBusinessInfo, v: string) => {
    const next = { ...business, [k]: v };
    setBusiness(next);
    save('report-business', next);
  };

  const generate = async () => {
    setBusy(true);
    setMsg('');
    try {
      await downloadFinancialReportDocx({ business, periodLabel, receipts: periodReceipts, estimates: periodEstimates });
      setMsg('✓ Report downloaded. Open it in Word or Google Docs.');
    } catch (e: any) {
      setMsg(`Failed: ${e?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadAllCsv = () => {
    const rows = [
      ...periodReceipts.map((r) => ({ Type: 'Expense', Date: r.date, Name: r.vendor, Category: r.category, Amount: (-r.amount).toFixed(2), Detail: r.items.join('; ') })),
      ...periodEstimates.map((e) => {
        const rev = e.analysis?.totalPrice ?? e.lineItems.reduce((a, li) => a + li.quantity * li.unitPrice, 0);
        return { Type: 'Revenue (quoted)', Date: e.createdAt.slice(0, 10), Name: e.name, Category: e.industry, Amount: rev.toFixed(2), Detail: `${e.lineItems.length} line items` };
      }),
    ];
    downloadTextFile(`margin-master-all-${periodLabel.replace(/\s+/g, '-')}.csv`, toCSV(rows, ['Type', 'Date', 'Name', 'Category', 'Amount', 'Detail']), 'text/csv');
  };

  const saveDocxToDrive = async () => {
    setBusy(true);
    setMsg('');
    try {
      const blob = await buildFinancialReportBlob({ business, periodLabel, receipts: periodReceipts, estimates: periodEstimates });
      const safeName = (business.businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const filename = `financial-summary-${safeName}-${periodLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`;
      await uploadBlobFile(filename, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      setMsg(`✓ Saved ${filename} to your Margin Master Drive folder`);
    } catch (e: any) {
      setMsg(`Drive save failed: ${e?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const saveCsvToDrive = async () => {
    setBusy(true);
    setMsg('');
    try {
      const rows = [
        ...periodReceipts.map((r) => ({ Type: 'Expense', Date: r.date, Name: r.vendor, Category: r.category, Amount: (-r.amount).toFixed(2), Detail: r.items.join('; ') })),
        ...periodEstimates.map((e) => {
          const rev = e.analysis?.totalPrice ?? e.lineItems.reduce((a, li) => a + li.quantity * li.unitPrice, 0);
          return { Type: 'Revenue (quoted)', Date: e.createdAt.slice(0, 10), Name: e.name, Category: e.industry, Amount: rev.toFixed(2), Detail: `${e.lineItems.length} line items` };
        }),
      ];
      const csvText = toCSV(rows, ['Type', 'Date', 'Name', 'Category', 'Amount', 'Detail']);
      await uploadTextFile(`margin-master-report-${periodLabel.replace(/\s+/g, '-')}.csv`, csvText, 'text/csv');
      setMsg('✓ Saved to your Margin Master Drive folder');
    } catch (e: any) {
      setMsg(`Drive save failed: ${e?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-xl font-bold text-ink-900">📄 Financial summary report</h2>
        <p className="mt-1 text-sm text-ink-600">
          A clean, human-readable report: key metrics, revenue, categorized expenses, margin analysis.
          Open it in Word or Google Docs — or feed it to your AI CFO.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label-big">Business name</label>
            <input className="input-big" value={business.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="ABC Tree Service" />
          </div>
          <div>
            <label className="label-big">Industry</label>
            <input className="input-big" value={business.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Tree Service" />
          </div>
          <div>
            <label className="label-big">Location</label>
            <input className="input-big" value={business.location} onChange={(e) => set('location', e.target.value)} placeholder="Morris County, NJ" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="label-big">Period</label>
          <select className="rounded-xl border-2 border-ink-200 px-3 py-2 font-bold" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All time</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-sm text-ink-500">
            {periodReceipts.length} receipts · {periodEstimates.length} estimates
          </span>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-2">
          <button onClick={generate} disabled={busy || (periodReceipts.length === 0 && periodEstimates.length === 0)} className="btn-primary">
            {busy ? 'Building…' : '⬇️ Download report (DOCX)'}
          </button>
          <button onClick={downloadAllCsv} disabled={periodReceipts.length === 0 && periodEstimates.length === 0} className="btn-secondary">
            ⬇️ Download everything (CSV)
          </button>
          {isConnected() && (
            <>
              <button onClick={saveDocxToDrive} disabled={busy} className="btn-secondary">
                ☁️ {busy ? 'Saving…' : 'Save report to Drive'}
              </button>
              <button onClick={saveCsvToDrive} disabled={busy} className="btn-secondary">
                ☁️ {busy ? 'Saving…' : 'Save CSV to Drive'}
              </button>
            </>
          )}
        </div>
        {msg && <p className="mt-2 text-sm font-semibold text-money-700">{msg}</p>}
      </div>

      <div className="card">
        <h3 className="font-bold text-ink-900">What's in the report</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-600">
          <li><strong>Key metrics</strong> — quoted revenue, tracked expenses, net, average job margin</li>
          <li><strong>Revenue summary</strong> — every estimate with cost, price, margin, and whether it clears 30%</li>
          <li><strong>Expense breakdown</strong> — totals by category, tax-flagged items called out</li>
          <li><strong>Margin analysis</strong> — which jobs hit the target and the top pricing actions</li>
          <li><strong>Receipt detail</strong> — full appendix, one line per receipt</li>
        </ul>
        <p className="mt-3 text-sm text-ink-500">
          Feed this DOCX to the ai-CFO (or any AI) along with your own documents — bank statements,
          invoices, estimates — and it can read the whole picture. No proprietary formats.
        </p>
      </div>
    </div>
  );
}
