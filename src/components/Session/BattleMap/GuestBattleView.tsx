import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import { useSessionStore } from '../../../store/sessionContext';
import { getMapImageUrl } from '../../../utils/mapStorage';
import { useBattleStage, GridShape, FogShapes, BattleTokenNode } from './BattleCanvas';
import styles from './BattleMap.module.css';

export function GuestBattleView() {
  const { session, moveBattleToken } = useSessionStore();
  const record = session.battleMaps[0] ?? null;
  const map = record?.map ?? null;
  const myPeerId = session.myPeerId ?? '';

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  // imageVersion dispara retry quando a imagem chega depois do BATTLE_MAP_SHARE
  const [imageVersion, setImageVersion] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  const stage = useBattleStage(map?.width ?? 0, map?.height ?? 0);

  useEffect(() => {
    setImageEl(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (!map?.imageRefId) return;
    let cancelled = false;
    getMapImageUrl(map.imageRefId).then(url => {
      if (cancelled || !url) return;
      blobUrlRef.current = url;
      const img = new window.Image();
      img.onload = () => { if (!cancelled) setImageEl(img); };
      img.src = url;
    }).catch(() => {
      // Imagem ainda não chegou via P2P — retry via imageVersion quando o log registrar a chegada
    });
    return () => { cancelled = true; };
  }, [map?.imageRefId, imageVersion]);

  // Mesma estratégia do GuestMapView: reage ao log de MAP_IMAGE_END, sem polling
  useEffect(() => {
    if (imageEl || !map?.imageRefId) return;
    const last = session.log[0];
    if (last?.text.includes('Imagem do mapa recebida')) {
      setImageVersion(v => v + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.log]);

  if (!record || !map) {
    return (
      <div className={styles.emptyState} style={{ height: '100%', minHeight: 300 }}>
        <span className={styles.emptyIcon}>⚔️</span>
        <span>O mestre ainda não ativou um grid de batalha.</span>
      </div>
    );
  }

  const revealedSet = new Set(record.revealed.map(c => `${c.x},${c.y}`));
  // Com névoa ativa, tokens alheios só aparecem em células reveladas;
  // os próprios tokens vão numa layer acima da névoa (sempre visíveis)
  const otherTokens = record.tokens.filter(t =>
    t.peerId !== myPeerId && (!map.fogEnabled || revealedSet.has(`${t.x},${t.y}`)),
  );
  const myTokens = record.tokens.filter(t => t.peerId === myPeerId);
  const activeEntry = session.combat.active
    ? session.combat.entries[session.combat.currentTurnIndex]
    : undefined;

  const isTokenActive = (token: typeof record.tokens[number]) => Boolean(activeEntry && (
    (token.characterId && activeEntry.characterId === token.characterId) ||
    token.name === activeEntry.name
  ));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.title}>⚔️ {map.name}</span>
        <div className={styles.spacer} />
        {map.imageRefId && !imageEl && <span className={styles.transferHint}>⏳ Recebendo imagem...</span>}
        <button className="btn btn-sm" onClick={stage.fitToScreen} title="Ajustar à tela">🔍</button>
      </div>

      <div ref={stage.wrapperRef} className={styles.canvasWrapper} onWheel={stage.handleWheel}>
        <Stage
          ref={stage.stageRef}
          width={stage.canvasSize.w}
          height={stage.canvasSize.h}
          draggable
          onDragEnd={stage.handleStageDragEnd}
          onTouchMove={stage.handleTouchMove}
          onTouchEnd={stage.handleTouchEnd}
        >
          <Layer>
            {imageEl
              ? <KonvaImage image={imageEl} width={map.width} height={map.height} />
              : <Rect x={0} y={0} width={map.width} height={map.height} fill="#141420" />}
            <GridShape map={map} />
          </Layer>

          <Layer>
            {otherTokens.map(token => (
              <BattleTokenNode
                key={token.id}
                token={token}
                map={map}
                stageScale={stage.stageScale}
                draggable={false}
                isActiveTurn={isTokenActive(token)}
              />
            ))}
          </Layer>

          {map.fogEnabled && (
            <Layer listening={false}>
              <FogShapes map={map} revealed={record.revealed} opacity={0.96} />
            </Layer>
          )}

          <Layer>
            {myTokens.map(token => (
              <BattleTokenNode
                key={token.id}
                token={token}
                map={map}
                stageScale={stage.stageScale}
                draggable
                isActiveTurn={isTokenActive(token)}
                onMoved={(col, row) => moveBattleToken(token.id, col, row)}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
