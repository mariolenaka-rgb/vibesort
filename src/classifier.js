export const CATEGORIES = [
  { id: 'lenta',         name: 'Lentas',             emoji: '🌙', description: 'Baladas, desamor, noche tranquila.',             color: '#5E5CE6' },
  { id: 'sobremesa',     name: 'Sobremesa',           emoji: '🍷', description: 'Jazz, bossa nova, conversación relajada.',       color: '#FFCC00' },
  { id: 'cafe',          name: 'Café',                emoji: '☕', description: 'Acústico, lo-fi, mañana y concentración.',       color: '#A0522D' },
  { id: 'inicio_fiesta', name: 'Inicio de Fiesta',    emoji: '🌅', description: 'Calentando ambiente, funk, salsa, bachata.',    color: '#FF9500' },
  { id: 'fiesta',        name: 'Fiesta',              emoji: '🎉', description: 'Pista de baile, energía alta, euforia.',        color: '#FF3B30' },
  { id: 'salvaje',       name: 'Salvaje',             emoji: '🔥', description: 'Techno duro, metal, reggaeton agresivo.',       color: '#FF2D55' },
  { id: 'horteradas',    name: 'Horteradas',          emoji: '🪩', description: 'Eurodance, bakala, pop cutre, guilty pleasure.', color: '#FF69B4' },
  { id: 'folk',          name: 'Folk & Raíces',       emoji: '🎸', description: 'Flamenco, sevillanas, folk, rumba.',            color: '#8B4513' },
  { id: 'romantica',     name: 'Romántica',           emoji: '💕', description: 'Citas, íntimo, sensual suave.',                 color: '#E91E8C' },
  { id: 'gym',           name: 'Gym & Running',       emoji: '💪', description: 'Alta energía, motivación, BPM alto.',           color: '#30D158' },
  { id: '60s_esp',       name: 'Los 60 Españoles',    emoji: '🎙️', description: 'Ye-yé, copla moderna, pop beat español.',     color: '#FFD700' },
  { id: '70s',           name: 'Los 70',              emoji: '🪘', description: 'Rock clásico, disco, soul, ABBA, funk.',       color: '#CD853F' },
  { id: '80s',           name: 'Los 80',              emoji: '🕹️', description: 'Movida, synth-pop, new wave, pop global.',    color: '#AF52DE' },
  { id: '90s',           name: 'Los 90',              emoji: '📼', description: 'Eurodance, grunge, britpop, pop 90s.',         color: '#64D2FF' },
  { id: '2000s',         name: 'Los 2000',            emoji: '💿', description: 'Pop 2000s, indie, reggaeton naciente.',        color: '#34C759' },
  { id: '2010s',         name: 'Los 2010',            emoji: '📱', description: 'Trap, urbano latino, pop streaming.',          color: '#007AFF' },
  { id: 'indie',         name: 'Indie & Alternativo', emoji: '🎧', description: 'Indie rock, indie pop, alternativo.',          color: '#636366' },
  { id: 'patanegra',     name: 'Pata Negra',          emoji: '🥇', description: 'Lo mejor del pop-rock español.',               color: '#C0A030' },
  { id: 'navidad',       name: 'Navidad',             emoji: '🎄', description: 'Villancicos, clásicos navideños.',             color: '#00C851' },
  { id: 'sin_clasificar',name: 'Sin Clasificar',      emoji: '❓', description: 'Sin datos suficientes para clasificar.',       color: '#444444' },
];

// Clasifica usando /api/classify (Last.fm artist tags + año Spotify)
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
        year: parseInt(t.album?.release_date?.substring(0, 4)) || null,
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
          const cat = catMap[t.id] || 'sin_clasificar';
          if (result[cat] !== undefined) result[cat].push(t);
          else result['sin_clasificar'].push(t);
        });
      } else {
        batch.forEach(t => result['sin_clasificar'].push(t));
      }
    } catch {
      batch.forEach(t => result['sin_clasificar'].push(t));
    }

    processed += batch.length;
    onProgress?.(processed, tracks.length);
    await new Promise(r => setTimeout(r, 300));
  }

  return result;
}
