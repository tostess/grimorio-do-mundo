import { useState, useRef, useEffect, useCallback } from 'react';
import { Shape, Rect, Line, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { BattleMap, MapToken, FogCell } from '../../../types/map';
import { cellCenter, pointToCell, gridDims, hexCornerPoints } from '../../../utils/gridMath';

// ── Pan/zoom imperativo (mesmo padrão do WorldMap: Stage nunca controlado por props) ──

export function useBattleStage(mapW: number, mapH: number) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 520 });
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const applyTransform = useCallback((pos: { x: number; y: number }, scale: number) => {
    posRef.current = pos;
    scaleRef.current = scale;
    if (stageRef.current) {
      stageRef.current.scale({ x: scale, y: scale });
      stageRef.current.position(pos);
      stageRef.current.batchDraw();
    }
    setStageScale(scale);
  }, []);

  const fitToScreen = useCallback(() => {
    const cs = canvasSizeRef.current;
    if (mapW <= 0 || mapH <= 0) return;
    const s = Math.min(cs.w / mapW, cs.h / mapH, 1.5);
    applyTransform({ x: (cs.w - mapW * s) / 2, y: (cs.h - mapH * s) / 2 }, s);
  }, [mapW, mapH, applyTransform]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!stageRef.current) return;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const curScale = scaleRef.current;
    const newScale = Math.min(Math.max(curScale * factor, 0.05), 8);
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const curPos = posRef.current;
    applyTransform({
      x: mx - (mx - curPos.x) * (newScale / curScale),
      y: my - (my - curPos.y) * (newScale / curScale),
    }, newScale);
  }, [applyTransform]);

  // Pinch-zoom mobile: dois toques ajustam scale/posição; drag do Stage é interrompido
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!stage || !rect) return;
    if (stage.isDragging()) stage.stopDrag();

    const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    if (!pinchRef.current) {
      pinchRef.current = { dist, center };
      return;
    }
    const curScale = scaleRef.current;
    const newScale = Math.min(Math.max(curScale * (dist / pinchRef.current.dist), 0.05), 8);
    const curPos = posRef.current;
    applyTransform({
      x: center.x - (pinchRef.current.center.x - curPos.x) * (newScale / curScale),
      y: center.y - (pinchRef.current.center.y - curPos.y) * (newScale / curScale),
    }, newScale);
    pinchRef.current = { dist, center };
  }, [applyTransform]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  const toImageCoords = useCallback((canvasPt: { x: number; y: number }) => ({
    x: (canvasPt.x - posRef.current.x) / scaleRef.current,
    y: (canvasPt.y - posRef.current.y) / scaleRef.current,
  }), []);

  const handleStageDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    // Drags de tokens borbulham até o Stage — só sincroniza quando o próprio Stage foi arrastado
    if (e.target === stageRef.current) {
      posRef.current = { x: e.target.x(), y: e.target.y() };
    }
  }, []);

  return {
    wrapperRef, stageRef, canvasSize, stageScale,
    fitToScreen, handleWheel, handleTouchMove, handleTouchEnd, handleStageDragEnd, toImageCoords,
  };
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export function GridShape({ map }: { map: BattleMap }) {
  return (
    <Shape
      listening={false}
      strokeScaleEnabled={false}
      stroke="rgba(232, 198, 110, 0.22)"
      strokeWidth={1}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        if (map.gridType === 'square') {
          for (let x = 0; x <= map.width + 0.5; x += map.cellSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, map.height);
          }
          for (let y = 0; y <= map.height + 0.5; y += map.cellSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(map.width, y);
          }
        } else {
          const { cols, rows } = gridDims('hex', map.cellSize, map.width, map.height);
          const pts = hexCornerPoints(map.cellSize);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const { x, y } = cellCenter('hex', map.cellSize, c, r);
              ctx.moveTo(x + pts[0], y + pts[1]);
              for (let i = 1; i < 6; i++) ctx.lineTo(x + pts[i * 2], y + pts[i * 2 + 1]);
              ctx.closePath();
            }
          }
        }
        ctx.strokeShape(shape);
      }}
    />
  );
}

