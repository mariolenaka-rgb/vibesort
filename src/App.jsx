import { useState, useEffect } from 'react';
import * as Spotify from './spotify';
import { classifyLibrary, CATEGORIES } from './classifier';

// ─── PALETA ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  card: '#111118',
  border: '#222',
  green: '#1ED760',
  text: '#fff',
  sub: '#aaa',
  dim: '#666',
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState('init'); // init | idle | loading | results | exporting | done | error
  const [progress, setProgress] = useState({ msg: '', loaded: 0, total: 0 });
  const [user, setUser] = useState(null);
  const [classified, setClassified] = useState({});
  const [selectedCat, setSelectedCat] = useState(null);
  const [exportStatus, setExportStatus] = useState({});
  const [errorMsg, setErrorMsg] = useState('');

  // ── Al cargar: detectar callback OAuth o token guardado ───────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setErrorMsg('Acceso denegado en Spotify. Vuelve a intentarlo.');
      setPhase('error');
      return;
    }

    if (code) {
      // Limpiar URL
      window.history.replaceState({}, '', window.location.pathname);
      handleCallback(code);
      return;
    }

    const token = Spotify.getStoredToken();
    if (token) {
      setPhase('ready'); // Ya conectado, puede importar
    } else {
      setPhase('idle');
    }
  }, []);

  // ── OAuth callback ────────────────────────────────────────────────────────
  async function handleCallback(code) {
    setPhase('loading');
    setProgress({ msg: 'Conectando con Spotify...', loaded: 0, total: 0 });
    try {
      const token = await Spotify.exchangeCode(code);
      const u = await Spotify.getCurrentUser(token);
      setUser(u);
      await runImport(token);
    } catch (e) {
      setErrorMsg(e.message || 'Error conectando con Spotify.');
      setPhase('error');
    }
  }

  // ── Importar y clasificar ─────────────────────────────────────────────────
  async function runImport(token) {
    setPhase('loading');

    try {
      // 1. Liked Songs
      setProgress({ msg: 'Importando canciones que te gustan...', loaded: 0, total: 0 });
      const tracks = await Spotify.fetchLikedSongs(token, (loaded, total) => {
        setProgress({ msg: `Importando canciones... ${loaded} / ${total}`, loaded, total });
      });

      // 2. Clasificar con Claude (por nombre + artista, lotes de 30)
      setProgress({ msg: 'Clasificando con IA... 0 / ' + tracks.length, loaded: 0, total: tracks.length });
      const result = await classifyLibrary(tracks, (loaded, total) => {
        setProgress({ msg: `Clasificando con IA... ${loaded} / ${total}`, loaded, total });
      });

      setClassified(result);
      setPhase('results');

    } catch (e) {
      setErrorMsg(e.message || 'Error importando datos de Spotify.');
      setPhase('error');
    }
  }

  // ── Exportar categoría como playlist ─────────────────────────────────────
  async function exportCategory(cat) {
    const token = Spotify.getStoredToken();
    const u = user || await Spotify.getCurrentUser(token);
    const songs = classified[cat.id] || [];
    if (songs.length === 0) return;

    setExportStatus(prev => ({ ...prev, [cat.id]: 'creating' }));
    try {
      const trackUris = songs.map(t => t.uri).filter(Boolean);
      await Spotify.createPlaylist(
        token, u.id,
        `VibeSort — ${cat.emoji} ${cat.name}`,
        cat.description,
        trackUris
      );
      setExportStatus(prev => ({ ...prev, [cat.id]: 'done' }));
    } catch (e) {
      setExportStatus(prev => ({ ...prev, [cat.id]: 'error' }));
    }
  }

  async function exportAll() {
    setPhase('exporting');
    for (const cat of CATEGORIES) {
      if ((classified[cat.id] || []).length > 0) {
        await exportCategory(cat);
      }
    }
    setPhase('done');
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (phase === 'init') return <ScreenBlank />;

  if (phase === 'idle' || phase === 'ready') {
    return (
      <ScreenLogin
        connected={phase === 'ready'}
        onLogin={() => Spotify.startAuth()}
        onImport={() => {
          const t = Spotify.getStoredToken();
          runImport(t);
        }}
        onLogout={() => {
          Spotify.logout();
          setPhase('idle');
        }}
      />
    );
  }

  if (phase === 'loading') return <ScreenLoading progress={progress} />;

  if (phase === 'results' || phase === 'exporting') {
    return (
      <ScreenResults
        user={user}
        classified={classified}
        selectedCat={selectedCat}
        onSelectCat={setSelectedCat}
        exportStatus={exportStatus}
        onExportOne={exportCategory}
        onExportAll={exportAll}
        exporting={phase === 'exporting'}
      />
    );
  }

  if (phase === 'done') return <ScreenDone classified={classified} />;
  if (phase === 'error') return <ScreenError msg={errorMsg} onRetry={() => { Spotify.logout(); setPhase('idle'); }} />;

  return null;
}

