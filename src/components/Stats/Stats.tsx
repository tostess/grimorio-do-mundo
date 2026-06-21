import { useMemo } from 'react';
import { useAppStore } from '../../store/context';
import styles from './Stats.module.css';

export function Stats() {
  const { state } = useAppStore();

  const stats = useMemo(() => {
    const total = state.events.length;
    const totalPrompts = state.prompts.reduce((s, c) => s + c.items.length, 0);
    const donePrompts = state.prompts.reduce((s, c) => s + c.items.filter(i => i.done).length, 0);
    const promptPct = totalPrompts > 0 ? Math.round((donePrompts / totalPrompts) * 100) : 0;

    const byEra: Record<string, number> = {};
    state.eras.forEach(era => { byEra[era] = 0; });
    state.events.forEach(e => { byEra[e.era] = (byEra[e.era] ?? 0) + 1; });

    const byType: Record<string, number> = {};
    state.events.forEach(e => { byType[e.type] = (byType[e.type] ?? 0) + 1; });

    const bySignificance: Record<string, number> = {};
    state.significance.forEach(s => { bySignificance[s] = 0; });
    state.events.forEach(e => { bySignificance[e.significance] = (bySignificance[e.significance] ?? 0) + 1; });

    const spoilers = state.events.filter(e => e.spoiler !== 'not').length;
    const personal = state.events.filter(e => e.personal === 'yes').length;

    const score = Math.min(100, Math.round(
      (Math.min(total / 30, 1) * 0.3 +
       (promptPct / 100) * 0.4 +
       (state.setup.worldDesc.length > 100 ? 0.2 : state.setup.worldDesc.length / 500) * 0.2 +
       (state.setup.calendar.type === 'custom' ? 0.1 : 0.05)) * 100
    ));

    return { total, totalPrompts, donePrompts, promptPct, byEra, byType, bySignificance, spoilers, personal, score };
  }, [state]);

  const maxEraCount = Math.max(1, ...Object.values(stats.byEra));
  const topTypes = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className={styles.container}>
      <div className={styles.scoreCard}>
        <div className={styles.scoreCircle}>
          <span className={styles.scoreNum}>{stats.score}</span>
          <span className={styles.scorePct}>%</span>
        </div>
        <div>
          <h2 className={styles.scoreTitle}>Completude do Cenário</h2>
          <p className={styles.scoreDesc}>
            Baseado em eventos criados, prompts respondidos e detalhes do mundo.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardIcon}>⏳</div>
          <div className={styles.cardValue}>{stats.total}</div>
          <div className={styles.cardLabel}>Eventos na Timeline</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon}>💡</div>
          <div className={styles.cardValue}>{stats.donePrompts}</div>
          <div className={styles.cardLabel}>Prompts Respondidos</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon}>🔴</div>
          <div className={styles.cardValue}>{stats.spoilers}</div>
          <div className={styles.cardLabel}>Eventos com Spoiler</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon}>🔒</div>
          <div className={styles.cardValue}>{stats.personal}</div>
          <div className={styles.cardLabel}>Eventos Privados</div>
        </div>
      </div>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Eventos por Era</h3>
          <div className={styles.bars}>
            {state.eras.map(era => {
              const count = stats.byEra[era] ?? 0;
              const pct = Math.round((count / maxEraCount) * 100);
              return (
                <div key={era} className={styles.barRow}>
                  <span className={styles.barLabel}>{era}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.barCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Top Tipos de Evento</h3>
          <div className={styles.bars}>
            {topTypes.length === 0 ? (
              <p className={styles.empty}>Nenhum evento criado ainda.</p>
            ) : (
              topTypes.map(([type, count]) => {
                const pct = Math.round((count / (topTypes[0]?.[1] ?? 1)) * 100);
                return (
                  <div key={type} className={styles.barRow}>
                    <span className={styles.barLabel}>{type}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%`, background: 'var(--accent-light)' }} />
                    </div>
                    <span className={styles.barCount}>{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Significância dos Eventos</h3>
          <div className={styles.bars}>
            {state.significance.map(sig => {
              const count = stats.bySignificance[sig] ?? 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={sig} className={styles.barRow}>
                  <span className={styles.barLabel}>{sig}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%`, background: 'var(--green-light)' }} />
                  </div>
                  <span className={styles.barCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Progresso dos Prompts</h3>
          <div className={styles.promptProgress}>
            <div className={styles.promptBar}>
              <div className={styles.promptFill} style={{ width: `${stats.promptPct}%` }} />
            </div>
            <p className={styles.promptText}>
              {stats.donePrompts} de {stats.totalPrompts} prompts respondidos ({stats.promptPct}%)
            </p>
            <div className={styles.catProgress}>
              {state.prompts.map(cat => {
                const done = cat.items.filter(i => i.done).length;
                const total = cat.items.length;
                const pct = Math.round((done / total) * 100);
                return (
                  <div key={cat.category} className={styles.barRow}>
                    <span className={styles.barLabel} style={{ fontSize: '11px' }}>{cat.category}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%`, background: 'var(--gold-dark)' }} />
                    </div>
                    <span className={styles.barCount}>{done}/{total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
