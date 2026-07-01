import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useAppStore } from '../../store/context';
import { useSessionStore } from '../../store/sessionContext';
import type { WorldMap, MapMarker, MarkerKind } from '../../types/worldmap';
import { MARKER_LABELS, MARKER_ICONS } from '../../types/worldmap';
import type { PlayerPin } from '../../types/session';
import {
  addMapImageDB, getMapImageUrl, getMapImageDB, deleteMapImageDB,
  readFileAsArrayBuffer, getImageDimensions,
} from '../../utils/mapStorage';
import styles from './WorldMap.module.css';

const MARKER_RADIUS = 14;
const MARKER_COLORS: Record<MarkerKind, string> = {
  city:    '#c9a84c',
  kingdom: '#8b5aaa',
  dungeon: '#8b2a2a',
  poi:     '#2a6b8b',
  danger:  '#c04040',
};

// ── Marker edit modal ──────────────────────────────────────────────────────────
interface MarkerForm {
  label: string;
  description: string;
  kind: MarkerKind;
  color: string;
  linkedEventIds: number[];
}

function MarkerModal({
  marker, onSave, onDelete, onClose,
}: {
  marker: MapMarker | null;
  onSave: (d: MarkerForm) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { state } = useAppStore();
  const [form, setForm] = useState<MarkerForm>({
    label: marker?.label ?? '',
    description: marker?.description ?? '',
    kind: marker?.kind ?? 'poi',
    color: marker?.color ?? MARKER_COLORS['poi'],
    linkedEventIds: marker?.linkedEventIds ?? [],
  });

  function handleKindChange(kind: MarkerKind) {
    setForm(f => ({ ...f, kind, color: MARKER_COLORS[kind] }));
  }

  function toggleEvent(id: number) {
    setForm(f => ({
      ...f,
      linkedEventIds: f.linkedEventIds.includes(id)
        ? f.linkedEventIds.filter(x => x !== id)
        : [...f.linkedEventIds, id],
    }));
  }

  function submit() {
    if (!form.label.trim()) { alert('Nome é obrigatório.'); return; }
    onSave(form);
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>{marker ? 'Editar Marcador' : 'Novo Marcador'}</h3>

        <div className={styles.fieldGroup}>
          <label>Nome</label>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Nome do local..." />
        </div>

        <div className={styles.fieldGroup}>
          <label>Tipo</label>
          <select value={form.kind} onChange={e => handleKindChange(e.target.value as MarkerKind)}>
            {(Object.keys(MARKER_LABELS) as MarkerKind[]).map(k => (
              <option key={k} value={k}>{MARKER_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label>Cor</label>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ height: 36, cursor: 'pointer' }} />
        </div>

        <div className={styles.fieldGroup}>
          <label>Descrição</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descrição do local..." />
        </div>

        {state.events.length > 0 && (
          <div className={styles.fieldGroup}>
            <label>Eventos vinculados</label>
            <div style={{ maxHeight: 140, overflowY: 'auto', background: 'var(--bg)', borderRadius: 4, padding: '0.4rem', border: '1px solid var(--border)' }}>
              {state.events.map(ev => (
                <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '2px 0', fontSize: '0.82rem', color: 'var(--text)' }}>
                  <input type="checkbox" checked={form.linkedEventIds.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
                  [{ev.startYear}] {ev.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.modalActions}>
          {onDelete && <button className="btn btn-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>🗑️ Excluir</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ── Map manager ────────────────────────────────────────────────────────────────
function MapManager({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();
  const [newName, setNewName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingNameRef = useRef('');

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const [buffer, dims] = await Promise.all([
        readFileAsArrayBuffer(file),
        getImageDimensions(file),
      ]);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await addMapImageDB({ id, name: file.name, mime: file.type, ...dims, createdAt: new Date().toISOString() }, buffer);
      const map: WorldMap = { id, name: pendingNameRef.current || file.name, imageRefId: id, ...dims, markers: [] };
      dispatch({ type: 'ADD_WORLD_MAP', payload: map });
    } catch { alert('Erro ao importar imagem.'); }
    finally { setImporting(false); }
  }

  function openPicker() {
    pendingNameRef.current = newName.trim();
    fileRef.current?.click();
    setNewName('');
  }

  async function deleteMap(map: WorldMap) {
    if (!confirm(`Excluir "${map.name}" e todos os marcadores?`)) return;
    if (map.imageRefId) await deleteMapImageDB(map.imageRefId).catch(console.warn);
    dispatch({ type: 'DELETE_WORLD_MAP', payload: map.id });
  }

  return (
    <div className={styles.managerOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.manager}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--gold)' }}>🗺️ Mapas do Mundo</h3>
          <button className="btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do mapa (opcional)..."
            style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.4rem 0.6rem' }}
            onKeyDown={e => { if (e.key === 'Enter') openPicker(); }}
          />
          <button className="btn btn-primary" onClick={openPicker} disabled={importing}>
            {importing ? 'Importando...' : '+ Importar Imagem'}
          </button>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PNG, JPG ou WebP — salvo no browser (IndexedDB)</div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
        />

        <div className={styles.managerList}>
          {(state.worldMaps ?? []).length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
              Nenhum mapa criado ainda.
            </div>
          )}
          {(state.worldMaps ?? []).map(map => (
            <div key={map.id} className={styles.managerItem}>
              <span className={styles.managerItemName}>{map.name}</span>
              <span className={styles.managerItemCount}>{map.markers.length} marcador{map.markers.length !== 1 ? 'es' : ''}</span>
              <button className="btn btn-sm" onClick={() => { dispatch({ type: 'SET_ACTIVE_MAP', payload: map.id }); onClose(); }}>Abrir</button>
              <button className="btn btn-sm btn-danger" onClick={() => void deleteMap(map)}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Marker Konva node ──────────────────────────────────────────────────────────
function MarkerNode({
  marker, stageScale, imgW, imgH,
  onClickMarker, onDragEnd,
}: {
  marker: MapMarker;
  stageScale: number;
  imgW: number;
  imgH: number;
  onClickMarker: (marker: MapMarker, absPos: { x: number; y: number }) => void;
  onDragEnd: (marker: MapMarker, fx: number, fy: number) => void;
}) {
  const px = marker.x * imgW;
  const py = marker.y * imgH;
  const r = MARKER_RADIUS / stageScale;
  const fs = Math.max(8, Math.round(12 / stageScale));

  return (
    <Group
      x={px} y={py}
      draggable
      onDragEnd={e => {
        const node = e.target as Konva.Node;
        onDragEnd(marker, node.x() / imgW, node.y() / imgH);
      }}
      onClick={e => {
        e.cancelBubble = true;
        const abs = e.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
        onClickMarker(marker, abs);
      }}
      onTap={e => {
        e.cancelBubble = true;
        const abs = e.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
        onClickMarker(marker, abs);
      }}
    >
      <Circle radius={r} fill={marker.color} stroke="#ffffff" strokeWidth={1.5 / stageScale} shadowBlur={6 / stageScale} shadowOpacity={0.6} />
      <Text text={MARKER_ICONS[marker.kind]} fontSize={fs} align="center" verticalAlign="middle" offsetX={fs / 2} offsetY={fs / 2} />
    </Group>
  );
}

// ── Popover (DOM overlay) ──────────────────────────────────────────────────────
function MarkerPopover({
  marker, pos, events, onClose, onEdit, onNavigateEvent,
}: {
  marker: MapMarker;
  pos: { x: number; y: number };
  events: { id: number; name: string; startYear: number }[];
  onClose: () => void;
  onEdit: () => void;
  onNavigateEvent: (id: number) => void;
}) {
  const linked = events.filter(e => marker.linkedEventIds.includes(e.id));
  return (
    <div className={styles.popover} style={{ left: pos.x + 16, top: Math.max(0, pos.y - 10) }}>
      <button className={styles.popoverClose} onClick={onClose}>✕</button>
      <div className={styles.popoverTitle}>{MARKER_ICONS[marker.kind]} {marker.label}</div>
      <div className={styles.popoverKind}>{MARKER_LABELS[marker.kind]}</div>
      {marker.description && <div className={styles.popoverDesc}>{marker.description}</div>}
      {linked.length > 0 && (
        <div className={styles.popoverEvents}>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Eventos vinculados:</div>
          {linked.map(ev => (
            <button key={ev.id} className={styles.popoverEventLink} onClick={() => onNavigateEvent(ev.id)}>
              [{ev.startYear}] {ev.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.popoverActions}>
        <button className="btn btn-sm" onClick={onEdit}>✏️ Editar</button>
      </div>
    </div>
  );
}

// ── Player pin node ────────────────────────────────────────────────────────────
function PlayerPinNode({
  pin, stageScale, imgW, imgH, isOwn,
  onDragEnd,
}: {
  pin: PlayerPin;
  stageScale: number;
  imgW: number;
  imgH: number;
  isOwn: boolean;
  onDragEnd?: (fx: number, fy: number) => void;
}) {
  const px = pin.x * imgW;
  const py = pin.y * imgH;
  const r = (isOwn ? 10 : 8) / stageScale;
  const fs = Math.max(7, Math.round(10 / stageScale));
  const initials = pin.playerName.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <Group
      x={px} y={py}
      draggable={isOwn}
      onDragEnd={isOwn && onDragEnd ? e => {
        const node = e.target as Konva.Node;
        onDragEnd(node.x() / imgW, node.y() / imgH);
      } : undefined}
    >
      <Circle radius={r} fill={pin.color} stroke="#fff" strokeWidth={1.5 / stageScale} shadowBlur={4 / stageScale} shadowOpacity={0.5} />
      <Text text={initials} fontSize={fs} fill="#fff" fontStyle="bold" align="center" verticalAlign="middle" offsetX={fs * 0.6} offsetY={fs * 0.6} />
      <Text text={pin.playerName} fontSize={fs * 0.85} fill="#fff" align="center" x={-(r * 3)} y={r + 2 / stageScale} width={r * 6} />
    </Group>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export function WorldMapView() {
  const { state, dispatch } = useAppStore();
  const { session, shareMap, updateMyPin, clearMyPin, mapTransferProgress } = useSessionStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Stage ref + imperative position/scale (avoid controlled props causing snap on re-render)
  const stageRef = useRef<Konva.Stage>(null);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const stageScaleRef = useRef(1);
  // canvasSizeRef so img.onload always sees the current size
  const canvasSizeRef = useRef({ w: 800, h: 600 });

  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  // stageScale state drives marker/pin size calculations (re-renders MarkerNode on zoom)
  const [stageScale, setStageScale] = useState(1);
  const [addMode, setAddMode] = useState(false);
  const [popover, setPopover] = useState<{ marker: MapMarker; pos: { x: number; y: number } } | null>(null);
  const [editingMarker, setEditingMarker] = useState<MapMarker | 'new' | null>(null);
  const [pendingFrac, setPendingFrac] = useState<{ x: number; y: number } | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [sharing, setSharing] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const isHost = session.role === 'host';
  const hasPeers = session.peers.some(p => p.connected);
  const myPeerId = session.myPeerId ?? 'host';
  const playerPins = session.playerPins;
  const myPin = playerPins[myPeerId] ?? null;

  const activeMap = (state.worldMaps ?? []).find(m => m.id === state.activeMapId) ?? null;

  // Keep canvasSizeRef in sync
  canvasSizeRef.current = canvasSize;

  // Resize observer
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Load image when map changes
  useEffect(() => {
    setImageEl(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (!activeMap?.imageRefId) return;
    let cancelled = false;
    getMapImageUrl(activeMap.imageRefId).then(url => {
      if (cancelled || !url) return;
      blobUrlRef.current = url;
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        const cs = canvasSizeRef.current;
        const s = Math.min(cs.w / img.naturalWidth, cs.h / img.naturalHeight, 1);
        const pos = { x: (cs.w - img.naturalWidth * s) / 2, y: (cs.h - img.naturalHeight * s) / 2 };
        stagePosRef.current = pos;
        stageScaleRef.current = s;
        setStageScale(s);
        setImageEl(img);
      };
      img.src = url;
    }).catch(console.warn);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.id, activeMap?.imageRefId]);

  // Apply imperative position/scale after Stage mounts (when imageEl goes null → loaded)
  useEffect(() => {
    if (!stageRef.current || !imageEl) return;
    stageRef.current.scale({ x: stageScaleRef.current, y: stageScaleRef.current });
    stageRef.current.position(stagePosRef.current);
    stageRef.current.batchDraw();
  }, [imageEl]);

  async function handleShareMap() {
    if (!activeMap?.imageRefId || !isHost) return;
    setSharing(true);
    try {
      const result = await getMapImageDB(activeMap.imageRefId);
      if (!result) { alert('Imagem do mapa não encontrada no banco local.'); return; }
      const sharedMap = {
        mapId: activeMap.id,
        imageRefId: activeMap.imageRefId,
        width: activeMap.width,
        height: activeMap.height,
        markers: activeMap.markers.filter(m => m.visibility === 'revealed'),
      };
      await shareMap(sharedMap, result.buffer, result.meta.mime);
    } catch (err) {
      console.error(err);
      alert('Erro ao compartilhar o mapa.');
    } finally {
      setSharing(false);
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!stageRef.current) return;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const curScale = stageScaleRef.current;
    const newScale = Math.min(Math.max(curScale * factor, 0.05), 12);
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const curPos = stagePosRef.current;
    const newPos = {
      x: mx - (mx - curPos.x) * (newScale / curScale),
      y: my - (my - curPos.y) * (newScale / curScale),
    };
    stagePosRef.current = newPos;
    stageScaleRef.current = newScale;
    stageRef.current.scale({ x: newScale, y: newScale });
    stageRef.current.position(newPos);
    stageRef.current.batchDraw();
    setStageScale(newScale);
  }

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!addMode || !activeMap) return;
    // Only react if user clicked the background (stage or image), not a marker
    const targetName = (e.target as Konva.Node).getClassName();
    if (targetName === 'Group' || targetName === 'Circle' || targetName === 'Text') return;
    const stage = e.target.getStage();
    const relPos = stage?.getRelativePointerPosition();
    if (!relPos) return;
    setPendingFrac({ x: relPos.x / activeMap.width, y: relPos.y / activeMap.height });
    setEditingMarker('new');
    setAddMode(false);
  }, [addMode, activeMap]);

  function onMarkerClick(marker: MapMarker, absPos: { x: number; y: number }) {
    setPopover({ marker, pos: absPos });
  }

  function onMarkerDragEnd(marker: MapMarker, fx: number, fy: number) {
    if (!activeMap) return;
    dispatch({ type: 'UPDATE_MARKER', payload: { mapId: activeMap.id, marker: { ...marker, x: fx, y: fy } } });
  }

  function saveMarker(form: MarkerForm) {
    if (!activeMap) return;
    if (editingMarker === 'new' && pendingFrac) {
      const m: MapMarker = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        x: pendingFrac.x, y: pendingFrac.y,
        visibility: 'revealed',
        ...form,
      };
      dispatch({ type: 'ADD_MARKER', payload: { mapId: activeMap.id, marker: m } });
    } else if (editingMarker && editingMarker !== 'new') {
      dispatch({ type: 'UPDATE_MARKER', payload: { mapId: activeMap.id, marker: { ...editingMarker, ...form } } });
    }
    setEditingMarker(null);
    setPendingFrac(null);
    setPopover(null);
  }

  function deleteMarker(marker: MapMarker) {
    if (!activeMap || !confirm(`Excluir "${marker.label}"?`)) return;
    dispatch({ type: 'DELETE_MARKER', payload: { mapId: activeMap.id, markerId: marker.id } });
    setEditingMarker(null);
    setPopover(null);
  }

  function navigateToEvent(eventId: number) {
    setPopover(null);
    dispatch({ type: 'UPDATE_FILTERS', payload: { search: '' } });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'timeline' });
    setTimeout(() => dispatch({ type: 'UPDATE_FILTERS', payload: { search: state.events.find(e => e.id === eventId)?.name ?? '' } }), 50);
  }

  function fitToScreen() {
    const s = Math.min(canvasSize.w / imgW, canvasSize.h / imgH, 1);
    const pos = { x: (canvasSize.w - imgW * s) / 2, y: (canvasSize.h - imgH * s) / 2 };
    stagePosRef.current = pos;
    stageScaleRef.current = s;
    if (stageRef.current) {
      stageRef.current.scale({ x: s, y: s });
      stageRef.current.position(pos);
      stageRef.current.batchDraw();
    }
    setStageScale(s);
  }

  const imgW = activeMap?.width ?? 1;
  const imgH = activeMap?.height ?? 1;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {(state.worldMaps ?? []).length > 0 && (
          <select
            className={styles.mapSelect}
            value={state.activeMapId ?? ''}
            onChange={e => dispatch({ type: 'SET_ACTIVE_MAP', payload: e.target.value || null })}
          >
            {(state.worldMaps ?? []).length > 1 && <option value="">— Mapa —</option>}
            {(state.worldMaps ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <div className={styles.toolbarSpacer} />
        {activeMap && (
          <>
            <button
              className={`btn btn-sm${addMode ? ' btn-primary' : ''}`}
              onClick={() => { setAddMode(v => !v); setPopover(null); }}
              title={addMode ? 'Cancelar' : 'Clique no mapa para adicionar um marcador'}
            >
              {addMode ? '✕ Cancelar' : '📍 Marcador'}
            </button>
            {session.role !== 'offline' && (
              myPin
                ? <button className="btn btn-sm btn-danger" onClick={clearMyPin} title="Remover meu pin">🗑️ Meu Pin</button>
                : <button className="btn btn-sm" onClick={() => updateMyPin(0.5, 0.5)} title="Colocar meu pin no centro do mapa">👤 Meu Pin</button>
            )}
            <button className="btn btn-sm" onClick={fitToScreen} title="Ajustar à tela">
              🔍
            </button>
          </>
        )}
        {activeMap && session.role !== 'offline' && (
          <>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => void handleShareMap()}
              disabled={sharing || !hasPeers}
              title={!hasPeers ? 'Nenhum jogador conectado' : 'Compartilhar este mapa com todos os jogadores'}
            >
              {sharing ? '⏳ Enviando...' : '🌐 Compartilhar'}
            </button>
            {Object.keys(mapTransferProgress).length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--gold-light)' }}>
                {Math.round(Math.min(...Object.values(mapTransferProgress)) * 100)}%
              </span>
            )}
          </>
        )}
        <button className="btn btn-sm" onClick={() => setShowManager(true)}>🗂️ Mapas</button>
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className={`${styles.canvasWrapper}${addMode ? '' : ' ' + styles.panMode}`}
        onWheel={handleWheel}
      >
        {!activeMap ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🗺️</span>
            <span>Nenhum mapa selecionado</span>
            <button className="btn btn-primary" onClick={() => setShowManager(true)}>Importar Mapa</button>
          </div>
        ) : (
          <>
            {imageEl && (
              <Stage
                ref={stageRef}
                width={canvasSize.w}
                height={canvasSize.h}
                draggable={!addMode}
                onDragEnd={e => {
                  const s = e.target as Konva.Stage;
                  stagePosRef.current = { x: s.x(), y: s.y() };
                }}
                onClick={handleStageClick}
                onTap={handleStageClick}
              >
                <Layer>
                  <KonvaImage image={imageEl} width={imgW} height={imgH} />
                  {activeMap.markers.map(mk => (
                    <MarkerNode
                      key={mk.id}
                      marker={mk}
                      stageScale={stageScale}
                      imgW={imgW}
                      imgH={imgH}
                      onClickMarker={onMarkerClick}
                      onDragEnd={onMarkerDragEnd}
                    />
                  ))}
                  {Object.values(playerPins).map(pin => (
                    <PlayerPinNode
                      key={pin.peerId}
                      pin={pin}
                      stageScale={stageScale}
                      imgW={imgW}
                      imgH={imgH}
                      isOwn={pin.peerId === myPeerId}
                      onDragEnd={pin.peerId === myPeerId ? (fx, fy) => updateMyPin(fx, fy) : undefined}
                    />
                  ))}
                </Layer>
              </Stage>
            )}

            {!imageEl && (
              <div className={styles.emptyState}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>⏳ Carregando mapa...</span>
              </div>
            )}

            {addMode && (
              <div className={styles.modeHint}>📍 Clique no mapa para posicionar o marcador</div>
            )}

            {popover && (
              <MarkerPopover
                marker={popover.marker}
                pos={popover.pos}
                events={state.events}
                onClose={() => setPopover(null)}
                onEdit={() => { setEditingMarker(popover.marker); setPopover(null); }}
                onNavigateEvent={navigateToEvent}
              />
            )}
          </>
        )}
      </div>

      {editingMarker !== null && (
        <MarkerModal
          marker={editingMarker === 'new' ? null : editingMarker}
          onSave={saveMarker}
          onDelete={editingMarker !== 'new' ? () => deleteMarker(editingMarker as MapMarker) : undefined}
          onClose={() => { setEditingMarker(null); setPendingFrac(null); }}
        />
      )}

      {showManager && <MapManager onClose={() => setShowManager(false)} />}
    </div>
  );
}

// Re-export type used in EventModal
export type { MarkerForm };
