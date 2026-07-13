// ─── CLASIFICADOR — Claude API ────────────────────────────────────────────────
// Llama a /api/classify (Vercel serverless) que usa Claude para clasificar
// por nombre de canción + artista. No depende de Audio Features (deprecado).

export const CATEGORIES = [
  { id: 'pista_salvaje', name: 'Pista Salvaje',         emoji: '🔥', description: 'La noche está lanzada. Máxima energía.',        color: '#FF3B30' },
  { id: 'previa',        name: 'Previa / Inicio fiesta', emoji: '🎉', description: 'Primeras copas, el ambiente se calienta.',       color: '#FF9500' },
  { id: 'sobremesa',     name: 'Sobremesa',              emoji: '🌅', description: 'Después de comer, buen rollo, conversación.',    color: '#FFCC00' },
  { id: 'sevillanas',    name: 'Sevillanas / Flamenco',  emoji: '💃', description: 'Copla, rumba, flamenco, lo nuestro.',           color: '#FF2D55' },
  { id: 'romantico',     name: 'Romántico',              emoji: '❤️', description: 'Baladas, soul, momentos íntimos.',              color: '#E91E8C' },
  { id: 'disco_80s',     name: 'Disco & 80s',            emoji: '🕺', description: 'Clásicos que nunca fallan.',                    color: '#AF52DE' },
  { id: 'deporte',       name: 'Deporte',                emoji: '🏃', description: 'Máxima potencia para entrenar.',                color: '#30D158' },
  { id: 'estudio',       name: 'Estudio / Foco',         emoji: '📚', description: 'Jazz, clásica, lo-fi. Para concentrarse.',     color: '#64D2FF' },
  { id: 'relax',         name: 'Relax / Chill',          emoji: '😌', description: 'Acústico, indie tranquilo, folk.',              color: '#5E5CE6' },
  { id: 'vuelta_a_casa', name: 'Vuelta a Casa',           emoji: '🌙', description: 'After. Melancólico, electrónica suave.',       color: '#636366' },
];

const BATCH_SIZE = 30; // canciones por llamada a Claude

// ── Clasifica un lote de canciones via Claude API ─────────────────────────────
async function classifyBatch(tracks) {
  const payload = tracks.map(t => ({
    name: t.name,
    artist: t.artists?.[0]?.name || 'Desconocido',
  }));

  const res = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tracks: payload }),
  });

  if (!res.ok) throw new Error('Error en /api/classify: ' + res.status);
  const data = await res.json();
  return data.result || [];
}

// ── Clasifica toda la biblioteca en lotes ────────────────────────────────────
export async function classifyLibrary(tracks, onProgress) {
  const result = {};
  CATEGORIES.forEach(c => (result[c.id] = []));

  let processed = 0;

  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);

    try {
      const assignments = await classifyBatch(batch);

      assignments.forEach(({ index, category }) => {
        const track = batch[index];
        if (track && result[category]) {
          result[category].push(track);
        }
      });
    } catch (err) {
      // Si falla el lote, va todo a relax
      batch.forEach(t => result['relax'].push(t));
      console.warn('Batch error:', err);
    }

    processed += batch.length;
    onProgress?.(processed, tracks.length);

    // Pausa entre lotes para no saturar
    if (i + BATCH_SIZE < tracks.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return result;
}
