import { useState } from 'react';
import { useAppStore } from '../../store/context';
import { EventModal } from '../Timeline/EventModal';
import styles from './EventIdeas.module.css';

export function EventIdeas() {
  const { state, dispatch } = useAppStore();
  const [search, setSearch] = useState('');
  const [showUsed, setShowUsed] = useState(false);
  const [ideaToConvert, setIdeaToConvert] = useState<{ name: string; summary: string } | null>(null);

  const activeCategory = state.ui.ideasCategory;
  const categories = state.ideas.map(c => c.category);

  const currentCatIndex = state.ideas.findIndex(c => c.category === activeCategory);
  const currentCat = currentCatIndex >= 0 ? state.ideas[currentCatIndex] : null;

  const displayedIdeas = (currentCat ? [currentCat] : state.ideas)
    .map(cat => ({
      ...cat,
      ideas: cat.ideas.filter(idea => {
        if (!showUsed && idea.used) return false;
        if (search && !idea.title.toLowerCase().includes(search.toLowerCase()) &&
            !idea.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    }))
    .filter(cat => cat.ideas.length > 0);

  function randomIdea() {
    const available: { catIdx: number; ideaIdx: number }[] = [];
    state.ideas.forEach((cat, ci) => {
      cat.ideas.forEach((idea, ii) => {
        if (!idea.used) available.push({ catIdx: ci, ideaIdx: ii });
      });
    });
    if (available.length === 0) { alert('Todas as ideias já foram usadas!'); return; }
    const pick = available[Math.floor(Math.random() * available.length)];
    const cat = state.ideas[pick.catIdx];
    const idea = cat?.ideas[pick.ideaIdx];
    if (!cat || !idea) return;
    dispatch({ type: 'SET_IDEAS_CATEGORY', payload: cat.category });
    alert(`🎲 Ideia sorteada:\n\n${idea.title}\n\n${idea.description}`);
  }

  function convertToEvent(title: string, description: string) {
    setIdeaToConvert({ name: title, summary: description });
  }

  const totalIdeas = state.ideas.reduce((s, c) => s + c.ideas.length, 0);
  const usedCount = state.ideas.reduce((s, c) => s + c.ideas.filter(i => i.used).length, 0);

  return (
    <>
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <input
            className={styles.search}
            placeholder="🔍 Buscar ideias..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className={styles.toggle}>
            <input type="checkbox" checked={showUsed} onChange={e => setShowUsed(e.target.checked)} />
            Mostrar usadas
          </label>
        </div>
        <button className="btn btn-ghost" onClick={randomIdea}>
          🎲 Ideia Aleatória
        </button>
      </div>

      <div className={styles.stats}>
        <span>{usedCount} de {totalIdeas} ideias marcadas como usadas</span>
      </div>

      <div className={styles.layout}>
        <select
          className={styles.catSelect}
          value={activeCategory}
          onChange={e => dispatch({ type: 'SET_IDEAS_CATEGORY', payload: e.target.value })}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as Categorias</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <nav className={styles.catNav}>
          <button
            className={`${styles.catBtn} ${!activeCategory ? styles.catActive : ''}`}
            onClick={() => dispatch({ type: 'SET_IDEAS_CATEGORY', payload: '' })}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.catBtn} ${activeCategory === cat ? styles.catActive : ''}`}
              onClick={() => dispatch({ type: 'SET_IDEAS_CATEGORY', payload: cat })}
            >
              {cat}
            </button>
          ))}
        </nav>

        <div className={styles.ideas}>
          {displayedIdeas.map(cat => {
            const catIndex = state.ideas.findIndex(c => c.category === cat.category);
            return (
              <div key={cat.category} className={styles.catGroup}>
                {(!activeCategory || displayedIdeas.length > 1) && (
                  <h3 className={styles.catTitle}>{cat.category}</h3>
                )}
                <div className={styles.ideaGrid}>
                  {cat.ideas.map((idea, displayIdx) => {
                    const realIdx = state.ideas[catIndex]?.ideas.findIndex(i => i.title === idea.title) ?? displayIdx;
                    return (
                      <div key={idea.title} className={`${styles.ideaCard} ${idea.used ? styles.ideaUsed : ''}`}>
                        <div className={styles.ideaHeader}>
                          <h4 className={styles.ideaTitle}>{idea.title}</h4>
                          {idea.used && <span className="tag">Usada</span>}
                        </div>
                        <p className={styles.ideaDesc}>{idea.description}</p>
                        <div className={styles.ideaActions}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => dispatch({ type: 'MARK_IDEA_USED', payload: { categoryIndex: catIndex, ideaIndex: realIdx } })}
                          >
                            {idea.used ? '↩ Desmarcar' : '✓ Marcar usada'}
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => convertToEvent(idea.title, idea.description)}
                          >
                            ⏳ Criar Evento
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {displayedIdeas.length === 0 && (
            <div className="empty-state">
              <h3>Nenhuma ideia encontrada</h3>
              <p>Ajuste os filtros ou ative "Mostrar usadas".</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {ideaToConvert && (
      <EventModal
        event={null}
        onClose={() => setIdeaToConvert(null)}
        defaultValues={{ name: ideaToConvert.name, summary: ideaToConvert.summary }}
      />
    )}
    </>
  );
}
