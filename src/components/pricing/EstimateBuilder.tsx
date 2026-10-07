import { useRef, useState } from 'react';
import type { Estimate, LineItem, LineItemType } from '../../types';
import { TRADES_INDUSTRIES, LINE_ITEM_TYPES, COMMON_UNITS } from '../../data/categories';
import { uid } from '../../lib/storage';
import { fmtMoney } from '../../lib/money';

interface Props {
  onAnalyze: (est: Estimate) => void;
  analyzing: boolean;
}

const emptyItem = (): LineItem => ({
  id: uid(),
  description: '',
  type: 'Labor',
  quantity: 1,
  unit: 'hr',
  unitCost: 0,
  unitPrice: 0,
});

export default function EstimateBuilder({ onAnalyze, analyzing }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(TRADES_INDUSTRIES[0]);
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const setItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const totals = items.reduce(
    (s, it) => ({ cost: s.cost + it.quantity * it.unitCost, price: s.price + it.quantity * it.unitPrice }),
    { cost: 0, price: 0 }
  );
  const margin = totals.price > 0 ? ((totals.price - totals.cost) / totals.price) * 100 : null;

  const handleUpload = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload a photo or PDF of the estimate.');
      return;
    }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const [head, base64] = dataUrl.split(',');
      const mime = /data:(.*?);/.exec(head)?.[1] || file.type;
      const resp = await fetch('/api/parse-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Could not read the estimate');
      const parsed: LineItem[] = (j.lineItems || []).map((li: any) => ({ ...li, id: uid() }));
      if (parsed.length === 0) throw new Error('No line items found in that document.');
      setItems(parsed);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong reading the estimate.');
    } finally {
      setUploading(false);
    }
  };

  const analyze = () => {
    if (!name.trim()) { setError('Give this estimate a name (e.g. "Johnson kitchen remodel").'); return; }
    if (!location.trim()) { setError('Enter your location (ZIP or City, ST) so benchmarks are regional.'); return; }
    const valid = items.filter((it) => it.description.trim() && it.unitPrice > 0);
    if (valid.length === 0) { setError('Add at least one line item with a description and a price.'); return; }
    setError('');
    onAnalyze({
      id: uid(),
      name: name.trim(),
      industry,
      location: location.trim(),
      lineItems: valid,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Build your estimate</h2>
          <p className="text-sm text-ink-600">Type it in — or upload a photo of an existing estimate.</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary !py-2 text-sm">
          {uploading ? 'Reading…' : '📸 Upload estimate photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="label-big">Job name</label>
          <input className="input-big" value={name} onChange={(e) => setName(e.target.value)} placeholder="Johnson kitchen remodel" />
        </div>
        <div>
          <label className="label-big">Industry</label>
          <select className="input-big" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {TRADES_INDUSTRIES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-big">Location</label>
          <input className="input-big" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ZIP or City, ST" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((it, i) => (
          <div key={it.id} className="rounded-2xl border-2 border-ink-100 bg-ink-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-ink-400">Line {i + 1}</span>
              <button onClick={() => removeItem(it.id)} className="text-xs font-bold text-red-500 underline">Remove</button>
            </div>
            <input className="input-big mt-2" value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })}
              placeholder="e.g. Install 40 gal water heater" />
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
              <div>
                <label className="label-big">Type</label>
                <select className="input-big !py-2 text-sm" value={it.type} onChange={(e) => setItem(it.id, { type: e.target.value as LineItemType })}>
                  {LINE_ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label-big">Qty</label>
                <input className="input-big !py-2 text-sm" type="number" min="0" step="any" value={it.quantity}
                  onChange={(e) => setItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label-big">Unit</label>
                <select className="input-big !py-2 text-sm" value={COMMON_UNITS.includes(it.unit) ? it.unit : 'custom'}
                  onChange={(e) => setItem(it.id, { unit: e.target.value })}>
                  {COMMON_UNITS.map((u) => <option key={u}>{u}</option>)}
                  {!COMMON_UNITS.includes(it.unit) && <option value="custom">{it.unit} (custom)</option>}
                </select>
              </div>
              <div>
                <label className="label-big">Your cost /{it.unit}</label>
                <input className="input-big !py-2 text-sm" type="number" min="0" step="any" value={it.unitCost || ''}
                  placeholder="0" onChange={(e) => setItem(it.id, { unitCost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2">
                <label className="label-big">Price you charge /{it.unit}</label>
                <input className="input-big !py-2 text-sm font-bold" type="number" min="0" step="any" value={it.unitPrice || ''}
                  placeholder="0" onChange={(e) => setItem(it.id, { unitPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addItem} className="btn-secondary mt-3 w-full">+ Add line item</button>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900 p-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-300">Job totals</p>
          <p className="text-sm">Cost <strong>{fmtMoney(totals.cost)}</strong> · Price <strong>{fmtMoney(totals.price)}</strong></p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-300">Your margin now</p>
          <p className={`text-3xl font-black ${margin !== null && margin >= 30 ? 'text-money-400' : 'text-amber-400'}`}>
            {margin !== null ? `${margin.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <button onClick={analyze} disabled={analyzing} className="btn-primary mt-4">
        {analyzing ? 'Analyzing against market rates…' : '🔍 Analyze my pricing vs the market'}
      </button>
    </div>
  );
}
