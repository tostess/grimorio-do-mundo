import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '../../../store/sessionContext';
import { listAudioDB, addAudioDB, deleteAudioDB, getAudioBufferDB, type AudioMeta } from '../../../utils/audioStorage';
import { AUDIO_MANIFEST } from '../../../data/audioManifest';
import styles from './AudioMixer.module.css';

interface TrackUI {
  id: string;
  label: string;
  kind: 'ambient' | 'sfx';
  bundled: boolean;
  sources?: string[];
  mime?: string;
}

export function AudioMixer() {
  const {
    session,
    audioAssetsVersion,
    audioTransferProgress,
    playAudioTrack,
    stopAudioTrack,
    setAudioVolume,
    crossfadeAudio,
    pushAudioAsset,
  } = useSessionStore();

  const [idbTracks, setIdbTracks] = useState<AudioMeta[]>([]);
  const [importing, setImporting] = useState(false);
  const ambientFileRef = useRef<HTMLInputElement>(null);
  const sfxFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAudioDB().then(setIdbTracks).catch(console.warn);
  }, [audioAssetsVersion]);

  // Faixas combinadas: bundled + IDB
  const ambientBundled: TrackUI[] = AUDIO_MANIFEST
    .filter(t => t.kind === 'ambient')
    .map(t => ({ id: t.id, label: t.label, kind: 'ambient' as const, bundled: true, sources: t.sources }));

  const sfxBundled: TrackUI[] = AUDIO_MANIFEST
    .filter(t => t.kind === 'sfx')
    .map(t => ({ id: t.id, label: t.label, kind: 'sfx' as const, bundled: true, sources: t.sources }));

  const ambientIdb: TrackUI[] = idbTracks
    .filter(t => t.kind === 'ambient')
    .map(t => ({ id: t.id, label: t.label, kind: 'ambient' as const, bundled: false, mime: t.mime }));

  const sfxIdb: TrackUI[] = idbTracks
    .filter(t => t.kind === 'sfx')
    .map(t => ({ id: t.id, label: t.label, kind: 'sfx' as const, bundled: false, mime: t.mime }));

  const allAmbient = [...ambientBundled, ...ambientIdb];
  const allSfx = [...sfxBundled, ...sfxIdb];
  const activeAudio = session.audioState.active;
  const currentAmbient = allAmbient.find(t => activeAudio[t.id]?.playing);

  const hasSession = session.role === 'host' && session.peers.length > 0;

  async function handleImport(file: File, kind: 'ambient' | 'sfx') {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const id = `imported_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const meta: AudioMeta = {
        id,
        label: file.name.replace(/\.[^.]+$/, ''),
        kind,
        mime: file.type || 'audio/ogg',
        origin: 'imported',
        createdAt: new Date().toISOString(),
      };
      await addAudioDB(meta, buffer);
      setIdbTracks(prev => [...prev, meta]);
    } catch (err) {
      console.warn('[AudioMixer] import failed:', err);
    } finally {
      setImporting(false);
    }
  }

  function handlePlay(track: TrackUI) {
    const isPlaying = activeAudio[track.id]?.playing ?? false;
    if (isPlaying) {
      stopAudioTrack(track.id);
      return;
    }
    const opts = { sources: track.sources, mime: track.mime, loop: track.kind === 'ambient', volume: 0.8 };
    if (track.kind === 'ambient' && currentAmbient && currentAmbient.id !== track.id) {
      crossfadeAudio(currentAmbient.id, track.id, 2000, opts);
    } else {
      playAudioTrack(track.id, opts);
    }
  }

  async function handleSend(track: TrackUI) {
    if (track.bundled || !track.mime) return;
    const buffer = await getAudioBufferDB(track.id);
    if (!buffer) return;
    const peers = session.peers.filter(p => p.connected).map(p => p.peerId);
    await pushAudioAsset(track.id, { label: track.label, kind: track.kind, mime: track.mime }, buffer, peers);
  }

  async function handleDelete(track: TrackUI) {
    await deleteAudioDB(track.id);
    stopAudioTrack(track.id);
    setIdbTracks(prev => prev.filter(t => t.id !== track.id));
  }

  function renderTrack(track: TrackUI) {
    const active = activeAudio[track.id];
    const isPlaying = active?.playing ?? false;
    const volume = active?.volume ?? 0.8;
    const progress = audioTransferProgress[track.id] ?? {};
    const isSending = Object.keys(progress).length > 0;
    const allDone = isSending && Object.values(progress).every(v => v >= 1);

    return (
      <div key={track.id} className={`${styles.trackRow} ${isPlaying ? styles.trackActive : ''}`}>
        <button
          className={`btn btn-sm ${isPlaying ? styles.btnStop : styles.btnPlay}`}
          onClick={() => handlePlay(track)}
          title={isPlaying ? 'Parar' : track.kind === 'ambient' ? 'Tocar / Crossfade' : 'Tocar'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        <span className={styles.trackLabel} title={track.label}>{track.label}</span>

        {isPlaying && (
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={volume}
            className={styles.volSlider}
            title={`Volume: ${Math.round(volume * 100)}%`}
            onChange={e => setAudioVolume(track.id, parseFloat(e.target.value))}
          />
        )}

        {!track.bundled && hasSession && !isSending && (
          <button
            className={`btn btn-sm ${styles.btnSend}`}
            onClick={() => handleSend(track)}
            title="Enviar faixa para os jogadores da sessão"
          >
            📤
          </button>
        )}

        {isSending && (
          <div className={styles.sendProgress}>
            {Object.entries(progress).map(([pid, pct]) => {
              const peer = session.peers.find(p => p.peerId === pid);
              return (
                <div key={pid} className={styles.peerRow}>
                  <span className={styles.peerName}>{peer?.playerName ?? pid.slice(0, 6)}</span>
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progressFill} ${pct >= 1 ? styles.progressDone : ''}`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <span className={styles.peerPct}>{allDone ? '✓' : `${Math.round(pct * 100)}%`}</span>
                </div>
              );
            })}
          </div>
        )}

        {!track.bundled && (
          <button
            className={`btn btn-sm ${styles.btnDel}`}
            onClick={() => handleDelete(track)}
            title="Remover faixa"
          >
            🗑
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.mixer}>
      {/* Ambiência */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>🎵 Ambiência</span>
          <label className={`btn btn-sm ${styles.importBtn} ${importing ? styles.importing : ''}`}>
            {importing ? '...' : '+ Import'}
            <input
              ref={ambientFileRef}
              type="file"
              accept=".ogg,.mp3,.wav,.webm,audio/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImport(f, 'ambient');
                if (ambientFileRef.current) ambientFileRef.current.value = '';
              }}
            />
          </label>
        </div>
        <div className={styles.trackList}>
          {allAmbient.length === 0
            ? <p className={styles.empty}>Nenhuma faixa. Importe um arquivo de áudio (.ogg, .mp3, .wav).</p>
            : allAmbient.map(renderTrack)
          }
        </div>
      </div>

      {/* SFX */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>💥 SFX</span>
          <label className={`btn btn-sm ${styles.importBtn} ${importing ? styles.importing : ''}`}>
            {importing ? '...' : '+ Import'}
            <input
              ref={sfxFileRef}
              type="file"
              accept=".ogg,.mp3,.wav,.webm,audio/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImport(f, 'sfx');
                if (sfxFileRef.current) sfxFileRef.current.value = '';
              }}
            />
          </label>
        </div>
        <div className={styles.trackList}>
          {allSfx.length === 0
            ? <p className={styles.empty}>Nenhum SFX. Importe um arquivo de áudio.</p>
            : allSfx.map(renderTrack)
          }
        </div>
      </div>
    </div>
  );
}
