import { useState } from 'react';
import { useAppStore } from '../../store/context';
import { DEFAULT_TYPES, DEFAULT_SIGNIFICANCE } from '../../types';
import styles from './TypesData.module.css';

export function TypesData() {
  const { state, dispatch } = useAppStore();
  const [newEra, setNewEra] = useState('');
  const [newType, setNewType] = useState('');
  const [newSig, setNewSig] = useState('');

  function addEra() {
    const v = newEra.trim();
    if (!v) return;
    dispatch({ type: 'ADD_ERA', payload: v });
    setNewEra('');
  }

  function deleteEra(era: string) {
    const hasEvents = state.events.some(e => e.era === era);
    if (hasEvents) {
      alert(`Não é possível excluir a era "${era}" pois há eventos atribuídos a ela.`);
      return;
    }
    if (state.eras.length <= 1) {
      alert('Deve existir pelo menos uma era.');
      return;
    }
    if (confirm(`Excluir a era "${era}"?`)) {
      dispatch({ type: 'DELETE_ERA', payload: era });
    }
  }

  function addType() {
    const v = newType.trim();
    if (!v) return;
    dispatch({ type: 'ADD_CUSTOM_TYPE', payload: v });
    setNewType('');
  }

  function addSig() {
    const v = newSig.trim();
    if (!v) return;
    dispatch({ type: 'ADD_SIGNIFICANCE', payload: v });
    setNewSig('');
  }

  return (
    <div className={styles.container}>
      <div className={styles.panels}>
        {/* Eras */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>⏳ Eras</h2>
          <p className={styles.hint}>Define as eras históricas do seu mundo. Eventos são associados a uma era.</p>
          <div className={styles.list}>
            {state.eras.map(era => {
              const count = state.events.filter(e => e.era === era).length;
              return (
                <div key={era} className={styles.item}>
                  <span className={styles.itemName}>{era}</span>
                  <span className={styles.itemCount}>{count} evento{count !== 1 ? 's' : ''}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteEra(era)}
                    disabled={state.eras.length <= 1}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.addRow}>
            <input
              value={newEra}
              onChange={e => setNewEra(e.target.value)}
              placeholder="Nova era..."
              onKeyDown={e => e.key === 'Enter' && addEra()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={addEra}>＋</button>
          </div>
        </div>

        {/* Tipos customizados */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>🔗 Tipos de Evento Customizados</h2>
          <p className={styles.hint}>Adicione tipos além dos padrão do sistema. Use emoji + texto para melhor visualização.</p>

          <p className={styles.subLabel}>Tipos Padrão (não editáveis)</p>
          <div className={styles.list}>
            {DEFAULT_TYPES.map(t => (
              <div key={t} className={`${styles.item} ${styles.defaultItem}`}>
                <span className={styles.itemName}>{t}</span>
              </div>
            ))}
          </div>

          {state.customTypes.length > 0 && (
            <>
              <p className={styles.subLabel} style={{ marginTop: '12px' }}>Tipos Customizados</p>
              <div className={styles.list}>
                {state.customTypes.map(t => (
                  <div key={t} className={styles.item}>
                    <span className={styles.itemName}>{t}</span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => dispatch({ type: 'DELETE_CUSTOM_TYPE', payload: t })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.addRow}>
            <input
              value={newType}
              onChange={e => setNewType(e.target.value)}
              placeholder="✨ Novo tipo... (use emoji)"
              onKeyDown={e => e.key === 'Enter' && addType()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={addType}>＋</button>
          </div>
        </div>

        {/* Significâncias */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>⚖️ Níveis de Significância</h2>
          <p className={styles.hint}>Define os níveis de impacto de um evento no mundo.</p>

          <p className={styles.subLabel}>Significâncias Padrão</p>
          <div className={styles.list}>
            {DEFAULT_SIGNIFICANCE.map(s => (
              <div key={s} className={`${styles.item} ${styles.defaultItem}`}>
                <span className={styles.itemName}>{s}</span>
              </div>
            ))}
          </div>

          {state.significance.filter(s => !DEFAULT_SIGNIFICANCE.includes(s)).length > 0 && (
            <>
              <p className={styles.subLabel} style={{ marginTop: '12px' }}>Customizadas</p>
              <div className={styles.list}>
                {state.significance.filter(s => !DEFAULT_SIGNIFICANCE.includes(s)).map(s => (
                  <div key={s} className={styles.item}>
                    <span className={styles.itemName}>{s}</span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => dispatch({ type: 'DELETE_SIGNIFICANCE', payload: s })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.addRow}>
            <input
              value={newSig}
              onChange={e => setNewSig(e.target.value)}
              placeholder="Nova significância..."
              onKeyDown={e => e.key === 'Enter' && addSig()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={addSig}>＋</button>
          </div>
        </div>

        {/* Estatísticas de dados */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>📊 Resumo dos Dados</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{state.events.length}</span>
              <span className={styles.summaryLabel}>Eventos</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{state.eras.length}</span>
              <span className={styles.summaryLabel}>Eras</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{DEFAULT_TYPES.length + state.customTypes.length}</span>
              <span className={styles.summaryLabel}>Tipos</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{state.significance.length}</span>
              <span className={styles.summaryLabel}>Significâncias</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {state.prompts.reduce((s, c) => s + c.items.filter(i => i.done).length, 0)}
              </span>
              <span className={styles.summaryLabel}>Prompts Feitos</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>
                {state.ideas.reduce((s, c) => s + c.ideas.filter(i => i.used).length, 0)}
              </span>
              <span className={styles.summaryLabel}>Ideias Usadas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