// ─── PANTALLAS ────────────────────────────────────────────────────────────────

function ScreenBlank() {
  return <div style={{ background: C.bg, minHeight: '100vh' }} />;
}

function ScreenLogin({ connected, onLogin, onImport, onLogout }) {
  return (
    <div style={sCenter}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎵</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: C.green, marginBottom: 6 }}>VibeSort</h1>
        <p style={{ color: C.sub, fontSize: 15, marginBottom: 40, lineHeight: 1.6 }}>
          Conecta tu Spotify y clasifica tu biblioteca por momentos reales:<br />
          sobremesa, previa, pista salvaje, relax...
        </p>

        {!connected ? (
          <button style={sBtnGreen} onClick={onLogin}>
            Conectar con Spotify
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: C.green, fontSize: 14, marginBottom: 8 }}>✓ Spotify conectado</p>
            <button style={sBtnGreen} onClick={onImport}>
              Analizar mi biblioteca
            </button>
            <button style={sBtnGhost} onClick={onLogout}>
              Desconectar cuenta
            </button>
          </div>
        )}

        <p style={{ color: C.dim, fontSize: 12, marginTop: 32 }}>
          Solo lectura de tus playlists. Crea playlists nuevas bajo tu autorización.
        </p>
      </div>
    </div>
  );
}

