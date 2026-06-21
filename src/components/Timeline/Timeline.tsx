import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/context';
import type { GrimoireEvent } from '../../types';
import { DEFAULT_TYPES } from '../../types';
import { dateToAbsoluteDays, formatDate, formatDuration, formatRelativeToNow } from '../../utils/dateUtils';
import { EventModal } from './EventModal';
import { TimelineVisual } from './TimelineVisual';
import styles from './Timeline.module.css';

const PAGE_SIZE = 50;
const SPOILER_LABELS = { not: '', minor: '🟡 Minor', major: '🔴 Major' };

export function Timeline() {
  const { state, dispatch, canUndo, undo } = useAppStore();
  const { filters } = state.ui;
  const [modalEvent, setModalEvent] = useState<GrimoireEvent | null | 'new'>(null);
  const [page, setPage] = useState(1);
  const allTypes = [...DEFAULT_TYPES, ...state.customTypes];

  // Collect all unique tags from events for the filter dropdown
  const allTags = useMemo(() => {
    const set = new Set<string>();
    state.events.forEach(e => (e.tags ?? []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [state.events]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setModalEvent('new');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [filters]);

  const nowDays = dateToAbsoluteDays(
    state.setup.currentYear,
    state.setup.currentMonth,
    state.setup.currentDay,
    state.setup.calendar
  );

  const filtered = useMemo(() => {
    let list = [...state.events];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.chars.toLowerCase().includes(q) ||
        (e.tags ?? []).some(t => t.includes(q))
      );
    }
    if (filters.era) list = list.filter(e => e.era === filters.era);
    if (filters.type) list = list.filter(e => e.type === filters.type);
    if (filters.significance) list = list.filter(e => e.significance === filters.significance);
    if (filters.tagFilter) list = list.filter(e => (e.tags ?? []).includes(filters.tagFilter));

    list.sort((a, b) => {
      const da = dateToAbsoluteDays(a.startYear, a.startMonth, a.startDay, state.setup.calendar);
      const db = dateToAbsoluteDays(b.startYear, b.startMonth, b.startDay, state.setup.calendar);
      return filters.sortDir === 'asc' ? da - db : db - da;
    });

    return list;
  }, [state.events, state.setup.calendar, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort() {
    dispatch({ type: 'UPDATE_FILTERS', payload: { sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' } });
  }

  function toggleView() {
    dispatch({ type: 'UPDATE_FILTERS', payload: { viewMode: filters.viewMode === 'table' ? 'visual' : 'table' } });
  }

  function handlePrint() {
    window.print();
  }

  const isVisual = filters.viewMode === 'visual';

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            className={styles.search}
            placeholder="🔍 Buscar eventos..."
            value={filters.search}
            onChange={e => dispatch({ type: 'UPDATE_FILTERS', payload: { search: e.target.value } })}
          />
          <select
            value={filters.era}
            onChange={e => dispatch({ type: 'UPDATE_FILTERS', payload: { era: e.target.value } })}
          >
            <option value="">Todas as Eras</option>
            {state.eras.map(era => <option key={era}>{era}</option>)}
          </select>
          <select
            value={filters.type}
            onChange={e => dispatch({ type: 'UPDATE_FILTERS', payload: { type: e.target.value } })}
          >
            <option value="">Todos os Tipos</option>
            {allTypes.map(t => <option key={t}>{t}</option>)}
          </select>
          <select
            value={filters.significance}
            onChange={e => dispatch({ type: 'UPDATE_FILTERS', payload: { significance: e.target.value } })}
          >
            <option value="">Toda Significância</option>
            {state.significance.map(s => <option key={s}>{s}</option>)}
          </select>
          {allTags.length > 0 && (
            <select
              value={filters.tagFilter ?? ''}
              onChange={e => dispatch({ type: 'UPDATE_FILTERS', payload: { tagFilter: e.target.value } })}
            >
              <option value="">Todas as Tags</option>
              {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
            </select>
          )}
        </div>
        <div className={styles.toolbarActions}>
          {canUndo && (
            <button className="btn btn-ghost btn-sm" onClick={undo} title="Desfazer (Ctrl+Z)">
              ↩ Desfazer
            </button>
          )}
          <button
            className={`btn btn-ghost btn-sm ${isVisual ? styles.viewActive : ''}`}
            onClick={toggleView}
            title={isVisual ? 'Visão tabela' : 'Visão cronológica visual'}
          >
            {isVisual ? '☰ Tabela' : '📅 Visual'}
          </button>
          <button className="btn btn-ghost btn-sm no-print" onClick={handlePrint} title="Imprimir / Exportar PDF">
            🖨️ Imprimir
          </button>
          <button className="btn btn-primary" onClick={() => setModalEvent('new')} title="Novo Evento (N)">
            ＋ Novo Evento
          </button>
        </div>
      </div>

      <div className={styles.countRow}>
        <span className={styles.count}>
          {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== state.events.length && ` de ${state.events.length}`}
          {filters.tagFilter && <span className={styles.tagFilterBadge}>#{filters.tagFilter}</span>}
        </span>
        {!isVisual && (
          <button className="btn btn-ghost btn-sm" onClick={toggleSort}>
            {filters.sortDir === 'asc' ? '↑' : '↓'} Data
          </button>
        )}
      </div>

      {state.events.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
          <h3>Nenhum evento na linha do tempo</h3>
          <p>Clique em "Novo Evento" ou pressione <kbd>N</kbd> para começar.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum resultado encontrado</h3>
          <p>Tente ajustar os filtros de busca.</p>
        </div>
      ) : isVisual ? (
        <TimelineVisual events={filtered} />
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Era</th>
                  <th>Nome</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Duração / Relação</th>
                  <th>Tipo</th>
                  <th>Significância</th>
                  <th>Localização</th>
                  <th>Spoiler</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(event => {
                  const startDays = dateToAbsoluteDays(event.startYear, event.startMonth, event.startDay, state.setup.calendar);
                  const endDays = event.endYear
                    ? dateToAbsoluteDays(event.endYear, event.endMonth, event.endDay, state.setup.calendar)
                    : null;

                  const durationText = endDays
                    ? formatDuration(startDays, endDays)
                    : formatRelativeToNow(startDays, nowDays);

                  return (
                    <tr key={event.id} className={styles.row} onClick={() => setModalEvent(event)}>
                      <td><span className="tag">{event.era}</span></td>
                      <td className={styles.nameCell}>
                        <span className={styles.name}>{event.name}</span>
                        {event.personal === 'yes' && <span className={styles.private}>🔒</span>}
                        {(event.tags ?? []).length > 0 && (
                          <span className={styles.tagDot} title={(event.tags ?? []).map(t => `#${t}`).join(' ')}>●</span>
                        )}
                      </td>
                      <td className={styles.date}>
                        {formatDate(event.startYear, event.startMonth, event.startDay, state.setup.calendar)}
                      </td>
                      <td className={styles.date}>
                        {event.endYear
                          ? formatDate(event.endYear, event.endMonth, event.endDay, state.setup.calendar)
                          : <span className={styles.none}>—</span>}
                      </td>
                      <td className={styles.duration}>{durationText}</td>
                      <td className={styles.type}>{event.type}</td>
                      <td>
                        <span className={`tag ${event.significance.startsWith('Major') ? 'tag-gold' : ''}`}>
                          {event.significance}
                        </span>
                      </td>
                      <td className={styles.location}>{event.location || <span className={styles.none}>—</span>}</td>
                      <td>
                        {event.spoiler !== 'not' && (
                          <span className={`tag ${event.spoiler === 'major' ? 'tag-red' : ''}`}>
                            {SPOILER_LABELS[event.spoiler]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {page} de {totalPages} · {filtered.length} eventos
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {modalEvent !== null && (
        <EventModal
          event={modalEvent === 'new' ? null : modalEvent}
          onClose={() => setModalEvent(null)}
        />
      )}
    </div>
  );
}
