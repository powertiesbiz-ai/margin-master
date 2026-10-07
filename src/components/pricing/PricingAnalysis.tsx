import { useMemo, useState } from 'react';
import type { Estimate, PricingAnalysis } from '../../types';
import { fmtMoney, fmtPct, marginPct } from '../../lib/money';

interface Props {
  estimate: Estimate;
  analysis: PricingAnalysis;
  onBack: () => void;
  onSave: (est: Estimate) => void;
}

function Gauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct >= 30 ? '#166534' : pct >= 15 ? '#d97706' : '#dc2626';
  const r = 70;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e7e5e4" strokeWidth="18" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (clamped / 100) * circ} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color }}>{pct.toFixed(1)}%</span>
        <span className="text-xs font-bold uppercase text-ink-500">margin</span>
      </div>
    </div>
  );
}

const verdictStyle: Record<string, string> = {
  below: 'bg-red-100 text-red-800 border-red-300',
  at: 'bg-money-100 text-money-800 border-money-300',
  above: 'bg-blue-100 text-blue-800 border-blue-300',
};
const verdictLabel: Record<string, string> = {
  below: '▼ BELOW MARKET',
  at: '● AT MARKET',
  above: '▲ ABOVE MARKET',
};

export default function PricingAnalysis({ estimate, analysis, onBack, onSave }: Props) {
  // What-if: adjustable unit prices per line, live margin recalc
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(estimate.lineItems.map((li) => [li.id, li.unitPrice]))
  );

  const whatIf = useMemo(() => {
    let cost = 0, price = 0;
    for (const li of estimate.lineItems) {
      cost += li.quantity * li.unitCost;
      price += li.quantity * (prices[li.id] ?? li.unitPrice);
    }
    return { cost, price, margin: marginPct(cost, price) };
  }, [prices, estimate]);

  const setPrice = (id: string, v: number) => setPrices((p) => ({ ...p, [id]: Math.max(0, v) }));

  const applyPrices = () => {
    onSave({
      ...estimate,
      lineItems: estimate.lineItems.map((li) => ({ ...li, unitPrice: prices[li.id] ?? li.unitPrice })),
    });
  };
  const dirty = estimate.lineItems.some((li) => (prices[li.id] ?? li.unitPrice) !== li.unitPrice);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-ink-500 underline">← Back to estimates</button>

      <div className="card">
        <div className="flex flex-wrap items-center gap-6">
          <Gauge pct={analysis.overallMarginPct} />
          <div className="flex-1">
            <h2 className="text-2xl font-black text-ink-900">{estimate.name}</h2>
            <p className="text-sm text-ink-500">{estimate.industry} · {estimate.location}</p>
            <p className="mt-2 text-lg">
              Cost <strong>{fmtMoney(analysis.totalCost)}</strong> · Price <strong>{fmtMoney(analysis.totalPrice)}</strong>
            </p>
            {analysis.meetsThirtyPct ? (
              <p className="mt-2 inline-block rounded-xl bg-money-100 px-4 py-2 font-black text-money-800">
                ✓ Clears the 30% margin target
              </p>
            ) : (
              <p className="mt-2 inline-block rounded-xl bg-red-100 px-4 py-2 font-black text-red-800">
                ⚠ Below the 30% margin target — see actions below
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">{analysis.benchmarkNote}</p>
      </div>

      {analysis.specificActions.length > 0 && (
        <div className="card border-2 border-money-200">
          <h3 className="text-lg font-black text-ink-900">🎯 Do this first (biggest dollars first)</h3>
          <ol className="mt-2 space-y-2">
            {analysis.specificActions.map((a, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-money-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-money-700 font-black text-white">{i + 1}</span>
                <span className="font-semibold text-ink-800">{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {analysis.riskFlags.length > 0 && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <h3 className="font-black text-red-900">⚠️ Risk flags</h3>
          <ul className="mt-1 list-disc pl-5 text-sm font-semibold text-red-800">
            {analysis.riskFlags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-black text-ink-900">Line-by-line vs the market</h3>
        <div className="mt-3 space-y-3">
          {analysis.lines.map((l) => (
            <div key={l.lineItemId} className="rounded-2xl border border-ink-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-ink-900">{l.description}</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${verdictStyle[l.verdict]}`}>
                  {verdictLabel[l.verdict]}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-ink-50 p-2">
                  <p className="text-xs uppercase text-ink-500">You charge</p>
                  <p className="font-black">{fmtMoney(l.yourRate)}/{l.yourUnit}</p>
                </div>
                <div className="rounded-xl bg-ink-50 p-2">
                  <p className="text-xs uppercase text-ink-500">Market range</p>
                  <p className="font-black">
                    {l.benchmarkLow !== null ? `${fmtMoney(l.benchmarkLow)}–${fmtMoney(l.benchmarkHigh!)}/${l.benchmarkUnit}` : 'No data'}
                  </p>
                </div>
                <div className="rounded-xl bg-ink-50 p-2">
                  <p className="text-xs uppercase text-ink-500">Line margin</p>
                  <p className="font-black">{fmtPct(l.marginPct)}</p>
                </div>
              </div>
              {l.recommendation && <p className="mt-2 text-sm font-semibold text-money-800">→ {l.recommendation}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card border-2 border-amber-300">
        <h3 className="text-lg font-black text-ink-900">🔧 What-if: try new prices, watch the margin move</h3>
        <p className="text-sm text-ink-600">Drag the sliders. When the margin looks right, apply the prices to this estimate.</p>
        <div className="mt-3 space-y-4">
          {estimate.lineItems.map((li) => {
            const p = prices[li.id] ?? li.unitPrice;
            const max = Math.max(li.unitPrice * 2, li.unitCost * 1.5, 10);
            return (
              <div key={li.id}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink-800">{li.description}</span>
                  <span className="font-black text-money-800">{fmtMoney(p)}/{li.unit}</span>
                </div>
                <input type="range" min={0} max={Math.ceil(max)} step={1} value={p}
                  onChange={(e) => setPrice(li.id, parseFloat(e.target.value))}
                  className="w-full accent-green-700" />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900 p-4 text-white">
          <span className="font-bold">New job margin</span>
          <span className={`text-3xl font-black ${(whatIf.margin ?? 0) >= 30 ? 'text-money-400' : 'text-amber-400'}`}>
            {whatIf.margin !== null ? `${whatIf.margin.toFixed(1)}%` : '—'}
          </span>
        </div>
        <button onClick={applyPrices} disabled={!dirty} className="btn-primary mt-3 disabled:opacity-40">
          Apply these prices to the estimate
        </button>
      </div>
    </div>
  );
}
