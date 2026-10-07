// POST /api/parse-receipt
// Body: { imageBase64: string, mimeType: string }
// -> { vendor, date (YYYY-MM-DD), amount, category, items[], confidence }

const CATEGORIES = [
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

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  const prompt = `You are a receipt parser for a small business bookkeeping app. Extract the details from this receipt image/PDF.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly these fields:
{
  "vendor": "store or vendor name as printed",
  "date": "YYYY-MM-DD (use the receipt date; if unclear, null)",
  "amount": 123.45,
  "category": "one of: ${CATEGORIES.join(' | ')}",
  "items": ["short list of the main items purchased, max 8"],
  "confidence": "high | medium | low"
}

Rules:
- amount is the TOTAL paid (including tax), as a number with no currency symbol.
- category: pick the best fit. Fuel/gas -> Vehicle/Fuel. Lumber, parts, supplies for jobs -> Materials. Tools/machinery -> Equipment. Restaurants/hotels/flights -> Meals/Travel.
- confidence: high if vendor+date+total are all clearly readable; medium if one is fuzzy; low if you're guessing at more than one field.
- If the image is not a receipt at all, return {"error": "not a receipt"}.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
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
    if (parsed.error) return res.status(422).json({ error: parsed.error });
    // Sanitize
    return res.status(200).json({
      vendor: String(parsed.vendor || 'Unknown vendor'),
      date: parsed.date || null,
      amount: Number(parsed.amount) || 0,
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Other',
      items: Array.isArray(parsed.items) ? parsed.items.map(String).slice(0, 8) : [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to parse receipt', detail: String(e?.message || e).slice(0, 300) });
  }
}