function ScreenLoading({ progress }) {
  const pct = progress.total > 0
    ? Math.round((progress.loaded / progress.total) * 100)
    : null;

  return (
    <div style={sCenter}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <Spinner />
        <p style={{ color: C.text, fontSize: 16, marginBottom: 8, marginTop: 24 }}>
          {progress.msg || 'Cargando...'}
        </p>
        {pct !== null && (
          <>
            <div style={{ background: '#222', borderRadius: 8, height: 6, margin: '16px 0' }}>
              <div style={{ background: C.green, borderRadius: 8, height: 6, width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <p style={{ color: C.dim, fontSize: 13 }}>{pct}%</p>
          </>
        )}
        <p style={{ color: C.dim, fontSize: 12, marginTop: 24 }}>
          Esto puede tardar 1-2 minutos según el tamaño de tu biblioteca.
        </p>
      </div>
    </div>
  );
}

function ScreenResults({ user, classified, selectedCat, onSelectCat, exportStatus, onExportOne, onExportAll, exporting }) {
  const totalSongs = Object.values(classified).reduce((s, arr) => s + arr.length, 0);

  // Vista detalle de una categoría
  if (selectedCat) {
    const songs = classified[selectedCat.id] || [];
    const status = exportStatus[selectedCat.id];
    return (
      <div style={{ ...sPage, paddingBottom: 40 }}>
        <div style={sHeader}>
          <button style={sBtnBack} onClick={() => onSelectCat(null)}>← Volver</button>
          <span style={{ color: C.sub, fontSize: 14 }}>{songs.length} canciones</span>
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 36 }}>{selectedCat.emoji}</span>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>{selectedCat.name}</h2>
              <p style={{ color: C.sub, fontSize: 13 }}>{selectedCat.description}</p>
            </div>
          </div>

          {status !== 'done' && (
            <button
              style={{ ...sBtnGreen, marginBottom: 20, opacity: status === 'creating' ? 0.6 : 1 }}
              onClick={() => onExportOne(selectedCat)}
              disabled={status === 'creating'}
            >
              {status === 'creating' ? 'Creando playlist...' : status === 'done' ? '✓ Creada' : `Crear en Spotify (${songs.length} canciones)`}
            </button>
          )}
          {status === 'done' && (
            <p style={{ color: C.green, marginBottom: 20 }}>✓ Playlist creada en tu Spotify</p>
          )}
          {status === 'error' && (
            <p style={{ color: '#FF3B30', marginBottom: 20 }}>Error al crear. Inténtalo de nuevo.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {songs.map((track, i) => (
              <TrackRow key={track.id || i} track={track} index={i + 1} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista resumen de categorías
  return (
    <div style={{ ...sPage, paddingBottom: 60 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.green }}>Tu biblioteca clasificada</h1>
        {user && <p style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>@{user.display_name} · {totalSongs} canciones</p>}
      </div>

      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <button
          style={{ ...sBtnGreen, opacity: exporting ? 0.6 : 1 }}
          onClick={onExportAll}
          disabled={exporting}
        >
          {exporting ? 'Creando playlists...' : 'Crear todas las playlists en Spotify'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
        {CATEGORIES.map(cat => {
          const songs = classified[cat.id] || [];
          const status = exportStatus[cat.id];
          if (songs.length === 0) return null;
          return (
            <CategoryCard
              key={cat.id}
              cat={cat}
              count={songs.length}
              status={status}
              onClick={() => onSelectCat(cat)}
            />
          );
        })}
      </div>

      {/* Categorías vacías al final */}
      <div style={{ padding: '16px 20px' }}>
        <p style={{ color: C.dim, fontSize: 12 }}>
          Categorías sin canciones no se muestran.
        </p>
      </div>
    </div>
  );
}

function CategoryCard({ cat, count, status, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${cat.color}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 28, flexShrink: 0 }}>{cat.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{cat.description}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: cat.color }}>{count}</div>
        <div style={{ fontSize: 11, color: C.dim }}>canciones</div>
      </div>
      {status === 'done' && <span style={{ color: C.green, fontSize: 18 }}>✓</span>}
      {status === 'error' && <span style={{ color: '#FF3B30', fontSize: 18 }}>✗</span>}
      {!status && <span style={{ color: C.dim, fontSize: 18 }}>›</span>}
    </div>
  );
}

function TrackRow({ track, index }) {
  const artist = track.artists?.map(a => a.name).join(', ') || '';
  const album = track.album?.name || '';
  const img = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ color: C.dim, fontSize: 12, width: 24, textAlign: 'right', flexShrink: 0 }}>{index}</span>
      {img && <img src={img} alt="" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.name}
        </div>
        <div style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artist}
        </div>
      </div>
    </div>
  );
}

function ScreenDone({ classified }) {
  const total = Object.values(classified).reduce((s, a) => s + a.length, 0);
  const cats = CATEGORIES.filter(c => (classified[c.id] || []).length > 0);
  return (
    <div style={sCenter}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>¡Listo!</h2>
        <p style={{ color: C.sub, marginBottom: 24 }}>
          {cats.length} playlists creadas en tu Spotify con {total} canciones clasificadas.
        </p>
        <button style={sBtnGreen} onClick={() => window.location.reload()}>
          Volver a clasificar
        </button>
      </div>
    </div>
  );
}

function ScreenError({ msg, onRetry }) {
  return (
    <div style={sCenter}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Algo salió mal</h2>
        <p style={{ color: C.sub, marginBottom: 24 }}>{msg}</p>
        <button style={sBtnGreen} onClick={onRetry}>Reintentar</button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      border: `4px solid #222`,
      borderTop: `4px solid ${C.green}`,
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto',
    }} />
  );
}

// ─── ESTILOS COMPARTIDOS ──────────────────────────────────────────────────────

const sCenter = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', background: C.bg, padding: 24,
};

const sPage = {
  background: C.bg, minHeight: '100vh', maxWidth: 640, margin: '0 auto',
};

const sHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
};

const sBtnGreen = {
  background: C.green, color: '#000', border: 'none', borderRadius: 50,
  padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  width: '100%',
};

const sBtnGhost = {
  background: 'transparent', color: C.sub, border: `1px solid ${C.border}`,
  borderRadius: 50, padding: '12px 28px', fontSize: 14, cursor: 'pointer',
  width: '100%',
};

const sBtnBack = {
  background: 'transparent', color: C.text, border: 'none',
  fontSize: 14, cursor: 'pointer', padding: '4px 0',
};

// CSS para la animación del spinner
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);
