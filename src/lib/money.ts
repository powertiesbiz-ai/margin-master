export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function fmtPct(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/** Gross margin % = (price - cost) / price * 100. Null when price is 0. */
export function marginPct(cost: number, price: number): number | null {
  if (price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthKey(iso: string): string {
  return iso ? iso.slice(0, 7) : '';
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
