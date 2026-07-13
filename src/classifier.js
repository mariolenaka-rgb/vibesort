// ─── CLASIFICADOR POR GÉNEROS DE ARTISTA ────────────────────────────────────
// Usa el endpoint /v1/artists de Spotify (no deprecado) para obtener géneros
// y clasificar por coincidencia de palabras clave.

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

// Mapa género (substring) → categoría
const GENRE_RULES = [
  // Sevillanas primero (muy específico)
  ['flamenco',     'sevillanas'],
  ['rumba',        'sevillanas'],
  ['copla',        'sevillanas'],
  ['sevillana',    'sevillanas'],
  ['spanish folk', 'sevillanas'],
  ['nuevo flamenco','sevillanas'],
  ['flamenco pop', 'sevillanas'],
  ['cancion españ','sevillanas'],

  // Pista salvaje
  ['techno',       'pista_salvaje'],
  ['house',        'pista_salvaje'],
  ['edm',          'pista_salvaje'],
  ['trance',       'pista_salvaje'],
  ['drum and bass','pista_salvaje'],
  ['hardstyle',    'pista_salvaje'],
  ['dubstep',      'pista_salvaje'],
  ['electro',      'pista_salvaje'],

  // Previa
  ['reggaeton',    'previa'],
  ['latin',        'previa'],
  ['urban',        'previa'],
  ['trap',         'previa'],
  ['hip hop',      'previa'],
  ['hip-hop',      'previa'],
  ['dancehall',    'previa'],
  ['dembow',       'previa'],

  // Disco & 80s
  ['disco',        'disco_80s'],
  ['new wave',     'disco_80s'],
  ['synth',        'disco_80s'],
  ['glam',         'disco_80s'],
  ['80s',          'disco_80s'],
  ['classic rock', 'disco_80s'],

  // Romántico
  ['r&b',          'romantico'],
  ['soul',         'romantico'],
  ['bolero',       'romantico'],
  ['balada',       'romantico'],
  ['romance',      'romantico'],

  // Deporte
  ['metal',        'deporte'],
  ['punk',         'deporte'],
  ['hardcore',     'deporte'],
  ['hard rock',    'deporte'],

  // Estudio
  ['jazz',         'estudio'],
  ['classical',    'estudio'],
  ['ambient',      'estudio'],
  ['lo-fi',        'estudio'],
  ['lofi',         'estudio'],
  ['instrumental', 'estudio'],
  ['piano',        'estudio'],
  ['bossa',        'estudio'],

  // Relax
  ['acoustic',     'relax'],
  ['folk',         'relax'],
  ['indie',        'relax'],
  ['singer-song',  'relax'],
  ['chillout',     'relax'],
  ['chill',        'relax'],

  // Vuelta a casa
  ['post-rock',    'vuelta_a_casa'],
  ['shoegaze',     'vuelta_a_casa'],
  ['dream pop',    'vuelta_a_casa'],
];

function categoryFromGenres(genres = []) {
  const joined = genres.join(' ').toLowerCase();
  for (const [keyword, cat] of GENRE_RULES) {
    if (joined.includes(keyword)) return cat;
  }
  return null;
}

// Fallback por nombre de canción/artista (heurísticas básicas)
function categoryFromName(track) {
  const text = `${track.name} ${track.artists?.[0]?.name || ''}`.toLowerCase();
  if (/sevillana|rumba|flamenc|copla/.test(text)) return 'sevillanas';
  if (/love|amor|corazón|quiero|quieres|bésame/.test(text)) return 'romantico';
  if (/fiesta|party|baila|dance/.test(text)) return 'previa';
  return 'sobremesa'; // default positivo
}

export function classifyLibrary(tracks, genreMap) {
  const result = {};
  CATEGORIES.forEach(c => (result[c.id] = []));

  for (const track of tracks) {
    if (!track?.id) continue;
    const artistId = track.artists?.[0]?.id;
    const genres = artistId ? (genreMap[artistId] || []) : [];
    const cat = categoryFromGenres(genres) || categoryFromName(track);
    result[cat].push(track);
  }

  return result;
}
