import { useMemo, useState } from 'react';
import type { GrimoireEvent } from '../../types';
import { DEFAULT_TYPES } from '../../types';
import { useAppStore } from '../../store/context';
import { EventModal } from './EventModal';
import styles from './TimelineVisual.module.css';

interface Props {
  events: GrimoireEvent[];
}

const ERA_PALETTES = [
  { bg: 'rgba(90,60,20,0.18)', border: '#6a4a1a', text: '#c9a84c', glow: 'rgba(201,168,76,0.15)' },
  { bg: 'rgba(20,40,90,0.18)', border: '#1a3a6a', text: '#4a8aaa', glow: 'rgba(74,138,170,0.15)' },
  { bg: 'rgba(20,80,40,0.18)', border: '#1a5a2a', text: '#4aaa70', glow: 'rgba(74,170,112,0.15)' },
  { bg: 'rgba(80,20,80,0.18)', border: '#5a1a6a', text: '#aa4aaa', glow: 'rgba(170,74,170,0.15)' },
  { bg: 'rgba(80,40,10,0.18)', border: '#6a3a0a', text: '#cc8844', glow: 'rgba(204,136,68,0.15)' },
];

const DEFAULT_TYPE_COLORS = [
  '#8b2020', // 💥 Militar, guerra
  '#8b7020', // 👑 Político, sucessão
  '#5a2a8b', // 🔮 Arcano, mágico
  '#8b6020', // 🙏 Religioso, divino
  '#1a4a8b', // 🌊 Natural, ambiental
  '#3a3a4a', // 💀 Extinção, catástrofe
  '#1a6b3a', // 🗺️ Descoberta, exploração
  '#5a4a1a', // 🦠 Praga, crise
  '#2a4a6a', // 👥 Social, cultural
  '#7a6020', // 💰 Econômico, comercial
  '#3a1a5a', // 👻 Paranormal, espiritual
  '#404050', // 🏛️ Fundação, construção
];

const LANE_H = 36;   // px per lane (bar 34px + 2px gap)
const LANE_PAD = 7;  // top/bottom padding inside the track

function getTypeColor(type: string): string {
  const idx = DEFAULT_TYPES.indexOf(type);
  return idx >= 0 ? (DEFAULT_TYPE_COLORS[idx] ?? '#2a2a3a') : '#2a2a3a';
}

