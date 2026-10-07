import type { ReceiptCategory } from '../types';

// Schedule C-ish buckets for small business tax time
export const RECEIPT_CATEGORIES: ReceiptCategory[] = [
  'Materials',
  'Subcontractors',
  'Labor/Payroll',
  'Vehicle/Fuel',
  'Equipment',
  'Insurance',
  'Office/Supplies',
  'Marketing',
  'Professional Services',
  'Rent/Utilities',
  'Meals/Travel',
  'Other',
];

// Categories that are generally NOT deductible as business expenses
export const NON_DEDUCTIBLE_CATEGORIES: ReceiptCategory[] = [];

export function isDeductible(category: ReceiptCategory): boolean {
  // Meals/Travel is 50% deductible in many cases — we flag it for the accountant
  // rather than excluding it. Everything else in the list is deductible.
  return true;
}

export function deductibleNote(category: ReceiptCategory): string {
  if (category === 'Meals/Travel') return 'Often 50% deductible — confirm with your accountant';
  return '';
}

export const TRADES_INDUSTRIES = [
  'Tree Service',
  'HVAC',
  'Plumbing',
  'Electrical',
  'Roofing',
  'Landscaping / Lawn Care',
  'General Construction',
  'Remodeling / Handyman',
  'Painting',
  'Concrete / Masonry',
  'Fencing / Decking',
  'Pest Control',
  'Cleaning Services',
  'Auto Repair',
  'Appliance Repair',
  'Pool Service',
  'Septic / Well',
  'Garage Doors',
  'Flooring',
  'Drywall',
  'Other Trade',
  'Professional Services',
  'Other',
];

export const LINE_ITEM_TYPES = ['Labor', 'Materials', 'Subcontract', 'Other'] as const;

export const COMMON_UNITS = ['hr', 'each', 'sq ft', 'ln ft', 'job', 'day', 'lb', 'gal', 'box', 'roll'];