// ── Fog of war (Rect preto + buracos via destination-out; usar em Layer própria) ──

export function FogShapes({ map, revealed, opacity }: { map: BattleMap; revealed: FogCell[]; opacity: number }) {
  const hexPts = map.gridType === 'hex' ? hexCornerPoints(map.cellSize, 0.75) : null;
  return (
    <>
      <Rect x={0} y={0} width={map.width} height={map.height} fill="#05050a" opacity={opacity} listening={false} />
      {revealed.map(cell => {
        const key = `${cell.x},${cell.y}`;
        if (map.gridType === 'square') {
          return (
            <Rect
              key={key}
              x={cell.x * map.cellSize - 0.5}
              y={cell.y * map.cellSize - 0.5}
              width={map.cellSize + 1}
              height={map.cellSize + 1}
              fill="#000"
              globalCompositeOperation="destination-out"
              listening={false}
            />
          );
        }
        const c = cellCenter('hex', map.cellSize, cell.x, cell.y);
        return (
          <Line
            key={key}
            x={c.x}
            y={c.y}
            points={hexPts!}
            closed
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        );
      })}
    </>
  );
}

// ── Token ─────────────────────────────────────────────────────────────────────

export function clampCell(map: BattleMap, cell: { col: number; row: number }): { col: number; row: number } {
  const { cols, rows } = gridDims(map.gridType, map.cellSize, map.width, map.height);
  return {
    col: Math.min(Math.max(cell.col, 0), cols - 1),
    row: Math.min(Math.max(cell.row, 0), rows - 1),
  };
}

export function BattleTokenNode({
  token, map, stageScale, draggable, isActiveTurn, onMoved,
}: {
  token: MapToken;
  map: BattleMap;
  stageScale: number;
  draggable: boolean;
  isActiveTurn: boolean;
  onMoved?: (col: number, row: number) => void;
}) {
  const center = cellCenter(map.gridType, map.cellSize, token.x, token.y);
  const r = map.cellSize * 0.4 * token.size;
  const fs = Math.max(8, map.cellSize * 0.3 * token.size);
  const labelFs = Math.max(7, Math.min(12 / stageScale, map.cellSize * 0.24));

  return (
    <Group
      x={center.x}
      y={center.y}
      draggable={draggable}
      onDragEnd={e => {
        const node = e.target as Konva.Group;
        const cell = clampCell(map, pointToCell(map.gridType, map.cellSize, node.x(), node.y()));
        const snapped = cellCenter(map.gridType, map.cellSize, cell.col, cell.row);
        node.position(snapped);
        onMoved?.(cell.col, cell.row);
      }}
    >
      {isActiveTurn && (
        <Circle
          radius={r * 1.35}
          stroke="#e8c66e"
          strokeWidth={3 / stageScale}
          dash={[6 / stageScale, 4 / stageScale]}
          shadowColor="#c9a84c"
          shadowBlur={14}
          shadowOpacity={0.9}
          listening={false}
        />
      )}
      <Circle
        radius={r}
        fill={token.color}
        stroke={token.isNPC ? '#c04040' : '#fff'}
        strokeWidth={2 / stageScale}
        shadowBlur={5}
        shadowOpacity={0.5}
      />
      <Text
        text={token.initials}
        fontSize={fs}
        fontStyle="bold"
        fill="#fff"
        align="center"
        verticalAlign="middle"
        width={r * 2}
        height={r * 2}
        offsetX={r}
        offsetY={r}
        listening={false}
      />
      <Text
        text={token.name}
        fontSize={labelFs}
        fill="#fff"
        align="center"
        width={map.cellSize * 3}
        offsetX={map.cellSize * 1.5}
        y={r + 3 / stageScale}
        shadowColor="#000"
        shadowBlur={3}
        listening={false}
      />
    </Group>
  );
}
