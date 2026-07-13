// ─── CLASIFICADOR DE CANCIONES ────────────────────────────────────────────────
// Fase 1: reglas basadas en Audio Features + Géneros del artista
// Fase 2 (pendiente): clasificación semántica con Claude API

export const CATEGORIES = [
  {
    id: 'pista_salvaje',
    name: 'Pista Salvaje',
    emoji: '🔥',
    description: 'La noche está lanzada. Máxima energía en la pista.',
    color: '#FF3B30',
    hint: 'energy alto + danceability alto',
  },
  {
    id: 'previa',
    name: 'Previa / Inicio de fiesta',
    emoji: '🎉',
    description: 'Primeras copas, el ambiente se calienta.',
    color: '#FF9500',
    hint: 'energy medio-alto + bailable',
  },
  {
    id: 'sobremesa',
    name: 'Sobremesa',
    emoji: '🌅',
    description: 'Después de comer, conversación, buen rollo.',
    color: '#FFCC00',
    hint: 'positivo + relajado + no muy bailable',
  },
  {
    id: 'sevillanas',
    name: 'Sevillanas / Flamenco',
    emoji: '💃',
    description: 'Copla, rumba, flamenco, lo nuestro.',
    color: '#FF2D55',
    hint: 'género flamenco/copla detectado',
  },
  {
    id: 'romantico',
    name: 'Romántico',
    emoji: '❤️',
    description: 'Para momentos íntimos y emotivos.',
    color: '#E91E8C',
    hint: 'valence medio + energy bajo + acústico',
  },
  {
    id: 'disco_80s',
    name: 'Disco & 80s',
    emoji: '🕺',
    description: 'Clásicos que nunca fallan.',
    color: '#AF52DE',
    hint: 'género disco/80s + bailable + tempo medio',
  },
  {
    id: 'deporte',
    name: 'Deporte',
    emoji: '🏃',
    description: 'Máxima potencia para entrenar.',
    color: '#30D158',
    hint: 'energy muy alto + tempo rápido',
  },
  {
    id: 'estudio',
    name: 'Estudio / Foco',
    emoji: '📚',
    description: 'Para concentrarse y trabajar.',
    color: '#64D2FF',
    hint: 'instrumental o muy baja energía',
  },
  {
    id: 'relax',
    name: 'Relax / Chill',
    emoji: '😌',
    description: 'Desconectar, respirar, disfrutar.',
    color: '#5E5CE6',
    hint: 'energy bajo + acústico',
  },
  {
    id: 'vuelta_a_casa',
    name: 'Vuelta a Casa',
    emoji: '🌙',
    description: 'El after. Reflexivo y tranquilo tras la noche.',
    color: '#636366',
    hint: 'energy muy bajo + melancólico',
  },
];

// ── Mapas de géneros de Spotify → categoría ──────────────────────────────────
// Los géneros de Spotify son strings en inglés, ej: "flamenco", "reggaeton", "disco"

