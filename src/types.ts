// Core domain types for Margin Master

export type ReceiptCategory =
  | 'Materials'
  | 'Subcontractors'
  | 'Labor/Payroll'
  | 'Vehicle/Fuel'
  | 'Equipment'
  | 'Insurance'
  | 'Office/Supplies'
  | 'Marketing'
  | 'Professional Services'
  | 'Rent/Utilities'
  | 'Meals/Travel'
  | 'Other';

export interface Receipt {
  id: string;
  vendor: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: ReceiptCategory;
  items: string[];
  confidence: 'high' | 'medium' | 'low';
  imageDataUrl?: string; // thumbnail (images only, downscaled)
  deductible: boolean;
  note?: string;
  createdAt: string; // ISO
}

export type LineItemType = 'Labor' | 'Materials' | 'Subcontract' | 'Other';

export interface LineItem {
  id: string;
  description: string;
  type: LineItemType;
  quantity: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
}

export interface Estimate {
  id: string;
  name: string;
  industry: string;
  location: string; // ZIP or "City, ST"
  lineItems: LineItem[];
  createdAt: string; // ISO
  analysis?: PricingAnalysis;
}

export type Verdict = 'below' | 'at' | 'above';

export interface LineAnalysis {
  lineItemId: string;
  description: string;
  type: LineItemType;
  yourRate: number;
  yourUnit: string;
  benchmarkLow: number | null;
  benchmarkHigh: number | null;
  benchmarkUnit: string;
  verdict: Verdict;
  marginPct: number | null; // null when cost is 0 and price > 0 (pure markup) — handled as 100
  recommendation: string;
}

export interface PricingAnalysis {
  lines: LineAnalysis[];
  totalCost: number;
  totalPrice: number;
  overallMarginPct: number;
  meetsThirtyPct: boolean;
  specificActions: string[];
  riskFlags: string[];
  benchmarkNote: string;
  analyzedAt: string; // ISO
}

// ---- Financial summary report ----
// Margin Master produces a human-readable DOCX financial summary (plus CSV).
// No proprietary JSON schema: the ai-CFO ingests documents (DOCX/PDF/CSV/images)
// via its own document upload, so the report is written for humans first and
// machine-readable as a bonus.
export interface ReportBusinessInfo {
  businessName: string;
  industry: string;
  location: string;
}
