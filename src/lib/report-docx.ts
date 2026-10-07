// Financial Summary Report -> DOCX.
// Human-readable first: a proper financial summary any owner, accountant,
// or AI (via ai-CFO's document upload) can understand. No proprietary schema.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Receipt, Estimate, ReportBusinessInfo } from '../types';
import { fmtMoney, fmtDate, fmtPct } from './money';
import { deductibleNote } from '../data/categories';

const ACCENT = '166534'; // money green
const DARK = '1C1917';
const GRAY = '57534E';

const title = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text, color: ACCENT, bold: true, size: 56 })],
  });

const h1 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, color: ACCENT, bold: true, size: 32 })],
    spacing: { before: 400, after: 200 },
  });

const h2 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, color: DARK, bold: true, size: 26 })],
    spacing: { before: 300, after: 150 },
  });

const body = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, color: DARK, size: 22 })],
    spacing: { after: 150 },
  });

const bullet = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, color: DARK, size: 22 })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });

const cell = (text: string, bold = false, right = false) =>
  new TableCell({
    children: [
      new Paragraph({
        alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text, bold, color: DARK, size: 20 })],
      }),
    ],
  });

function twoColTable(rows: [string, string][], header?: [string, string]): Table {
  const trs: TableRow[] = [];
  if (header) {
    trs.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header[0], bold: true, color: 'FFFFFF', size: 20 })] })],
            shading: { fill: ACCENT },
            width: { size: 65, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: header[1], bold: true, color: 'FFFFFF', size: 20 })] })],
            shading: { fill: ACCENT },
            width: { size: 35, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );
  }
  for (const [a, b] of rows) {
    trs.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a, size: 20, color: DARK })] })], width: { size: 65, type: WidthType.PERCENTAGE } }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: b, size: 20, color: DARK })] })],
            width: { size: 35, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );
  }
  return new Table({ rows: trs, width: { size: 100, type: WidthType.PERCENTAGE } });
}

export interface ReportInput {
  business: ReportBusinessInfo;
  periodLabel: string; // e.g. "2026" or "Jan 2026 – Jun 2026"
  receipts: Receipt[];
  estimates: Estimate[];
}

export async function buildFinancialReportBlob(input: ReportInput): Promise<Blob> {
  const children = buildSections(input);
  const doc = new Document({
    sections: [{ children }],
    title: `Financial Summary — ${input.business.businessName || 'Business'} — ${input.periodLabel}`,
  });
  return Packer.toBlob(doc);
}

