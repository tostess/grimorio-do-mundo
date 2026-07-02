import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Group, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useSessionStore } from '../../../store/sessionContext';
import type { BattleMap, MapToken, FogCell, GridType, Measurement } from '../../../types/map';
import { TOKEN_COLORS, tokenInitials } from '../../../types/map';
import { cellCenter, pointToCell, cellDistance, gridDims } from '../../../utils/gridMath';
import { addMapImageDB, getMapImageDB, getMapImageUrl, readFileAsArrayBuffer, getImageDimensions } from '../../../utils/mapStorage';
import { useBattleStage, GridShape, FogShapes, BattleTokenNode, clampCell } from './BattleCanvas';
import styles from './BattleMap.module.css';

type BattleTool = 'pan' | 'measure' | 'reveal' | 'hide';

function cellKey(c: FogCell): string {
  return `${c.x},${c.y}`;
}

// ── Formulário de novo mapa ────────────────────────────────────────────────────

function NewMapForm({ onCancel }: { onCancel: () => void }) {
  const { createBattleMap, pushBattleMapImage } = useSessionStore();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [gridType, setGridType] = useState<GridType>('square');
  const [cellSize, setCellSize] = useState('70');
  const [feetPerCell, setFeetPerCell] = useState('5');
  const [cols, setCols] = useState('30');
  const [rows, setRows] = useState('20');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (busy) return;
    const label = name.trim() || 'Mapa de batalha';
    const cs = Math.max(20, parseInt(cellSize, 10) || 70);
    const fpc = Math.max(1, parseInt(feetPerCell, 10) || 5);
    setBusy(true);
    try {
      let imageRefId: string | null = null;
      let imageMime = '';
      let width: number;
      let height: number;
      let buffer: ArrayBuffer | null = null;

      if (file) {
        buffer = await readFileAsArrayBuffer(file);
        const dims = await getImageDimensions(file);
        imageRefId = 'bimg_' + Date.now().toString(36);
        imageMime = file.type;
        width = dims.width;
        height = dims.height;
        await addMapImageDB(
          { id: imageRefId, name: label, mime: imageMime, width, height, createdAt: new Date().toISOString() },
          buffer,
        );
      } else {
        width = Math.max(5, parseInt(cols, 10) || 30) * cs;
        height = Math.max(5, parseInt(rows, 10) || 20) * cs;
      }

      const map: BattleMap = {
        id: 'bmap_' + Date.now().toString(36),
        name: label,
        imageRefId,
        imageMime,
        width,
        height,
        gridType,
        cellSize: cs,
        feetPerCell: fpc,
        fogEnabled: false,
      };
      createBattleMap(map);
      if (imageRefId && buffer) void pushBattleMapImage(imageRefId, imageMime, buffer);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <h4 className={styles.panelTitle}>➕ Novo Mapa de Batalha</h4>
      <div className={styles.formGrid}>
        <label>
          Nome
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cripta do Lich" />
        </label>
        <label>
          Imagem (opcional)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Grade
          <select value={gridType} onChange={e => setGridType(e.target.value as GridType)}>
            <option value="square">Quadrada</option>
            <option value="hex">Hexagonal</option>
          </select>
        </label>
        <label>
          Célula (px)
          <input type="number" min="20" max="300" value={cellSize} onChange={e => setCellSize(e.target.value)} />
        </label>
        <label>
          Pés por célula
          <input type="number" min="1" value={feetPerCell} onChange={e => setFeetPerCell(e.target.value)} />
        </label>
        {!file && (
          <>
            <label>
              Colunas
              <input type="number" min="5" max="100" value={cols} onChange={e => setCols(e.target.value)} />
            </label>
            <label>
              Linhas
              <input type="number" min="5" max="100" value={rows} onChange={e => setRows(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <div className={styles.panelFooter}>
        <button className="btn btn-sm" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-sm btn-primary" onClick={() => { void handleCreate(); }} disabled={busy}>
          {busy ? 'Criando...' : 'Criar Mapa'}
        </button>
      </div>
    </div>
  );
}

// ── Painel de tokens ───────────────────────────────────────────────────────────

function TokenPanel({
  map, tokens, centerCell, onClose,
}: {
  map: BattleMap;
  tokens: MapToken[];
  centerCell: () => { col: number; row: number };
  onClose: () => void;
}) {
  const { session, setBattleTokens } = useSessionStore();
  const [npcName, setNpcName] = useState('');
  const [npcColor, setNpcColor] = useState<string>(TOKEN_COLORS[0]);
  const [npcSize, setNpcSize] = useState('1');

  function freeCellNear(start: { col: number; row: number }): { col: number; row: number } {
    const occupied = new Set(tokens.map(t => `${t.x},${t.y}`));
    for (let radius = 0; radius < 10; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cell = clampCell(map, { col: start.col + dx, row: start.row + dy });
          if (!occupied.has(`${cell.col},${cell.row}`)) return cell;
        }
      }
    }
    return start;
  }

  function addPlayerToken(peerId: string) {
    const peer = session.peers.find(p => p.peerId === peerId);
    if (!peer) return;
    const assigned = session.assignedCharacters[peerId];
    const label = assigned?.name ?? peer.playerName;
    const idx = session.peers.findIndex(p => p.peerId === peerId);
    const cell = freeCellNear(centerCell());
    const token: MapToken = {
      id: 'tok_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: label,
      initials: tokenInitials(label),
      color: TOKEN_COLORS[idx >= 0 ? idx % TOKEN_COLORS.length : 0],
      characterId: assigned?.id ?? null,
      peerId,
      x: cell.col,
      y: cell.row,
      size: 1,
      isNPC: false,
    };
    setBattleTokens(map.id, [...tokens, token]);
  }

  function addNpcToken() {
    if (!npcName.trim()) return;
    const cell = freeCellNear(centerCell());
    const token: MapToken = {
      id: 'tok_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: npcName.trim(),
      initials: tokenInitials(npcName.trim()),
      color: npcColor,
      characterId: null,
      peerId: null,
      x: cell.col,
      y: cell.row,
      size: Math.max(1, parseInt(npcSize, 10) || 1),
      isNPC: true,
    };
    setBattleTokens(map.id, [...tokens, token]);
    setNpcName('');
  }

  const peersWithoutToken = session.peers.filter(p => !tokens.some(t => t.peerId === p.peerId));

  return (
    <div className={styles.panel}>
      <h4 className={styles.panelTitle}>＋ Tokens</h4>

      {peersWithoutToken.length > 0 && (
        <div className={styles.tokenSection}>
          <span className={styles.sectionLabel}>Jogadores conectados</span>
          <div className={styles.tokenBtnRow}>
            {peersWithoutToken.map(p => (
              <button key={p.peerId} className="btn btn-sm" onClick={() => addPlayerToken(p.peerId)}>
                👤 {session.assignedCharacters[p.peerId]?.name ?? p.playerName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tokenSection}>
        <span className={styles.sectionLabel}>NPC / monstro</span>
        <div className={styles.npcForm}>
          <input value={npcName} onChange={e => setNpcName(e.target.value)} placeholder="Nome do NPC"
            onKeyDown={e => { if (e.key === 'Enter') addNpcToken(); }} />
          <select value={npcColor} onChange={e => setNpcColor(e.target.value)} title="Cor do token">
            {TOKEN_COLORS.map(c => <option key={c} value={c} style={{ background: c }}>{c}</option>)}
          </select>
          <select value={npcSize} onChange={e => setNpcSize(e.target.value)} title="Tamanho (células)">
            <option value="1">Médio (1)</option>
            <option value="2">Grande (2)</option>
            <option value="3">Enorme (3)</option>
          </select>
          <button className="btn btn-sm btn-primary" onClick={addNpcToken}>Add</button>
        </div>
      </div>

      {tokens.length > 0 && (
        <div className={styles.tokenSection}>
          <span className={styles.sectionLabel}>No mapa ({tokens.length})</span>
          <div className={styles.tokenList}>
            {tokens.map(t => (
              <div key={t.id} className={styles.tokenRow}>
                <span className={styles.tokenDot} style={{ background: t.color }} />
                <span className={styles.tokenName}>{t.name}</span>
                {t.isNPC && <span className={styles.npcBadge}>NPC</span>}
                <button className={`btn btn-sm ${styles.removeBtn}`}
                  onClick={() => setBattleTokens(map.id, tokens.filter(x => x.id !== t.id))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.panelFooter}>
        <button className="btn btn-sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// ── Painel de configuração da grade ───────────────────────────────────────────

function ConfigPanel({
  map, onClose, onResendImage, resendAvailable,
}: {
  map: BattleMap;
  onClose: () => void;
  onResendImage: () => void;
  resendAvailable: boolean;
}) {
  const { session, updateBattleMap, deleteBattleMap, setFogCells } = useSessionStore();

  function revealAll() {
    const { cols, rows } = gridDims(map.gridType, map.cellSize, map.width, map.height);
    const all: FogCell[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) all.push({ x, y });
    setFogCells(map.id, all);
  }

  return (
    <div className={styles.panel}>
      <h4 className={styles.panelTitle}>⚙️ {map.name}</h4>
      <div className={styles.formGrid}>
        <label>
          Grade
          <select value={map.gridType} onChange={e => updateBattleMap(map.id, { gridType: e.target.value as GridType })}>
            <option value="square">Quadrada</option>
            <option value="hex">Hexagonal</option>
          </select>
        </label>
        <label>
          Célula (px) — {map.cellSize}
          <input type="range" min="20" max="250" value={map.cellSize}
            onChange={e => updateBattleMap(map.id, { cellSize: parseInt(e.target.value, 10) })} />
        </label>
        <label>
          Pés por célula
          <input type="number" min="1" value={map.feetPerCell}
            onChange={e => updateBattleMap(map.id, { feetPerCell: Math.max(1, parseInt(e.target.value, 10) || 5) })} />
        </label>
      </div>
      <div className={styles.configActions}>
        <button className="btn btn-sm" onClick={revealAll}>🔦 Revelar tudo</button>
        <button className="btn btn-sm" onClick={() => setFogCells(map.id, [])}>🌫️ Ocultar tudo</button>
        {map.imageRefId && (
          <button className="btn btn-sm" onClick={onResendImage} disabled={!resendAvailable || session.peers.length === 0}
            title="Reenviar a imagem para os jogadores (útil para quem entrou depois)">
            📤 Reenviar imagem
          </button>
        )}
        <button className="btn btn-sm btn-danger"
          onClick={() => { if (window.confirm(`Excluir o mapa "${map.name}"?`)) { deleteBattleMap(map.id); onClose(); } }}>
          🗑️ Excluir mapa
        </button>
      </div>
      <div className={styles.panelFooter}>
        <button className="btn btn-sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// ── Vista principal do mestre ─────────────────────────────────────────────────

export function BattleMapView() {
  const {
    session, mapTransferProgress,
    activateBattleMap, updateBattleMap, moveBattleToken, setFogCells, pushBattleMapImage,
  } = useSessionStore();

  const record = session.activeBattleMapId
    ? session.battleMaps.find(b => b.map.id === session.activeBattleMapId) ?? null
    : null;
  const map = record?.map ?? null;

  const [tool, setTool] = useState<BattleTool>('pan');
  const [brush, setBrush] = useState(1);
  const [openPanel, setOpenPanel] = useState<'new' | 'tokens' | 'config' | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [fogDraft, setFogDraft] = useState<FogCell[] | null>(null);

  const measuringRef = useRef(false);
  const paintingRef = useRef(false);
  const draftSetRef = useRef<Set<string>>(new Set());
  const blobUrlRef = useRef<string | null>(null);
  const resendBusyRef = useRef(false);

  const stage = useBattleStage(map?.width ?? 0, map?.height ?? 0);

  // Carrega imagem de fundo do IDB
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
    }).catch(() => { /* mapa sem imagem no IDB — grid em fundo liso */ });
    return () => { cancelled = true; };
  }, [map?.imageRefId]);

  // Ferramentas de névoa só fazem sentido com névoa ativa
  useEffect(() => {
    if (!map?.fogEnabled && (tool === 'reveal' || tool === 'hide')) setTool('pan');
  }, [map?.fogEnabled, tool]);

  function centerViewCell(): { col: number; row: number } {
    if (!map) return { col: 0, row: 0 };
    const pt = stage.toImageCoords({ x: stage.canvasSize.w / 2, y: stage.canvasSize.h / 2 });
    return clampCell(map, pointToCell(map.gridType, map.cellSize, pt.x, pt.y));
  }

  // ── Névoa: pintura por arrasto ─────────────────────────────────────────────
  function paintAtPointer() {
    if (!map || !record || !stage.stageRef.current) return;
    const pointer = stage.stageRef.current.getPointerPosition();
    if (!pointer) return;
    const pt = stage.toImageCoords(pointer);
    const target = pointToCell(map.gridType, map.cellSize, pt.x, pt.y);
    const { cols, rows } = gridDims(map.gridType, map.cellSize, map.width, map.height);
    const set = draftSetRef.current;
    const radius = brush - 1;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = target.col + dx;
        const row = target.row + dy;
        if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
        const key = `${col},${row}`;
        if (tool === 'reveal') set.add(key);
        else set.delete(key);
      }
    }
    setFogDraft([...set].map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    }));
  }

  function handlePointerDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!map || !record) return;
    if ('touches' in e.evt && e.evt.touches.length > 1) return;
    if (tool === 'reveal' || tool === 'hide') {
      paintingRef.current = true;
      draftSetRef.current = new Set(record.revealed.map(cellKey));
      paintAtPointer();
    } else if (tool === 'measure') {
      const pointer = stage.stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const pt = stage.toImageCoords(pointer);
      const cell = clampCell(map, pointToCell(map.gridType, map.cellSize, pt.x, pt.y));
      const c = cellCenter(map.gridType, map.cellSize, cell.col, cell.row);
      measuringRef.current = true;
      setMeasurement({ x1: c.x, y1: c.y, x2: c.x, y2: c.y, feet: 0 });
    }
  }

  function handlePointerMove(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!map) return;
    if ('touches' in e.evt && e.evt.touches.length > 1) return;
    if (paintingRef.current) {
      paintAtPointer();
    } else if (measuringRef.current && measurement) {
      const pointer = stage.stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const pt = stage.toImageCoords(pointer);
      const endCell = clampCell(map, pointToCell(map.gridType, map.cellSize, pt.x, pt.y));
      const startCell = clampCell(map, pointToCell(map.gridType, map.cellSize, measurement.x1, measurement.y1));
      const c = cellCenter(map.gridType, map.cellSize, endCell.col, endCell.row);
      const feet = cellDistance(map.gridType, startCell, endCell) * map.feetPerCell;
      setMeasurement({ ...measurement, x2: c.x, y2: c.y, feet });
    }
  }

  function handlePointerUp() {
    if (paintingRef.current && map) {
      paintingRef.current = false;
      const committed = [...draftSetRef.current].map(k => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
      });
      setFogDraft(null);
      setFogCells(map.id, committed);
    }
    measuringRef.current = false;
  }

  function handleResendImage() {
    if (!map?.imageRefId || resendBusyRef.current) return;
    resendBusyRef.current = true;
    getMapImageDB(map.imageRefId)
      .then(res => {
        if (res) return pushBattleMapImage(map.imageRefId!, res.meta.mime, res.buffer);
      })
      .catch(console.warn)
      .finally(() => { resendBusyRef.current = false; });
  }

  function selectTool(next: BattleTool) {
    setTool(next);
    if (next !== 'measure') setMeasurement(null);
  }

  const activeEntry = session.combat.active
    ? session.combat.entries[session.combat.currentTurnIndex]
    : undefined;

  const transferring = Object.values(mapTransferProgress);
  const transferPct = transferring.length
    ? Math.round((transferring.reduce((a, b) => a + b, 0) / transferring.length) * 100)
    : null;

  const revealed = fogDraft ?? record?.revealed ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.title}>⚔️ Grid de Batalha</span>

        <select
          className={styles.mapSelect}
          value={session.activeBattleMapId ?? ''}
          onChange={e => activateBattleMap(e.target.value || null)}
        >
          <option value="">— nenhum mapa ativo —</option>
          {session.battleMaps.map(b => (
            <option key={b.map.id} value={b.map.id}>{b.map.name}</option>
          ))}
        </select>

        <button className={`btn btn-sm ${openPanel === 'new' ? styles.btnActive : ''}`}
          onClick={() => setOpenPanel(p => p === 'new' ? null : 'new')}>➕ Novo</button>

        {map && (
          <>
            <button className={`btn btn-sm ${openPanel === 'tokens' ? styles.btnActive : ''}`}
              onClick={() => setOpenPanel(p => p === 'tokens' ? null : 'tokens')}>＋ Token</button>
            <button className={`btn btn-sm ${openPanel === 'config' ? styles.btnActive : ''}`}
              onClick={() => setOpenPanel(p => p === 'config' ? null : 'config')}>⚙️</button>

            <div className={styles.toolGroup}>
              <button className={`btn btn-sm ${tool === 'pan' ? styles.btnActive : ''}`}
                onClick={() => selectTool('pan')} title="Mover mapa e tokens">✋</button>
              <button className={`btn btn-sm ${tool === 'measure' ? styles.btnActive : ''}`}
                onClick={() => selectTool('measure')} title="Régua de medição">📏</button>
              {map.fogEnabled && (
                <>
                  <button className={`btn btn-sm ${tool === 'reveal' ? styles.btnActive : ''}`}
                    onClick={() => selectTool('reveal')} title="Revelar névoa (clique/arraste)">🔦</button>
                  <button className={`btn btn-sm ${tool === 'hide' ? styles.btnActive : ''}`}
                    onClick={() => selectTool('hide')} title="Ocultar névoa (clique/arraste)">🌫️</button>
                  <select className={styles.brushSelect} value={brush}
                    onChange={e => setBrush(parseInt(e.target.value, 10))} title="Tamanho do pincel">
                    <option value="1">1×1</option>
                    <option value="2">3×3</option>
                    <option value="3">5×5</option>
                  </select>
                </>
              )}
            </div>

            <label className={styles.fogToggle} title="Névoa de guerra: jogadores só veem células reveladas">
              <input type="checkbox" checked={map.fogEnabled}
                onChange={e => updateBattleMap(map.id, { fogEnabled: e.target.checked })} />
              Névoa
            </label>
          </>
        )}

        <div className={styles.spacer} />
        {transferPct !== null && <span className={styles.transferHint}>📤 Enviando mapa... {transferPct}%</span>}
        {map && <button className="btn btn-sm" onClick={stage.fitToScreen} title="Ajustar à tela">🔍</button>}
      </div>

      {openPanel === 'new' && <NewMapForm onCancel={() => setOpenPanel(null)} />}
      {openPanel === 'tokens' && map && record && (
        <TokenPanel map={map} tokens={record.tokens} centerCell={centerViewCell} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === 'config' && map && (
        <ConfigPanel map={map} onClose={() => setOpenPanel(null)}
          onResendImage={handleResendImage} resendAvailable={!resendBusyRef.current} />
      )}

      <div
        ref={stage.wrapperRef}
        className={`${styles.canvasWrapper} ${tool !== 'pan' ? styles.crosshair : ''}`}
        onWheel={stage.handleWheel}
      >
        {!map ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⚔️</span>
            <span>Nenhum mapa de batalha ativo.</span>
            <span className={styles.emptyHint}>Clique em "➕ Novo" para criar um grid (com ou sem imagem de fundo).</span>
          </div>
        ) : (
          <Stage
            ref={stage.stageRef}
            width={stage.canvasSize.w}
            height={stage.canvasSize.h}
            draggable={tool === 'pan'}
            onDragEnd={stage.handleStageDragEnd}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={e => { stage.handleTouchMove(e); handlePointerMove(e); }}
            onTouchEnd={() => { stage.handleTouchEnd(); handlePointerUp(); }}
          >
            <Layer>
              {imageEl
                ? <KonvaImage image={imageEl} width={map.width} height={map.height} />
                : <Rect x={0} y={0} width={map.width} height={map.height} fill="#141420" />}
              <GridShape map={map} />
            </Layer>

            {map.fogEnabled && (
              <Layer listening={false}>
                <FogShapes map={map} revealed={revealed} opacity={0.5} />
              </Layer>
            )}

            <Layer>
              {(record?.tokens ?? []).map(token => (
                <BattleTokenNode
                  key={token.id}
                  token={token}
                  map={map}
                  stageScale={stage.stageScale}
                  draggable={tool === 'pan'}
                  isActiveTurn={Boolean(activeEntry && (
                    (token.characterId && activeEntry.characterId === token.characterId) ||
                    token.name === activeEntry.name
                  ))}
                  onMoved={(col, row) => moveBattleToken(token.id, col, row)}
                />
              ))}
            </Layer>

            {measurement && (
              <Layer listening={false}>
                <Line
                  points={[measurement.x1, measurement.y1, measurement.x2, measurement.y2]}
                  stroke="#e8c66e"
                  strokeWidth={2 / stage.stageScale}
                  dash={[8 / stage.stageScale, 6 / stage.stageScale]}
                />
                <Group x={(measurement.x1 + measurement.x2) / 2} y={(measurement.y1 + measurement.y2) / 2}>
                  <Rect
                    width={86 / stage.stageScale}
                    height={26 / stage.stageScale}
                    offsetX={43 / stage.stageScale}
                    offsetY={13 / stage.stageScale}
                    fill="#13131a"
                    stroke="#c9a84c"
                    strokeWidth={1 / stage.stageScale}
                    cornerRadius={4 / stage.stageScale}
                    opacity={0.9}
                  />
                  <Text
                    text={`${measurement.feet} pés`}
                    fontSize={13 / stage.stageScale}
                    fill="#e8c66e"
                    fontStyle="bold"
                    align="center"
                    verticalAlign="middle"
                    width={86 / stage.stageScale}
                    height={26 / stage.stageScale}
                    offsetX={43 / stage.stageScale}
                    offsetY={13 / stage.stageScale}
                  />
                </Group>
              </Layer>
            )}
          </Stage>
        )}
      </div>
    </div>
  );
}
