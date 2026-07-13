// api/classify.js — Vercel Serverless Function
// Usa Last.fm track.getTopTags para clasificar canciones por tags reales de usuarios

const LASTFM_KEY = process.env.LASTFM_API_KEY;

// Tags de Last.fm → categoría VibeSort
const TAG_RULES = [
  // Sevillanas / Flamenco
  ['flamenco','sevillanas'],['rumba','sevillanas'],['copla','sevillanas'],
  ['sevillanas','sevillanas'],['spanish folk','sevillanas'],['andalucia','sevillanas'],

  // Pista salvaje
  ['techno','pista_salvaje'],['house','pista_salvaje'],['edm','pista_salvaje'],
  ['electronic dance','pista_salvaje'],['trance','pista_salvaje'],['rave','pista_salvaje'],
  ['club','pista_salvaje'],['dance','pista_salvaje'],['eurodance','pista_salvaje'],
  ['electro','pista_salvaje'],['dubstep','pista_salvaje'],['hardstyle','pista_salvaje'],

  // Previa
  ['reggaeton','previa'],['latin','previa'],['urban','previa'],['trap','previa'],
  ['hip hop','previa'],['hip-hop','previa'],['rap','previa'],['party','previa'],
  ['cumbia','previa'],['salsa','previa'],['dancehall','previa'],

  // Sobremesa
  ['pop','sobremesa'],['indie pop','sobremesa'],['summer','sobremesa'],
  ['happy','sobremesa'],['fun','sobremesa'],['sunshine','sobremesa'],

  // Romántico
  ['romantic','romantico'],['romance','romantico'],['love','romantico'],
  ['r&b','romantico'],['soul','romantico'],['ballad','romantico'],
  ['bolero','romantico'],['slow','romantico'],

  // Disco & 80s
  ['disco','disco_80s'],['80s','disco_80s'],['synth-pop','disco_80s'],
  ['new wave','disco_80s'],['classic rock','disco_80s'],['funk','disco_80s'],
  ['retro','disco_80s'],['oldies','disco_80s'],

  // Deporte
  ['metal','deporte'],['heavy metal','deporte'],['punk','deporte'],
  ['rock','deporte'],['hard rock','deporte'],['workout','deporte'],
  ['energetic','deporte'],['aggressive','deporte'],

  // Estudio
  ['jazz','estudio'],['classical','estudio'],['ambient','estudio'],
  ['lo-fi','estudio'],['instrumental','estudio'],['piano','estudio'],
  ['bossa nova','estudio'],['study','estudio'],['focus','estudio'],
  ['background','estudio'],

  // Relax
  ['acoustic','relax'],['folk','relax'],['indie','relax'],['chill','relax'],
  ['chillout','relax'],['relaxing','relax'],['calm','relax'],['soft','relax'],
  ['mellow','relax'],['singer-songwriter','relax'],

  // Vuelta a casa
  ['melancholic','vuelta_a_casa'],['sad','vuelta_a_casa'],['dark','vuelta_a_casa'],
  ['trip-hop','vuelta_a_casa'],['downtempo','vuelta_a_casa'],['shoegaze','vuelta_a_casa'],
  ['post-rock','vuelta_a_casa'],['dream pop','vuelta_a_casa'],
];

function categoryFromTags(tags = []) {
  const tagNames = tags.map(t => t.name?.toLowerCase() || '');
  for (const [keyword, cat] of TAG_RULES) {
    if (tagNames.some(t => t.includes(keyword))) return cat;
  }
  return null;
}

async function getTagsForTrack(artist, track) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.gettoptags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_KEY}&format=json&autocorrect=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data?.toptags?.tag || [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tracks } = req.body;
  if (!tracks?.length) return res.status(400).json({ error: 'tracks required' });

  const results = [];

  for (let i = 0; i < tracks.length; i++) {
    const { artist, name, id } = tracks[i];
    const tags = await getTagsForTrack(artist, name);
    const category = categoryFromTags(tags) || 'sobremesa';
    results.push({ id, category });

    // Rate limit: Last.fm permite ~5 req/seg
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 250));
  }

  return res.json({ results });
}
