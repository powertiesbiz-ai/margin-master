import { useEffect, useState } from 'react';
import { connect, disconnect, isConfigured, isConnected, getAccountEmail, wantsReconnect } from '../lib/drive';

export default function DriveConnect({ compact = false }: { compact?: boolean }) {
  const [connected, setConnected] = useState(isConnected());
  const [email, setEmail] = useState<string | null>(getAccountEmail());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConnected(isConnected());
    setEmail(getAccountEmail());
  }, []);

  if (!isConfigured()) {
    return (
      <button
        disabled
        title="Google Drive is not configured for this deployment (VITE_GOOGLE_CLIENT_ID missing)"
        className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-400 cursor-not-allowed"
      >
        ☁️ Google Drive unavailable
      </button>
    );
  }

  const doConnect = async () => {
    setBusy(true);
    setError('');
    try {
      await connect();
      setConnected(true);
      setEmail(getAccountEmail());
    } catch (e: any) {
      setError(e?.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = () => {
    disconnect();
    setConnected(false);
    setEmail(null);
  };

  if (connected) {
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl border border-money-200 bg-money-50 px-4 py-3'}`}>
        <span className="text-sm font-semibold text-money-800">☁️ {email || 'Drive connected'}</span>
        <button onClick={doDisconnect} className="text-xs font-semibold text-ink-400 underline hover:text-ink-600">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={doConnect}
        disabled={busy}
        className="rounded-xl border-2 border-ink-200 bg-white px-4 py-3 text-sm font-bold text-ink-700 hover:border-money-500 disabled:opacity-50"
      >
        {busy ? 'Connecting…' : wantsReconnect() ? '☁️ Reconnect Google Drive' : '☁️ Connect Google Drive'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