const GENRE_MAP = {
  // Sevillanas / Flamenco
  flamenco: 'sevillanas', rumba: 'sevillanas', copla: 'sevillanas',
  'spanish folk': 'sevillanas', 'musica populares': 'sevillanas',
  'nuevo flamenco': 'sevillanas', 'flamenco pop': 'sevillanas',

  // Disco / 80s
  disco: 'disco_80s', 'italo disco': 'disco_80s', synth: 'disco_80s',
  'new wave': 'disco_80s', 'classic rock': 'disco_80s', 'pop rock': 'disco_80s',
  '80s': 'disco_80s', 'glam rock': 'disco_80s', 'soft rock': 'disco_80s',

  // Electrónica / Pista
  techno: 'pista_salvaje', house: 'pista_salvaje', edm: 'pista_salvaje',
  trance: 'pista_salvaje', 'drum and bass': 'pista_salvaje',
  'hard techno': 'pista_salvaje', 'tech house': 'pista_salvaje',
  'minimal techno': 'pista_salvaje', 'progressive house': 'pista_salvaje',

  // Previa / Urban
  reggaeton: 'previa', 'latin pop': 'previa', 'urban latin': 'previa',
  trap: 'previa', 'latin trap': 'previa', 'pop urbano': 'previa',
  pop: 'previa', 'dance pop': 'previa',

  // Romántico
  'r&b': 'romantico', soul: 'romantico', bolero: 'romantico',
  balada: 'romantico', romantic: 'romantico',

  // Deporte
  metal: 'deporte', 'heavy metal': 'deporte', punk: 'deporte',
  hardcore: 'deporte', 'hard rock': 'deporte',

  // Estudio
  ambient: 'estudio', classical: 'estudio', 'neo-classical': 'estudio',
  jazz: 'estudio', instrumental: 'estudio', piano: 'estudio',
  'lo-fi': 'estudio', lofi: 'estudio',

  // Relax
  acoustic: 'relax', folk: 'relax', indie: 'relax',
  'singer-songwriter': 'relax', bossa: 'relax', 'bossa nova': 'relax',
};

function categoryFromGenres(genres = []) {
  for (const genre of genres) {
    const lc = genre.toLowerCase();
    for (const [key, cat] of Object.entries(GENRE_MAP)) {
      if (lc.includes(key)) return cat;
    }
  }
  return null;
}

// ── Clasificación por Audio Features ─────────────────────────────────────────

function categoryFromFeatures(f) {
  if (!f) return null;
  const { energy = 0.5, danceability = 0.5, valence = 0.5,
          tempo = 120, acousticness = 0.3, instrumentalness = 0 } = f;

  // Deporte: muy alta energía + tempo rápido
  if (energy > 0.82 && tempo > 135) return 'deporte';

  // Pista salvaje: alta energía + muy bailable
  if (energy > 0.76 && danceability > 0.72) return 'pista_salvaje';

  // Previa: energía media-alta + bailable
  if (energy > 0.57 && danceability > 0.63) return 'previa';

  // Romántico: valence media + energía baja + algo acústico
  if (valence > 0.35 && valence < 0.72 && energy < 0.48 && acousticness > 0.28) return 'romantico';

  // Estudio: muy instrumental o muy tranquilo y poco bailable
  if (instrumentalness > 0.45 || (energy < 0.45 && danceability < 0.42)) return 'estudio';

  // Sobremesa: positivo + energía media + no muy bailable
  if (valence > 0.62 && energy > 0.35 && energy < 0.65 && danceability < 0.68) return 'sobremesa';

  // Vuelta a casa: poca energía + bajo valence
  if (energy < 0.38 && valence < 0.45) return 'vuelta_a_casa';

  // Relax: baja energía general
  if (energy < 0.43) return 'relax';

  // Default: sobremesa
  return 'sobremesa';
}

// ── Función principal de clasificación ───────────────────────────────────────

export function classifySong(track, features, artistGenres = []) {
  // 1. Prioridad: géneros del artista (más fiables para categorías culturales)
  const fromGenre = categoryFromGenres(artistGenres);
  if (fromGenre) return fromGenre;

  // 2. Fallback: audio features numéricas
  const fromFeatures = categoryFromFeatures(features);
  if (fromFeatures) return fromFeatures;

  // 3. Default
  return 'relax';
}

// ── Clasifica toda la biblioteca ──────────────────────────────────────────────

export function classifyLibrary(tracks, featuresMap, genreMap) {
  // Inicializar resultado vacío
  const result = {};
  CATEGORIES.forEach(c => (result[c.id] = []));

  for (const track of tracks) {
    if (!track || !track.id) continue;
    const features = featuresMap[track.id] || null;
    const artistId = track.artists?.[0]?.id;
    const genres = artistId ? (genreMap[artistId] || []) : [];
    const catId = classifySong(track, features, genres);
    result[catId].push(track);
  }

  return result;
}
