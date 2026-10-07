import DriveConnect from './DriveConnect';

export default function Welcome({ onGo }: { onGo: (tab: 'receipts' | 'pricing') => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-money-700">
        Receipts · Margins · Tax-Ready Books
      </p>
      <h1 className="text-4xl font-black leading-tight text-ink-900 md:text-5xl">
        Know your numbers.
        <br />
        Keep your margin.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-600">
        Snap your receipts, see where the money goes, and price every job to clear{' '}
        <strong className="text-money-700">30% margin</strong> — benchmarked against real rates in your area.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <button
          onClick={() => onGo('receipts')}
          className="card text-left transition hover:border-money-500 hover:shadow-md"
        >
          <div className="text-4xl">🧾</div>
          <h2 className="mt-3 text-xl font-bold text-ink-900">Receipts & Spending</h2>
          <p className="mt-1 text-ink-600">
            Photograph receipts, let AI categorize them, watch your spending by category, and export a
            clean package for tax time.
          </p>
          <span className="mt-3 inline-block font-bold text-money-700">Open receipts →</span>
        </button>
        <button
          onClick={() => onGo('pricing')}
          className="card text-left transition hover:border-money-500 hover:shadow-md"
        >
          <div className="text-4xl">💰</div>
          <h2 className="mt-3 text-xl font-bold text-ink-900">Pricing Intelligence</h2>
          <p className="mt-1 text-ink-600">
            Build or upload an estimate, benchmark every line against market rates near you, and find
            exactly where to raise prices to hit 30%+.
          </p>
          <span className="mt-3 inline-block font-bold text-money-700">Price a job →</span>
        </button>
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink-900">Back up to Google Drive</h3>
            <p className="text-sm text-ink-600">
              Save your tax exports and pricing reports straight to a Margin Master folder in your Drive.
            </p>
          </div>
          <DriveConnect />
        </div>
      </div>

      <p className="mt-6 text-sm text-ink-500">
        Your data stays on this device unless you choose to save it to Drive. Nothing is sent anywhere
        except the receipt photos and estimates you explicitly ask the AI to read.
      </p>
    </div>
  );
}