// Greedy interval scheduling: assigns each event to the first lane where it fits.
// Returns a Map<eventId, laneIndex>.
function assignLanes(evs: GrimoireEvent[]): Map<number, number> {
  const sorted = [...evs].sort((a, b) => a.startYear - b.startYear);
  const laneEnds: number[] = []; // last end-year occupied per lane
  const result = new Map<number, number>();
  for (const ev of sorted) {
    const start = ev.startYear;
    const end = ev.endYear ?? ev.startYear;
    let lane = laneEnds.findIndex(e => e < start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    else laneEnds[lane] = Math.max(laneEnds[lane], end);
    result.set(ev.id, lane);
  }
  return result;
}

type EraGroup = {
  era: string;
  palette: (typeof ERA_PALETTES)[0];
  events: GrimoireEvent[];
  lanes: Map<number, number>;
  numLanes: number;
};

export function TimelineVisual({ events }: Props) {
  const { state } = useAppStore();
  const [modalEvent, setModalEvent] = useState<GrimoireEvent | null>(null);
  const [tooltip, setTooltip] = useState<{ event: GrimoireEvent; x: number; y: number } | null>(null);

  const { minYear, maxYear, eraGroups, yearStep, innerMinWidth } = useMemo(() => {
    if (events.length === 0) {
      return { minYear: 1, maxYear: 100, eraGroups: [] as EraGroup[], yearStep: 10, innerMinWidth: 900 };
    }

    let min = Infinity, max = -Infinity;
    for (const e of events) {
      if (e.startYear < min) min = e.startYear;
      const end = e.endYear ?? e.startYear;
      if (end > max) max = end;
    }
    if (min === max) { min -= 1; max += 1; }

    const range = max - min;
    const step = range <= 20 ? 1 : range <= 100 ? 10 : range <= 500 ? 50 : 100;

    const groups: EraGroup[] = [];
    state.eras.forEach((era, i) => {
      const eraEvents = events.filter(e => e.era === era);
      if (eraEvents.length === 0) return;
      const lanes = assignLanes(eraEvents);
      const numLanes = lanes.size === 0 ? 1 : Math.max(...Array.from(lanes.values())) + 1;
      groups.push({ era, palette: ERA_PALETTES[i % ERA_PALETTES.length], events: eraEvents, lanes, numLanes });
    });
    const unknownEvents = events.filter(e => !state.eras.includes(e.era));
    if (unknownEvents.length > 0) {
      const lanes = assignLanes(unknownEvents);
      const numLanes = lanes.size === 0 ? 1 : Math.max(...Array.from(lanes.values())) + 1;
      groups.push({ era: 'Outros', palette: ERA_PALETTES[groups.length % ERA_PALETTES.length], events: unknownEvents, lanes, numLanes });
    }

    // Ensure minimum pixel density so the scroll is usable: at least 4px per year, min 900px.
    const innerMinWidth = Math.max(900, range * 4);

    return { minYear: min, maxYear: max, eraGroups: groups, yearStep: step, innerMinWidth };
  }, [events, state.eras]);

  const range = maxYear - minYear || 1;

  function xPercent(year: number): number {
    return Math.max(0, Math.min(100, ((year - minYear) / range) * 100));
  }

  function widthPercent(startYear: number, endYear: number | null): number {
    const end = endYear ?? startYear;
    const w = ((end - startYear) / range) * 100;
    return Math.max(0.5, w);
  }

  const yearTicks = useMemo(() => {
    const ticks: number[] = [];
    const start = Math.ceil(minYear / yearStep) * yearStep;
    for (let y = start; y <= maxYear; y += yearStep) ticks.push(y);
    return ticks;
  }, [minYear, maxYear, yearStep]);

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
        <h3>Nenhum evento para visualizar</h3>
        <p>Ajuste os filtros ou adicione eventos à linha do tempo.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scroll}>
        <div className={styles.inner} style={{ minWidth: innerMinWidth }}>
          {/* Year axis */}
          <div className={styles.yearAxis}>
            <div className={styles.eraLabel} />
            <div className={styles.axisTrack}>
              {yearTicks.map(y => (
                <div
                  key={y}
                  className={styles.yearTick}
                  style={{ left: `${xPercent(y)}%` }}
                >
                  <div className={styles.tickLine} />
                  <span className={styles.tickLabel}>{y}</span>
                </div>
              ))}
              <div className={styles.axisLine} />
            </div>
          </div>

          {/* Era rows */}
          {eraGroups.map(({ era, palette, events: eraEvents, lanes, numLanes }) => {
            const trackHeight = LANE_PAD + numLanes * LANE_H + LANE_PAD;
            return (
              <div key={era} className={styles.eraRow} style={{ background: palette.bg, borderColor: palette.border }}>
                <div className={styles.eraLabel} style={{ color: palette.text, borderRightColor: palette.border }}>
                  <span className={styles.eraName}>{era}</span>
                  <span className={styles.eraCount}>{eraEvents.length}</span>
                </div>
                <div className={styles.eraTrack} style={{ height: trackHeight, minHeight: trackHeight }}>
                  {eraEvents.map(ev => {
                    const left = xPercent(ev.startYear);
                    const width = widthPercent(ev.startYear, ev.endYear);
                    const color = getTypeColor(ev.type);
                    const lane = lanes.get(ev.id) ?? 0;
                    const top = LANE_PAD + lane * LANE_H;
                    return (
                      <div
                        key={ev.id}
                        className={styles.eventBar}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: `${top}px`,
                          background: color,
                          borderColor: palette.border,
                          boxShadow: `0 0 8px ${palette.glow}`,
                        }}
                        onClick={() => setModalEvent(ev)}
                        onMouseEnter={e => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ event: ev, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        title={ev.name}
                      >
                        <span className={styles.eventBarLabel}>{ev.name}</span>
                        {ev.tags?.length > 0 && <span className={styles.eventBarDot} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className={styles.legend}>
            <span className={styles.legendTitle}>Tipos:</span>
            {DEFAULT_TYPES.map((type, i) => (
              <span key={type} className={styles.legendItem} style={{ background: DEFAULT_TYPE_COLORS[i] }} title={type}>
                {[...type][0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className={styles.tooltipName}>{tooltip.event.name}</div>
          <div className={styles.tooltipMeta}>
            {tooltip.event.startYear}
            {tooltip.event.endYear ? ` – ${tooltip.event.endYear}` : ''}
            {' · '}
            {tooltip.event.type}
          </div>
          {tooltip.event.summary && (
            <div className={styles.tooltipSummary}>{tooltip.event.summary.slice(0, 100)}{tooltip.event.summary.length > 100 ? '…' : ''}</div>
          )}
          {tooltip.event.tags?.length > 0 && (
            <div className={styles.tooltipTags}>
              {tooltip.event.tags.map(t => <span key={t}>#{t}</span>)}
            </div>
          )}
          <div className={styles.tooltipHint}>Clique para editar</div>
        </div>
      )}

      {modalEvent && (
        <EventModal event={modalEvent} onClose={() => setModalEvent(null)} />
      )}
    </div>
  );
}