export async function downloadFinancialReportDocx(input: ReportInput): Promise<void> {
  const blob = await buildFinancialReportBlob(input);
  const safeName = (input.business.businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  saveAs(blob, `financial-summary-${safeName}-${input.periodLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`);
}

function buildSections(input: ReportInput): (Paragraph | Table)[] {
  const { business, periodLabel, receipts, estimates } = input;
  const children: (Paragraph | Table)[] = [];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ---- Cover ----
  children.push(
    new Paragraph({ spacing: { before: 1200 } }),
    title('FINANCIAL SUMMARY'),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: business.businessName || 'Your Business', color: DARK, size: 36 })],
      spacing: { before: 200 },
    }),
    body(`Industry: ${business.industry || '—'}   |   Location: ${business.location || '—'}`),
    body(`Period covered: ${periodLabel}`),
    body(`Prepared with Margin Master on ${today}.`),
    body(
      'This report summarizes tracked income (estimates/quotes) and categorized expenses (receipts). ' +
        'It is a management summary, not audited financials — review with your accountant before filing.'
    )
  );

  // ---- Key metrics ----
  const totalRevenue = estimates.reduce((s, e) => s + (e.analysis?.totalPrice ?? e.lineItems.reduce((a, li) => a + li.quantity * li.unitPrice, 0)), 0);
  const totalExpenses = receipts.reduce((s, r) => s + r.amount, 0);
  const analyzed = estimates.filter((e) => e.analysis);
  const avgMargin = analyzed.length
    ? analyzed.reduce((s, e) => s + (e.analysis?.overallMarginPct ?? 0), 0) / analyzed.length
    : null;
  const net = totalRevenue - totalExpenses;

  children.push(
    h1('1. Key Metrics'),
    twoColTable(
      [
        ['Quoted revenue (all estimates)', fmtMoney(totalRevenue)],
        ['Tracked expenses (receipts)', fmtMoney(totalExpenses)],
        ['Net (revenue − expenses)', fmtMoney(net)],
        ['Average job margin', avgMargin !== null ? fmtPct(avgMargin) : '—'],
        ['Receipts recorded', String(receipts.length)],
        ['Estimates priced', String(estimates.length)],
      ],
      ['Metric', 'Value']
    )
  );

  // ---- Revenue summary ----
  children.push(h1('2. Revenue Summary (Estimates & Quotes)'));
  if (estimates.length === 0) {
    children.push(body('No estimates recorded in this period.'));
  } else {
    for (const e of estimates) {
      const rev = e.analysis?.totalPrice ?? e.lineItems.reduce((a, li) => a + li.quantity * li.unitPrice, 0);
      const cost = e.analysis?.totalCost ?? e.lineItems.reduce((a, li) => a + li.quantity * li.unitCost, 0);
      const m = e.analysis?.overallMarginPct;
      children.push(h2(e.name));
      children.push(
        body(
          `Industry: ${e.industry} · Location: ${e.location} · ` +
            `Cost ${fmtMoney(cost)} · Price ${fmtMoney(rev)} · ` +
            `Margin ${m !== undefined ? fmtPct(m) : 'not analyzed'}${e.analysis ? (e.analysis.meetsThirtyPct ? ' ✓ meets 30% target' : ' ⚠ below 30% target') : ''}`
        )
      );
      if (e.analysis && e.analysis.specificActions.length > 0) {
        children.push(body('Pricing actions from analysis:'));
        for (const a of e.analysis.specificActions.slice(0, 5)) children.push(bullet(a));
      }
    }
  }

  // ---- Expense breakdown ----
  children.push(h1('3. Expense Breakdown by Category'));
  if (receipts.length === 0) {
    children.push(body('No receipts recorded in this period.'));
  } else {
    const byCat = new Map<string, { count: number; total: number }>();
    for (const r of receipts) {
      const e = byCat.get(r.category) || { count: 0, total: 0 };
      e.count += 1;
      e.total += r.amount;
      byCat.set(r.category, e);
    }
    const rows: [string, string][] = [...byCat.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([c, v]) => [`${c} (${v.count} receipts)`, fmtMoney(v.total)]);
    rows.push(['TOTAL', fmtMoney(totalExpenses)]);
    children.push(twoColTable(rows, ['Category', 'Total']));
    const flagged = receipts.filter((r) => deductibleNote(r.category));
    if (flagged.length > 0) {
      children.push(body(''));
      children.push(body(`Note: ${flagged.length} receipt(s) are in Meals/Travel — ${deductibleNote('Meals/Travel').toLowerCase()}.`));
    }
  }

  // ---- Margin analysis summary ----
  children.push(h1('4. Margin Analysis Summary'));
  if (analyzed.length === 0) {
    children.push(body('No estimates have been run through Pricing Intelligence yet. Margin figures above are raw cost-vs-price only.'));
  } else {
    const hitting = analyzed.filter((e) => e.analysis?.meetsThirtyPct).length;
    children.push(body(`${hitting} of ${analyzed.length} analyzed estimates meet the 30% gross margin target.`));
    for (const e of analyzed) {
      const a = e.analysis!;
      children.push(
        bullet(
          `${e.name}: ${fmtPct(a.overallMarginPct)} margin on ${fmtMoney(a.totalPrice)} quoted ` +
            `(${a.meetsThirtyPct ? 'meets target' : 'below target'})`
        )
      );
    }
    const allActions = analyzed.flatMap((e) => e.analysis?.specificActions || []);
    if (allActions.length > 0) {
      children.push(h2('Top pricing actions across all estimates'));
      for (const a of allActions.slice(0, 10)) children.push(bullet(a));
    }
  }

  // ---- Receipt detail appendix ----
  if (receipts.length > 0) {
    children.push(h1('5. Receipt Detail'));
    const rows: [string, string][] = receipts
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [`${fmtDate(r.date)} · ${r.vendor} · ${r.category}`, fmtMoney(r.amount)]);
    children.push(twoColTable(rows, ['Receipt', 'Amount']));
  }

  children.push(
    body(''),
    new Paragraph({
      children: [new TextRun({ text: 'About this report: ', bold: true, color: GRAY, size: 18 })],
      spacing: { before: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            'Generated by Margin Master from user-entered receipts and estimates. Benchmarks in the pricing module are ' +
            'approximate regional figures from public sources, not quotes. Verify important decisions with your accountant.',
          color: GRAY,
          size: 18,
        }),
      ],
    })
  );

  return children;
}
