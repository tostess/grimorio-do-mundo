import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../store/context';
import styles from './GlobalSearch.module.css';

interface SearchResult {
  kind: 'event' | 'prompt' | 'idea';
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: Props) {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    for (const e of state.events) {
      if (
        e.name.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.chars.toLowerCase().includes(q) ||
        (e.tags ?? []).some(t => t.includes(q))
      ) {
        out.push({
          kind: 'event',
          id: String(e.id),
          title: e.name,
          subtitle: e.summary ? e.summary.slice(0, 80) : e.location || e.type,
          meta: `${e.era} · ${e.startYear}`,
        });
      }
    }

    for (const cat of state.prompts) {
      for (const item of cat.items) {
        if (item.text.toLowerCase().includes(q) || item.note.toLowerCase().includes(q)) {
          out.push({
            kind: 'prompt',
            id: item.id,
            title: item.text.slice(0, 80),
            subtitle: cat.category,
            meta: item.done ? '✓ Respondido' : 'Pendente',
          });
        }
      }
    }

    for (const cat of state.ideas) {
      for (const idea of cat.ideas) {
        if (
          idea.title.toLowerCase().includes(q) ||
          idea.description.toLowerCase().includes(q)
        ) {
          out.push({
            kind: 'idea',
            id: `${cat.category}-${idea.title}`,
            title: idea.title,
            subtitle: idea.description.slice(0, 80),
            meta: cat.category,
          });
        }
      }
    }

    return out.slice(0, 30);
  }, [query, state.events, state.prompts, state.ideas]);

  useEffect(() => {
    setSelected(0);
  }, [results.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  function navigate(result: SearchResult) {
    if (result.kind === 'event') {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'timeline' });
      dispatch({ type: 'UPDATE_FILTERS', payload: { search: result.title } });
    } else if (result.kind === 'prompt') {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'prompts' });
    } else {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'ideas' });
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && results[selected]) navigate(results[selected]);
    else if (e.key === 'Escape') onClose();
  }

  if (!open) return null;

  const KIND_ICONS: Record<SearchResult['kind'], string> = {
    event: '⏳',
    prompt: '💡',
    idea: '🎲',
  };

  const KIND_LABELS: Record<SearchResult['kind'], string> = {
    event: 'Evento',
    prompt: 'Prompt',
    idea: 'Ideia',
  };

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.panel}>
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Buscar eventos, prompts, ideias..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.esc} onClick={onClose}>Esc</kbd>
        </div>

        {query.length >= 2 && (
          <div className={styles.results} ref={listRef}>
            {results.length === 0 ? (
              <div className={styles.empty}>Nenhum resultado para "{query}"</div>
            ) : (
              results.map((r, i) => (
                <div
                  key={r.id + r.kind}
                  className={`${styles.result} ${i === selected ? styles.resultSelected : ''}`}
                  onClick={() => navigate(r)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className={styles.kindIcon}>{KIND_ICONS[r.kind]}</span>
                  <div className={styles.resultBody}>
                    <div className={styles.resultTitle}>{r.title}</div>
                    {r.subtitle && <div className={styles.resultSub}>{r.subtitle}</div>}
                  </div>
                  <div className={styles.resultRight}>
                    <span className={`${styles.kindBadge} ${styles[`kind-${r.kind}`]}`}>
                      {KIND_LABELS[r.kind]}
                    </span>
                    {r.meta && <span className={styles.resultMeta}>{r.meta}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {query.length < 2 && (
          <div className={styles.hints}>
            <div className={styles.hintRow}><kbd>↑↓</kbd> Navegar</div>
            <div className={styles.hintRow}><kbd>Enter</kbd> Ir para</div>
            <div className={styles.hintRow}><kbd>Esc</kbd> Fechar</div>
            <div className={styles.hintScope}>Busca em: Eventos · Prompts · Ideias</div>
          </div>
        )}
      </div>
    </div>
  );
}
