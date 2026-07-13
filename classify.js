// api/classify.js — Vercel Serverless Function
// La API key de Anthropic vive aquí, nunca expuesta al navegador

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tracks } = req.body;
  if (!tracks || !Array.isArray(tracks)) {
    return res.status(400).json({ error: 'tracks array required' });
  }

  // Lista de categorías válidas
  const categories = [
    'pista_salvaje',  // techno, house, EDM, muy bailable
    'previa',         // reggaeton, pop bailable, urban, inicio de fiesta
    'sobremesa',      // pop tranquilo, positivo, tarde de domingo
    'sevillanas',     // flamenco, copla, rumba, música española
    'romantico',      // baladas, soul, R&B romántico, boleros
    'disco_80s',      // disco, 80s, synth-pop, clásicos del pop
    'deporte',        // metal, rock duro, hip-hop intenso, para entrenar
    'estudio',        // jazz, clásica, ambient, lo-fi, instrumental
    'relax',          // acústico, indie tranquilo, folk, singer-songwriter
    'vuelta_a_casa',  // after, melancólico, madrugada, electrónica suave
  ];

  // Construir lista de canciones para el prompt
  const songList = tracks
    .map((t, i) => `${i + 1}. "${t.name}" — ${t.artist}`)
    .join('\n');

  const prompt = `Eres un experto en música española y cultura de ocio. Clasifica cada canción en UNA de estas categorías según el momento en que se escucharía:

- pista_salvaje: techno, house, EDM, muy bailable, pista de discoteca
- previa: reggaeton, pop urbano, inicio de fiesta, primeras copas
- sobremesa: pop tranquilo, positivo, sobremesa del domingo, buen rollo
- sevillanas: flamenco, copla, rumba flamenca, música española tradicional
- romantico: baladas, soul, R&B romántico, boleros, momentos íntimos
- disco_80s: disco, años 80, synth-pop, clásicos del pop internacional
- deporte: metal, rock duro, hip-hop potente, para entrenar
- estudio: jazz, música clásica, ambient, lo-fi, instrumental, concentración
- relax: acústico, indie tranquilo, folk, singer-songwriter, descanso
- vuelta_a_casa: after, melancólico, madrugada, electrónica suave, reflexivo

CANCIONES A CLASIFICAR:
${songList}

Responde SOLO con un array JSON válido, sin texto adicional, sin markdown, sin explicaciones:
[{"index": 1, "category": "categoria"}, {"index": 2, "category": "categoria"}, ...]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Claude API error', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';

    // Parsear JSON de respuesta
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'JSON parse error', raw: text });
    }

    // Mapear índice → categoría válida
    const result = parsed.map(item => ({
      index: item.index - 1, // convertir a 0-based
      category: categories.includes(item.category) ? item.category : 'relax',
    }));

    return res.json({ result });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
