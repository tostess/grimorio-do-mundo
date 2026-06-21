import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useSessionStore } from '../../store/sessionContext';
import type { PlayerPin } from '../../types/session';
import type { MapMarker } from '../../types/worldmap';
import { MARKER_LABELS, MARKER_ICONS } from '../../types/worldmap';
import { getMapImageUrl } from '../../utils/mapStorage';
import styles from './WorldMap.module.css';

const MARKER_RADIUS = 12;

// ── Marker popover (read-only) ─────────────────────────────────────────────────
function ReadonlyMarkerPopover({
  marker, pos, onClose,
}: {
  marker: MapMarker;
  pos: { x: number; y: number };
  onClose: () => void;
}) {
  return (
    <div className={styles.popover} style={{ left: pos.x + 16, top: Math.max(0, pos.y - 10) }}>
      <button className={styles.popoverClose} onClick={onClose}>✕</button>
      <div className={styles.popoverTitle}>{MARKER_ICONS[marker.kind]} {marker.label}</div>
      <div className={styles.popoverKind}>{MARKER_LABELS[marker.kind]}</div>
      {marker.description && <div className={styles.popoverDesc}>{marker.description}</div>}
    </div>
  );
}

// ── Player pin node ────────────────────────────────────────────────────────────
function PlayerPinNode({
  pin, stageScale, imgW, imgH, isOwn, onDragEnd,
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

// ── Marker node ────────────────────────────────────────────────────────────────
function MarkerNode({
  marker, stageScale, imgW, imgH, onClick,
}: {
  marker: MapMarker;
  stageScale: number;
  imgW: number;
  imgH: number;
  onClick: (marker: MapMarker, absPos: { x: number; y: number }) => void;
}) {
  const px = marker.x * imgW;
  const py = marker.y * imgH;
  const r = MARKER_RADIUS / stageScale;
  const fs = Math.max(8, Math.round(12 / stageScale));

  return (
    <Group
      x={px} y={py}
      onClick={e => {
        e.cancelBubble = true;
        const abs = e.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
        onClick(marker, abs);
      }}
      onTap={e => {
        e.cancelBubble = true;
        const abs = e.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
        onClick(marker, abs);
      }}
    >
      <Circle radius={r} fill={marker.color} stroke="#fff" strokeWidth={1.5 / stageScale} shadowBlur={6 / stageScale} shadowOpacity={0.6} />
      <Text text={MARKER_ICONS[marker.kind]} fontSize={fs} align="center" verticalAlign="middle" offsetX={fs / 2} offsetY={fs / 2} />
    </Group>
  );
}

// ── Main GuestMapView ──────────────────────────────────────────────────────────
export function GuestMapView() {
  const { session, updateMyPin, clearMyPin } = useSessionStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [popover, setPopover] = useState<{ marker: MapMarker; pos: { x: number; y: number } } | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const sharedMap = session.sharedMap;
  const playerPins = session.playerPins;
  const myPeerId = session.myPeerId ?? '';
  const myPin = playerPins[myPeerId] ?? null;

  // Resize observer
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Load image when sharedMap changes or imageVersion bumps (after receiving push)
  useEffect(() => {
    setImageEl(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (!sharedMap?.imageRefId) return;
    let cancelled = false;
    getMapImageUrl(sharedMap.imageRefId).then(url => {
      if (cancelled || !url) return;
      blobUrlRef.current = url;
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        setImageEl(img);
        const s = Math.min(canvasSize.w / img.naturalWidth, canvasSize.h / img.naturalHeight, 1);
        setStageScale(s);
        setStagePos({ x: (canvasSize.w - img.naturalWidth * s) / 2, y: (canvasSize.h - img.naturalHeight * s) / 2 });
      };
      img.src = url;
    }).catch(() => {
      // Imagem ainda não chegou — aguarda re-render quando imageVersion mudar
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMap?.imageRefId, imageVersion]);

  // Re-tenta carregar quando o log menciona recebimento da imagem
  useEffect(() => {
    const last = session.log[0];
    if (last?.text.includes('Imagem do mapa recebida')) {
      setImageVersion(v => v + 1);
    }
  }, [session.log]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!sharedMap) return;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const newScale = Math.min(Math.max(stageScale * factor, 0.05), 12);
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setStageScale(newScale);
    setStagePos({ x: mx - (mx - stagePos.x) * (newScale / stageScale), y: my - (my - stagePos.y) * (newScale / stageScale) });
  }

  if (!sharedMap) {
    return (
      <div className={styles.emptyState} style={{ height: '100%', minHeight: 300 }}>
        <span className={styles.emptyIcon}>🗺️</span>
        <span>O mestre ainda não compartilhou o mapa desta sessão.</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Aguarde o mestre clicar em "🌐 Compartilhar" na aba Mapa.</span>
      </div>
    );
  }

  const imgW = sharedMap.width;
  const imgH = sharedMap.height;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span style={{ fontSize: '0.9rem', color: 'var(--gold)' }}>🗺️ Mapa da Sessão</span>
        <div className={styles.toolbarSpacer} />
        {myPin
          ? <button className="btn btn-sm btn-danger" onClick={clearMyPin}>🗑️ Remover meu pin</button>
          : <button className="btn btn-sm btn-primary" onClick={() => updateMyPin(0.5, 0.5)}>📌 Colocar meu pin</button>
        }
        <button className="btn btn-sm" onClick={() => {
          const s = Math.min(canvasSize.w / imgW, canvasSize.h / imgH, 1);
          setStageScale(s);
          setStagePos({ x: (canvasSize.w - imgW * s) / 2, y: (canvasSize.h - imgH * s) / 2 });
        }} title="Ajustar à tela">🔍</button>
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className={`${styles.canvasWrapper} ${styles.panMode}`}
        style={{ flex: 1 }}
        onWheel={handleWheel}
      >
        {!imageEl ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {sharedMap.imageRefId ? '⏳ Aguardando imagem do mapa...' : 'Mapa sem imagem'}
            </span>
          </div>
        ) : (
          <>
            <Stage
              width={canvasSize.w}
              height={canvasSize.h}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePos.x}
              y={stagePos.y}
              draggable
              onDragEnd={e => { const s = e.target as Konva.Stage; setStagePos({ x: s.x(), y: s.y() }); }}
            >
              <Layer>
                <KonvaImage image={imageEl} width={imgW} height={imgH} />
                {sharedMap.markers.map(mk => (
                  <MarkerNode
                    key={mk.id}
                    marker={mk}
                    stageScale={stageScale}
                    imgW={imgW}
                    imgH={imgH}
                    onClick={(marker, absPos) => setPopover({ marker, pos: absPos })}
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

            {popover && (
              <ReadonlyMarkerPopover
                marker={popover.marker}
                pos={popover.pos}
                onClose={() => setPopover(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
