export const CATEGORIES = [
  { id: 'pista_salvaje', name: 'Pista Salvaje',         emoji: '🔥', description: 'Techno, house, EDM. La noche está lanzada.',     color: '#FF3B30' },
  { id: 'previa',        name: 'Previa / Inicio fiesta', emoji: '🎉', description: 'Reggaeton, pop urbano. Primeras copas.',          color: '#FF9500' },
  { id: 'sobremesa',     name: 'Sobremesa',              emoji: '🌅', description: 'Pop tranquilo, buen rollo, tarde de domingo.',   color: '#FFCC00' },
  { id: 'sevillanas',    name: 'Sevillanas / Flamenco',  emoji: '💃', description: 'Flamenco, copla, rumba, lo nuestro.',           color: '#FF2D55' },
  { id: 'romantico',     name: 'Romántico',              emoji: '❤️', description: 'Baladas, soul, R&B. Momentos íntimos.',         color: '#E91E8C' },
  { id: 'disco_80s',     name: 'Disco & 80s',            emoji: '🕺', description: 'Disco, synth-pop, clásicos que nunca fallan.',  color: '#AF52DE' },
  { id: 'deporte',       name: 'Deporte',                emoji: '🏃', description: 'Metal, rock duro, hip-hop. Para entrenar.',     color: '#30D158' },
  { id: 'estudio',       name: 'Estudio / Foco',         emoji: '📚', description: 'Jazz, clásica, ambient, lo-fi.',               color: '#64D2FF' },
  { id: 'relax',         name: 'Relax / Chill',          emoji: '😌', description: 'Acústico, indie, folk. Para descansar.',        color: '#5E5CE6' },
  { id: 'vuelta_a_casa', name: 'Vuelta a Casa',           emoji: '🌙', description: 'After, melancólico, electrónica suave.',       color: '#636366' },
];

// Clasifica usando los resultados de Last.fm (llamada previa a /api/classify)
export async function classifyLibrary(tracks, onProgress) {
  const result = {};
  CATEGORIES.forEach(c => (result[c.id] = []));

  const BATCH = 20;
  let processed = 0;

  for (let i = 0; i < tracks.length; i += BATCH) {
    const batch = tracks.slice(i, i + BATCH);

    try {
      const payload = batch.map(t => ({
        id: t.id,
        name: t.name,
        artist: t.artists?.[0]?.name || '',
      }));

      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: payload }),
      });

      if (res.ok) {
        const data = await res.json();
        const catMap = {};
        (data.results || []).forEach(r => { catMap[r.id] = r.category; });

        batch.forEach(t => {
          const cat = catMap[t.id] || 'sobremesa';
          if (result[cat]) result[cat].push(t);
        });
      } else {
        batch.forEach(t => result['sobremesa'].push(t));
      }
    } catch {
      batch.forEach(t => result['sobremesa'].push(t));
    }

    processed += batch.length;
    onProgress?.(processed, tracks.length);
    await new Promise(r => setTimeout(r, 300));
  }

  return result;
}
