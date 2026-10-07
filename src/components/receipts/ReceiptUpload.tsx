import { useRef, useState } from 'react';
import type { Receipt, ReceiptCategory } from '../../types';
import { RECEIPT_CATEGORIES } from '../../data/categories';
import { uid, todayISO } from '../../lib/storage';
import { fmtMoney } from '../../lib/money';

interface Props {
  onSave: (r: Receipt) => void;
}

interface Parsed {
  vendor: string;
  date: string | null;
  amount: number;
  category: ReceiptCategory;
  items: string[];
  confidence: 'high' | 'medium' | 'low';
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const [head, data] = s.split(',');
      const mime = /data:(.*?);/.exec(head)?.[1] || file.type || 'image/jpeg';
      resolve({ base64: data, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downscaleImage(dataUrl: string, maxDim = 320): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) return resolve(dataUrl);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function ReceiptUpload({ onSave }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [thumb, setThumb] = useState<string | undefined>(undefined);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ReceiptCategory>('Other');

  const handleFile = async (file: File) => {
    setError('');
    setParsed(null);
    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    const isImage = file.type.startsWith('image/');
    if (!okTypes.includes(file.type) && !isImage) {
      setError('Please upload a photo (JPG/PNG) or PDF of the receipt.');
      return;
    }
    setBusy(true);
    try {
      const { base64, mime } = await fileToBase64(file);
      if (isImage) {
        const full = `data:${mime};base64,${base64}`;
        setThumb(await downscaleImage(full));
      } else {
        setThumb(undefined);
      }
      const r = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not read the receipt');
      const p: Parsed = j;
      setParsed(p);
      setVendor(p.vendor);
      setDate(p.date || todayISO());
      setAmount(p.amount ? String(p.amount) : '');
      setCategory(p.category);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong reading the receipt.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!vendor.trim() || !amt || amt <= 0) {
      setError('Vendor and a valid amount are required.');
      return;
    }
    onSave({
      id: uid(),
      vendor: vendor.trim(),
      date: date || todayISO(),
      amount: Math.round(amt * 100) / 100,
      category,
      items: parsed?.items || [],
      confidence: parsed?.confidence || 'low',
      imageDataUrl: thumb,
      deductible: true,
      createdAt: new Date().toISOString(),
    });
    // reset
    setParsed(null);
    setThumb(undefined);
    setVendor('');
    setAmount('');
    setCategory('Other');
    setDate(todayISO());
    setError('');
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-ink-900">Add a receipt</h2>
      <p className="mt-1 text-sm text-ink-600">Snap a photo or drop a PDF — the AI reads it for you.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 cursor-pointer rounded-2xl border-4 border-dashed p-10 text-center transition ${
          dragOver ? 'border-money-500 bg-money-50' : 'border-ink-200 bg-ink-50 hover:border-money-400'
        }`}
      >
        <div className="text-5xl">📸</div>
        <p className="mt-2 text-lg font-bold text-ink-800">
          {busy ? 'Reading receipt…' : 'Tap to photograph / upload'}
        </p>
        <p className="text-sm text-ink-500">or drag a file here · JPG, PNG, PDF</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {busy && (
        <div className="mt-4 flex items-center gap-3 text-ink-600">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-money-600 border-t-transparent" />
          <span className="font-semibold">AI is reading your receipt…</span>
        </div>
      )}

      {parsed && !busy && (
        <div className="mt-4 rounded-2xl border-2 border-money-200 bg-money-50 p-4">
          <div className="flex items-start gap-4">
            {thumb && <img src={thumb} alt="receipt" className="h-24 w-24 rounded-lg border object-cover" />}
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-money-800">
                Found it {parsed.confidence !== 'high' && <span className="text-amber-600">({parsed.confidence} confidence — check me)</span>}
              </p>
              {parsed.items.length > 0 && (
                <p className="mt-1 text-sm text-ink-600">{parsed.items.join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label-big">Vendor</label>
              <input className="input-big" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <label className="label-big">Amount</label>
              <input className="input-big" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label-big">Date</label>
              <input className="input-big" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label-big">Category</label>
              <select className="input-big" value={category} onChange={(e) => setCategory(e.target.value as ReceiptCategory)}>
                {RECEIPT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={save} className="btn-primary mt-4">
            Save receipt {amount ? `· ${fmtMoney(parseFloat(amount) || 0)}` : ''}
          </button>
        </div>
      )}
    </div>
  );
}
