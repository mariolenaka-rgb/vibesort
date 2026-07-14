// ─── SPOTIFY API ─────────────────────────────────────────────────────────────
// OAuth 2.0 PKCE (no backend necesario) + llamadas a la API

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin;
const SCOPES = [
  'user-library-read',
  'playlist-read-private',   'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
].join(' ');

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(len = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(x => chars[x % chars.length])
    .join('');
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function startAuth() {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    show_dialog: 'true',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code) {
  const verifier = localStorage.getItem('pkce_verifier');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error('Token exchange failed: ' + res.status);
  const data = await res.json();
  localStorage.setItem('vs_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('vs_refresh', data.refresh_token);
  return data.access_token;
}

export function getStoredToken() {
  return localStorage.getItem('vs_token');
}

export function logout() {
  localStorage.removeItem('vs_token');
  localStorage.removeItem('vs_refresh');
  localStorage.removeItem('pkce_verifier');
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(token, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Token expirado. Vuelve a conectar tu Spotify.');
  }
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

// Pausa para respetar rate limits de Spotify (~180 req/min)
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Datos de usuario ──────────────────────────────────────────────────────────

export async function getCurrentUser(token) {
  return apiFetch(token, 'https://api.spotify.com/v1/me');
}

// ── Liked Songs (paginado) ────────────────────────────────────────────────────

export async function fetchLikedSongs(token, onProgress) {
  const songs = [];
  let url = 'https://api.spotify.com/v1/me/tracks?limit=50';

  while (url) {
    const data = await apiFetch(token, url);
    songs.push(...data.items.map(i => i.track).filter(Boolean));
    onProgress?.(songs.length, data.total);
    url = data.next;
    await sleep(150);
  }

  return songs;
}

// ── Audio Features (lotes de 100) ─────────────────────────────────────────────
// NOTA: Este endpoint puede estar restringido para apps nuevas (deprecado nov 2024)
// Si devuelve 403, se usa clasificación por género como fallback

export async function fetchAudioFeatures(token, trackIds, onProgress) {
  const features = [];
  const BATCH = 100;

  for (let i = 0; i < trackIds.length; i += BATCH) {
    const batch = trackIds.slice(i, i + BATCH);
    try {
      const data = await apiFetch(
        token,
        `https://api.spotify.com/v1/audio-features?ids=${batch.join(',')}`
      );
      features.push(...(data.audio_features || batch.map(() => null)));
    } catch {
      // Si falla, rellenamos con null para ese lote
      features.push(...batch.map(() => null));
    }
    onProgress?.(Math.min(i + BATCH, trackIds.length));
    await sleep(200);
  }

  return features;
}

// ── Géneros del artista ───────────────────────────────────────────────────────
// Se usa como fallback si Audio Features no está disponible

export async function fetchArtistGenres(token, artistIds) {
  const genreMap = {};
  const BATCH = 50;

  // Deduplica artistas
  const unique = [...new Set(artistIds)].filter(Boolean);

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    try {
      const data = await apiFetch(
        token,
        `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`
      );
      (data.artists || []).forEach(a => {
        if (a) genreMap[a.id] = a.genres || [];
      });
    } catch { /* sigue */ }
    await sleep(200);
  }

  return genreMap;
}

// ── Crear playlist en Spotify ─────────────────────────────────────────────────

export async function createPlaylist(token, userId, name, description, trackUris) {
  // 1. Crear playlist vacía
  const res = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!res.ok) throw new Error('No se pudo crear la playlist');
  const playlist = await res.json();

  // 2. Añadir canciones en lotes de 100
  for (let i = 0; i < trackUris.length; i += 100) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
    });
    await sleep(200);
  }

  return playlist;
}
export async function fetchUserPlaylists(token) {
  const playlists = [];
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50';
  while (url) {
    const data = await apiFetch(token, url);
    playlists.push(...(data.items || []).filter(Boolean));
    url = data.next;
    await sleep(150);
  }
  return playlists;
}

export async function fetchPlaylistTracks(token, playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
  while (url) {
    const data = await apiFetch(token, url);
    tracks.push(...(data.items || []).map(i => i.track).filter(t => t?.id));
    url = data.next;
    await sleep(150);
  }
  return tracks;
}

export async function fetchAllTracks(token, onProgress) {
  const seenIds = new Set();
  const allTracks = [];

  // 1. Liked songs
  const liked = await fetchLikedSongs(token, () => {});
  liked.forEach(t => { seenIds.add(t.id); allTracks.push(t); });
  onProgress?.(allTracks.length);

  return allTracks;
}
