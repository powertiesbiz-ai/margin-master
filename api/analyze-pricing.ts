// POST /api/analyze-pricing
// Body: { industry: string, location: string, lineItems: [{description, type, quantity, unit, unitCost, unitPrice}] }
// Uses Gemini with Google Search grounding to benchmark rates against real
// regional data, then computes margins and produces prioritized actions.
// -> { lines: [...], totalCost, totalPrice, overallMarginPct, meetsThirtyPct,
//      specificActions[], riskFlags[], benchmarkNote, analyzedAt }

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function marginPct(cost: number, price: number): number | null {
  if (price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

  const { industry, location, lineItems } = req.body || {};
  if (!industry || !location || !Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'industry, location, and lineItems[] are required' });
  }

  const itemsDesc = lineItems
    .map(
      (li: any, i: number) =>
        `${i + 1}. "${li.description}" [${li.type}] — qty ${li.quantity} ${li.unit}, cost $${li.unitCost}/${li.unit}, price $${li.unitPrice}/${li.unit}`
    )
    .join('\n');

  const prompt = `You are a pricing consultant for small service businesses (especially trades). The owner wants every job to earn at least 30% gross margin.

BUSINESS: ${industry}
LOCATION: ${location} (use this for regional rate benchmarks)
LINE ITEMS:
${itemsDesc}

Use Google Search to find REAL current market rates for ${industry} services near ${location}. Look for: typical hourly labor rates, common material markups, subcontractor rates, and what competitors charge for similar work.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly this shape:
{
  "lines": [
    {
      "index": 0,
      "yourRate": 85,
      "yourUnit": "hr",
      "benchmarkLow": 95,
      "benchmarkHigh": 140,
      "benchmarkUnit": "hr",
      "verdict": "below | at | above",
      "recommendation": "one concrete sentence telling the owner what to do about this line"
    }
  ],
  "specificActions": ["3-6 prioritized actions, most dollars first, e.g. 'Raise labor rate from $85/hr to $110/hr — you are 23% below the county average'"],
  "riskFlags": ["anything dangerous: below-cost lines, suspiciously low material markup, missing overhead, etc."],
  "benchmarkNote": "one honest sentence about the benchmark data: where it came from, how fresh, and any caveat"
}

Rules:
- "index" matches the line-item order above (0-based).
- yourRate = the unitPrice the owner charges, per yourUnit.
- benchmarkLow/benchmarkHigh = the typical market RANGE per benchmarkUnit for this kind of work near this location, from your search. If you genuinely cannot find data for a line, set both to null and say so in the recommendation.
- verdict: "below" if yourRate < benchmarkLow, "above" if yourRate > benchmarkHigh, else "at".
- Be specific with numbers. Never invent precision — if data is thin, widen the range and say so.
- specificActions must be ordered by estimated dollar impact, biggest first.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: `Gemini request failed: ${r.status}`, detail: t.slice(0, 300) });
    }
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const parsed = JSON.parse(stripFences(text));

    // Compute margins server-side from the real numbers (never trust the model with arithmetic)
    let totalCost = 0;
    let totalPrice = 0;
    const lines = lineItems.map((li: any, i: number) => {
      const cost = Number(li.quantity) * Number(li.unitCost);
      const price = Number(li.quantity) * Number(li.unitPrice);
      totalCost += cost;
      totalPrice += price;
      const ai = (parsed.lines || []).find((l: any) => l.index === i) || {};
      return {
        lineItemId: li.id || `line-${i}`,
        description: String(li.description),
        type: li.type,
        yourRate: Number(li.unitPrice) || 0,
        yourUnit: String(li.unit || 'each'),
        benchmarkLow: ai.benchmarkLow != null ? Number(ai.benchmarkLow) : null,
        benchmarkHigh: ai.benchmarkHigh != null ? Number(ai.benchmarkHigh) : null,
        benchmarkUnit: String(ai.benchmarkUnit || li.unit || 'each'),
        verdict: ['below', 'at', 'above'].includes(ai.verdict) ? ai.verdict : 'at',
        marginPct: marginPct(cost, price),
        recommendation: String(ai.recommendation || ''),
      };
    });

    const overall = marginPct(totalCost, totalPrice) ?? 0;
    return res.status(200).json({
      lines,
      totalCost: Math.round(totalCost * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      overallMarginPct: Math.round(overall * 10) / 10,
      meetsThirtyPct: overall >= 30,
      specificActions: Array.isArray(parsed.specificActions) ? parsed.specificActions.map(String) : [],
      riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String) : [],
      benchmarkNote: String(parsed.benchmarkNote || 'Benchmarks are approximate regional figures.'),
      analyzedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to analyze pricing', detail: String(e?.message || e).slice(0, 300) });
  }
}
