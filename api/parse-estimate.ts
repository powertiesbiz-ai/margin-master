// POST /api/parse-estimate
// Body: { imageBase64: string, mimeType: string }
// -> { lineItems: [{ description, type, quantity, unit, unitCost, unitPrice }] }

const TYPES = ['Labor', 'Materials', 'Subcontract', 'Other'];

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

  const prompt = `You are an estimator's assistant for a small service business. Extract the line items from this estimate/invoice/quote image or PDF.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly this shape:
{
  "lineItems": [
    {
      "description": "short description of the work or material",
      "type": "Labor | Materials | Subcontract | Other",
      "quantity": 1,
      "unit": "hr | each | sq ft | job | day | etc",
      "unitCost": 0,
      "unitPrice": 0
    }
  ]
}

Rules:
- type: Labor = hourly/day-rate work performed by the business; Materials = physical goods; Subcontract = work done by a sub; Other = fees, permits, rentals.
- unitCost = what it COSTS the business per unit (their cost). unitPrice = what they CHARGE the customer per unit (the price on the document).
- If the document shows only one number per line (the price), set unitPrice to it and unitCost to 0 — the user will fill in costs.
- quantity defaults to 1 when not shown.
- If the image is not an estimate/invoice/quote, return {"error": "not an estimate"}.`;

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
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
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
    const items = (Array.isArray(parsed.lineItems) ? parsed.lineItems : []).map((li: any, i: number) => ({
      description: String(li.description || `Item ${i + 1}`),
      type: TYPES.includes(li.type) ? li.type : 'Other',
      quantity: Number(li.quantity) || 1,
      unit: String(li.unit || 'each'),
      unitCost: Number(li.unitCost) || 0,
      unitPrice: Number(li.unitPrice) || 0,
    }));
    return res.status(200).json({ lineItems: items });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to parse estimate', detail: String(e?.message || e).slice(0, 300) });
  }
}
