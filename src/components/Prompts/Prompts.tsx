import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/context';
import styles from './Prompts.module.css';

export function Prompts() {
  const { state, dispatch } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all');
  const [search, setSearch] = useState('');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [randomPick, setRandomPick] = useState<string | null>(null);

  function randomPrompt() {
    const undone: string[] = [];
    state.prompts.forEach(cat => {
      cat.items.forEach(item => {
        if (!item.done) undone.push(item.id);
      });
    });
    if (undone.length === 0) { alert('Todos os prompts já foram respondidos!'); return; }
    const picked = undone[Math.floor(Math.random() * undone.length)];
    setRandomPick(picked);
    // Expand category that contains the picked prompt
    state.prompts.forEach(cat => {
      if (cat.items.some(i => i.id === picked)) {
        dispatch({ type: 'TOGGLE_PROMPT_COLLAPSE', payload: cat.category });
      }
    });
  }

  function convertToEvent(text: string) {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'timeline' });
    // Store text in sessionStorage so Timeline can pick it up
    sessionStorage.setItem('prefill_summary', text);
  }

  const totalDone = state.prompts.reduce((s, c) => s + c.items.filter(i => i.done).length, 0);
  const totalAll = state.prompts.reduce((s, c) => s + c.items.length, 0);

  const filteredPrompts = useMemo(() => {
    return state.prompts.map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        if (filter === 'done' && !item.done) return false;
        if (filter === 'todo' && item.done) return false;
        if (search && !item.text.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    })).filter(cat => cat.items.length > 0);
  }, [state.prompts, filter, search]);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            className={styles.search}
            placeholder="🔍 Buscar prompts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.filterBtns}>
            {(['all', 'todo', 'done'] as const).map(f => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'todo' ? 'Pendentes' : 'Respondidos'}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={randomPrompt}>
          🎲 Prompt Aleatório
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${Math.round((totalDone / totalAll) * 100)}%` }} />
        </div>
        <span className={styles.progressText}>{totalDone} / {totalAll} respondidos ({Math.round((totalDone / totalAll) * 100)}%)</span>
      </div>

      <div className={styles.categories}>
        {filteredPrompts.map(cat => {
          const isCollapsed = state.ui.promptCollapsed[cat.category];
          const catDone = cat.items.filter(i => i.done).length;
          return (
            <div key={cat.category} className={styles.category}>
              <button
                className={styles.catHeader}
                onClick={() => dispatch({ type: 'TOGGLE_PROMPT_COLLAPSE', payload: cat.category })}
              >
                <span className={styles.catName}>{cat.category}</span>
                <span className={styles.catCount}>{catDone}/{cat.items.length}</span>
                <span className={styles.catChevron}>{isCollapsed ? '▶' : '▼'}</span>
              </button>
              {!isCollapsed && (
                <div className={styles.items}>
                  {cat.items.map(item => (
                    <div
                      key={item.id}
                      className={`${styles.item} ${item.done ? styles.itemDone : ''} ${randomPick === item.id ? styles.highlighted : ''}`}
                    >
                      <div className={styles.itemMain}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => dispatch({ type: 'TOGGLE_PROMPT', payload: item.id })}
                          className={styles.checkbox}
                        />
                        <span className={styles.itemText}>{item.text}</span>
                        <div className={styles.itemActions}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpandedNote(expandedNote === item.id ? null : item.id)}
                            title="Adicionar nota"
                          >
                            📝
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => convertToEvent(item.text)}
                            title="Converter em evento"
                          >
                            ⏳
                          </button>
                        </div>
                      </div>
                      {(expandedNote === item.id || item.note) && (
                        <div className={styles.noteArea}>
                          <textarea
                            value={item.note}
                            onChange={e => dispatch({ type: 'UPDATE_PROMPT_NOTE', payload: { id: item.id, note: e.target.value } })}
                            placeholder="Suas notas sobre este prompt..."
                            rows={2}
                            style={{ width: '100%' }}
                            onClick={() => setExpandedNote(item.id)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredPrompts.length === 0 && (
          <div className="empty-state">
            <h3>Nenhum prompt encontrado</h3>
            <p>Tente ajustar o filtro ou a busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
