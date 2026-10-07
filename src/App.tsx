import { useEffect, useState } from 'react';
import type { Receipt, Estimate, PricingAnalysis } from './types';
import { load, save } from './lib/storage';
import Welcome from './components/Welcome';
import ReceiptUpload from './components/receipts/ReceiptUpload';
import ReceiptList from './components/receipts/ReceiptList';
import SpendingDashboard from './components/receipts/SpendingDashboard';
import TaxExport from './components/receipts/TaxExport';
import EstimateBuilder from './components/pricing/EstimateBuilder';
import PricingAnalysisView from './components/pricing/PricingAnalysis';
import FinancialReport from './components/FinancialReport';
import DriveConnect from './components/DriveConnect';

type Tab = 'home' | 'receipts' | 'pricing' | 'reports';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [receipts, setReceipts] = useState<Receipt[]>(() => load('receipts', []));
  const [estimates, setEstimates] = useState<Estimate[]>(() => load('estimates', []));
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());

  useEffect(() => save('receipts', receipts), [receipts]);
  useEffect(() => save('estimates', estimates), [estimates]);

  const addReceipt = (r: Receipt) => setReceipts((prev) => [r, ...prev]);
  const updateReceipt = (r: Receipt) => setReceipts((prev) => prev.map((x) => (x.id === r.id ? r : x)));
  const deleteReceipt = (id: string) => setReceipts((prev) => prev.filter((x) => x.id !== id));

  const analyzeEstimate = async (est: Estimate) => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const resp = await fetch('/api/analyze-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: est.industry,
          location: est.location,
          lineItems: est.lineItems.map(({ id, description, type, quantity, unit, unitCost, unitPrice }) => ({
            id, description, type, quantity, unit, unitCost, unitPrice,
          })),
        }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Analysis failed');
      const analysis: PricingAnalysis = j;
      const withAnalysis = { ...est, analysis };
      setEstimates((prev) => {
        const existing = prev.find((e) => e.id === est.id);
        if (existing) return prev.map((e) => (e.id === est.id ? withAnalysis : e));
        return [withAnalysis, ...prev];
      });
      setActiveEstimate(withAnalysis);
    } catch (e: any) {
      setAnalyzeError(e?.message || 'Something went wrong analyzing pricing.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveEstimate = (est: Estimate) => {
    setEstimates((prev) => prev.map((e) => (e.id === est.id ? est : e)));
    setActiveEstimate(est);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'receipts', label: 'Receipts', icon: '🧾' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'reports', label: 'Reports', icon: '📄' },
  ];

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => { setTab('home'); setActiveEstimate(null); }} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-money-700 text-xl text-white">💵</span>
            <span className="text-xl font-black text-ink-900">Margin Master</span>
          </button>
          <DriveConnect compact />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setActiveEstimate(null); }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition md:text-base ${
                tab === t.id ? 'bg-money-700 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === 'home' && <Welcome onGo={(t) => setTab(t)} />}

        {tab === 'receipts' && (
          <div className="space-y-4">
            <ReceiptUpload onSave={addReceipt} />
            <SpendingDashboard receipts={receipts} />
            <ReceiptList receipts={receipts} onUpdate={updateReceipt} onDelete={deleteReceipt} />
            <TaxExport receipts={receipts} year={taxYear} onYearChange={setTaxYear} />
          </div>
        )}

        {tab === 'pricing' && (
          <div className="space-y-4">
            {analyzeError && (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{analyzeError}</p>
            )}
            {activeEstimate?.analysis ? (
              <PricingAnalysisView
                estimate={activeEstimate}
                analysis={activeEstimate.analysis}
                onBack={() => setActiveEstimate(null)}
                onSave={saveEstimate}
              />
            ) : (
              <>
                <EstimateBuilder onAnalyze={analyzeEstimate} analyzing={analyzing} />
                {estimates.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold text-ink-900">Saved estimates</h3>
                    <div className="mt-2 space-y-2">
                      {estimates.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setActiveEstimate(e)}
                          className="flex w-full items-center justify-between rounded-xl border border-ink-200 p-3 text-left hover:border-money-500"
                        >
                          <div>
                            <p className="font-bold text-ink-900">{e.name}</p>
                            <p className="text-xs text-ink-500">{e.industry} · {e.location} · {e.lineItems.length} lines</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${
                            e.analysis ? (e.analysis.meetsThirtyPct ? 'bg-money-100 text-money-800' : 'bg-red-100 text-red-800') : 'bg-ink-100 text-ink-500'
                          }`}>
                            {e.analysis ? `${e.analysis.overallMarginPct.toFixed(1)}% margin` : 'Not analyzed'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'reports' && <FinancialReport receipts={receipts} estimates={estimates} />}
      </main>

      <footer className="no-print mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-ink-400">
        Margin Master — your numbers stay on this device. Benchmarks are approximate regional figures, not quotes.
      </footer>
    </div>
  );
}
