# Margin Master

Receipt intake → tax-ready books, plus pricing intelligence that benchmarks every job against real market rates. Built for small service businesses (especially trades) that need to know their numbers and hold **30%+ margin** on every sale.

**Live:** *(connect to Vercel — see setup below)*

## What it does

### Module 1 — Receipts & Spending
- Photograph or upload receipts (JPG/PNG/PDF) → Gemini vision extracts vendor, date, amount, category
- Editable category list mapped to Schedule C-ish buckets (Materials, Subcontractors, Vehicle/Fuel, …)
- Spending dashboard: by-category bars, monthly trend, top vendors, category mix
- Tax-time export: CSV + printable category summary ("hand this to your accountant")

### Module 2 — Pricing Intelligence
- Build an estimate line-by-line (labor/materials/subcontract), or upload a photo of an existing estimate → AI extracts the lines
- **Analyze My Pricing**: Gemini with Google Search grounding benchmarks your rates against real regional data for your industry + location
- 30% margin gauge, per-line verdicts (below/at/above market), prioritized actions ("raise labor $85→$110/hr")
- **What-if sliders**: drag prices, watch the margin move live, apply when it looks right

### Reports — Financial Summary (DOCX)
The Reports tab generates a clean, human-readable **Financial Summary DOCX**:
1. **Cover** — business name, industry, location, period, prepared date
2. **Key Metrics** — quoted revenue, tracked expenses, net, average job margin, counts
3. **Revenue Summary** — every estimate with cost, price, margin, 30% target status, top pricing actions
4. **Expense Breakdown** — totals by category, tax-flagged items noted
5. **Margin Analysis** — which jobs clear 30%, top actions across all estimates
6. **Receipt Detail** — appendix, one line per receipt

Plus a combined CSV (expenses + quoted revenue). Save either to Google Drive.

**Design intent:** no proprietary JSON schema. The ai-CFO ingests documents (DOCX/PDF/CSV/images) through its own upload → Gemini reads them. Margin Master produces universal formats a human or AI can understand. Feed this DOCX to the ai-CFO alongside bank statements and invoices and it sees the whole picture.

## Tech
- Vite + React + TypeScript + Tailwind CSS, recharts for charts
- Gemini 2.0 Flash via Vercel serverless `/api` routes (server-side, `GEMINI_API_KEY`):
  - `parse-receipt.ts` — vision → structured receipt JSON
  - `parse-estimate.ts` — vision → line items JSON
  - `analyze-pricing.ts` — line items + industry + location → grounded benchmark analysis (server computes all margins; the model never does arithmetic)
- `docx` + `file-saver` for the report; Google Identity Services + `drive.file` scope for Drive
- No database, no auth beyond optional Google OAuth. All data in localStorage.

## Setup (Keith)

1. **Vercel** → Add New Project → import `powertiesbiz-ai/margin-master` (framework: Vite)
2. **Environment variables**:
   - `GEMINI_API_KEY` — paid key (live user-facing app per key policy)
   - `VITE_GOOGLE_CLIENT_ID` — from the Google Cloud OAuth client (below)
3. **Deploy**

**Google Cloud (one-time)** — reuse the shared "PowerTies Apps" project if it exists:
1. Console → enable **Google Drive API**
2. OAuth consent screen → External → add `.../auth/drive.file` scope → add yourself as test user
3. Credentials → OAuth client ID (Web application) → Authorized JavaScript origins: your Vercel URL
4. Paste the client ID as `VITE_GOOGLE_CLIENT_ID` in Vercel → redeploy

Without the client ID, Drive buttons render disabled with a tooltip — the app works fully offline otherwise.

## Smoke test
1. Upload a receipt photo → confirm vendor/date/amount/category look right → save
2. Add 2–3 more receipts → check the dashboard charts render
3. Tax export → download CSV, confirm it opens clean
4. Pricing: build a 3-line estimate (1 labor, 1 materials, 1 other) with your ZIP → Analyze → confirm the gauge, verdicts, and benchmark note render
5. Drag a what-if slider → margin updates → Apply → estimate updates
6. Reports tab → fill business info → Download DOCX → open in Word/Docs, confirm all 6 sections
7. (If Drive connected) Save report to Drive → confirm it lands in the Margin Master folder

## Roadmap
- AI image generation for estimates is out of scope; receipt OCR confidence is the quality lever
- Recurring-expense detection ("you buy fuel every Tuesday — want a rule?")
- QuickBooks/Xero export format alongside the accountant CSV
