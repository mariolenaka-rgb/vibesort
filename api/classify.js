// api/classify.js — VibeSort Serverless Function
// Taxonomía v7 — 19 contextos · Artist-level Last.fm + año Spotify

const LASTFM_KEY = process.env.LASTFM_API_KEY;

// ── Tags navideños (prioridad absoluta) ─────────────────────────────────────
const XMAS_TAGS = ['christmas','navidad','villancico','holiday','noel','xmas','navideño'];

// ── Tags que indican música española (para detectar 60s_esp) ────────────────
const SPANISH_TAGS = [
  'spanish','spain','español','españa','spanish pop',
  'ye-ye','ye yé','copla','flamenco','sevillanas','spanish rock',
  'spanish indie','musica española','pop español',
];

// ── Reglas tag → contexto (orden = prioridad, primera coincidencia gana) ────
const TAG_RULES = [
  // FOLK & RAÍCES (específicos primero)
  ['sevillanas','folk'],['flamenco','folk'],['copla','folk'],
  ['fandango','folk'],['buleria','folk'],['rumba','folk'],
  ['andalucia','folk'],['spanish folk','folk'],
  ['bluegrass','folk'],['country','folk'],['roots','folk'],

  // INDIE & ALTERNATIVO (específicos primero)
  ['indie rock','indie'],['alternative rock','indie'],['indie pop','indie'],
  ['alternative','indie'],['shoegaze','indie'],['dream pop','indie'],
  ['garage rock','indie'],['grunge','indie'],['post-rock','indie'],
  ['post-punk','indie'],['progressive rock','indie'],
  ['britpop','indie'],['brit pop','indie'],

  // HORTERADAS (tags únicos, sin conflictos)
  ['cheesy','horteradas'],['kitsch','horteradas'],['campy','horteradas'],
  ['guilty pleasure','horteradas'],['bakala','horteradas'],['bakalao','horteradas'],
  ['makina','horteradas'],['eurodance','horteradas'],['bubblegum','horteradas'],
  ['schlager','horteradas'],['verbena','horteradas'],

  // SALVAJE
  ['techno','salvaje'],['drum and bass','salvaje'],['dnb','salvaje'],
  ['hardstyle','salvaje'],['industrial','salvaje'],['hardcore','salvaje'],
  ['speedcore','salvaje'],['heavy metal','salvaje'],['death metal','salvaje'],
  ['black metal','salvaje'],['hard techno','salvaje'],

  // GYM
  ['workout','gym'],['running','gym'],['exercise','gym'],['fitness','gym'],

  // FIESTA
  ['reggaeton','fiesta'],['house','fiesta'],['trance','fiesta'],
  ['club','fiesta'],['edm','fiesta'],['electro pop','fiesta'],
  ['dance pop','fiesta'],['trap','fiesta'],
  ['hip hop','fiesta'],['hip-hop','fiesta'],['rap','fiesta'],
  ['urban','fiesta'],['dembow','fiesta'],

  // INICIO DE FIESTA
  ['bachata','inicio_fiesta'],['salsa','inicio_fiesta'],
  ['merengue','inicio_fiesta'],['cumbia','inicio_fiesta'],
  ['funk','inicio_fiesta'],['nu-disco','inicio_fiesta'],
  ['tropical','inicio_fiesta'],['disco','inicio_fiesta'],
  ['dance','inicio_fiesta'],['afrobeat','inicio_fiesta'],

  // PATA NEGRA
  ['cantautor','patanegra'],['nueva trova','patanegra'],
  ['cancion de autor','patanegra'],

  // ROMÁNTICA
  ['romantic','romantica'],['romance','romantica'],
  ['love songs','romantica'],['bolero','romantica'],
  ['balada','romantica'],['sensual','romantica'],
  ['r&b','romantica'],['soul','romantica'],

  // SOBREMESA
  ['jazz','sobremesa'],['bossa nova','sobremesa'],['swing','sobremesa'],
  ['fado','sobremesa'],['chanson','sobremesa'],
  ['mpb','sobremesa'],['samba','sobremesa'],['lounge','sobremesa'],

  // CAFÉ
  ['lo-fi','cafe'],['lofi','cafe'],['acoustic','cafe'],
  ['singer-songwriter','cafe'],['classical','cafe'],
  ['ambient','cafe'],['instrumental','cafe'],['study','cafe'],

  // LENTAS
  ['melancholic','lenta'],['sad','lenta'],['slow','lenta'],
  ['mellow','lenta'],['ballad','lenta'],['heartbreak','lenta'],
  ['trip-hop','lenta'],['downtempo','lenta'],

  // CATCHES GENÉRICOS (último recurso)
  ['folk','folk'],
  ['indie','indie'],
  ['metal','salvaje'],['hard rock','salvaje'],['punk','salvaje'],
  ['rock','indie'],
  ['pop','sobremesa'],
  ['latin','inicio_fiesta'],
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function isSpanish(tags) {
  return SPANISH_TAGS.some(s => tags.some(t => t.includes(s)));
}

function classify(tags, year) {
  // 1. Navidad — prioridad absoluta
  if (XMAS_TAGS.some(x => tags.some(t => t.includes(x)))) return 'navidad';

  // 2. Décadas por año de lanzamiento
  if (year) {
    if (year >= 1960 && year <= 1969 && isSpanish(tags)) return '60s_esp';
    if (year >= 1970 && year <= 1979) return '70s';
    if (year >= 1980 && year <= 1989) return '80s';
    if (year >= 1990 && year <= 1999) return '90s';
    if (year >= 2000 && year <= 2009) return '2000s';
    if (year >= 2010 && year <= 2019) return '2010s';
  }

  // 3. Tags Last.fm
  for (const [keyword, cat] of TAG_RULES) {
    if (tags.some(t => t.includes(keyword))) return cat;
  }

  return null;
}

// ── Last.fm: tags por artista (caché en memoria por invocación) ─────────────
const artistCache = {};

async function getArtistTags(artist) {
  const key = artist.toLowerCase().trim();
  if (artistCache[key]) return artistCache[key];

  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_KEY}&format=json&autocorrect=1`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const tags = (data?.toptags?.tag || []).map(t => t.name?.toLowerCase() || '');
    artistCache[key] = tags;
    return tags;
  } catch {
    artistCache[key] = [];
    return [];
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tracks } = req.body;
  if (!tracks?.length) return res.status(400).json({ error: 'tracks required' });

  // Artistas únicos en este batch
  const artists = [...new Set(tracks.map(t => t.artist).filter(Boolean))];

  // Fetch 5 artistas en paralelo
  const PARALLEL = 5;
  for (let i = 0; i < artists.length; i += PARALLEL) {
    await Promise.all(artists.slice(i, i + PARALLEL).map(getArtistTags));
  }

  // Clasificar cada track con los tags de su artista
  const results = tracks.map(({ id, artist, year }) => {
    const tags = artistCache[artist?.toLowerCase().trim()] || [];
    const category = classify(tags, year) || 'sin_clasificar';
    return { id, category };
  });

  return res.json({ results });
}
