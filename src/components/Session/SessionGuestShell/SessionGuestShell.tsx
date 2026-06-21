import { useState } from 'react';
import { useSessionStore } from '../../../store/sessionContext';
import { CONDITION_LABELS } from '../../../types/character';
import { SessionLobby } from '../SessionLobby/SessionLobby';
import styles from './SessionGuestShell.module.css';

function AudioUnlockBanner() {
  const { unlockAudio } = useSessionStore();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className={styles.audioBanner}>
      <span>🔊 Clique para habilitar áudio de ambientação</span>
      <button
        className="btn btn-sm"
        onClick={() => { unlockAudio(); setDismissed(true); }}
      >
        Habilitar Áudio
      </button>
      <button
        className="btn btn-sm"
        onClick={() => setDismissed(true)}
        title="Fechar"
      >
        ✕
      </button>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

type GuestTab = 'session' | 'character';

function GuestCharacterView() {
  const { session } = useSessionStore();
  const char = session.myCharacter;

  if (!char) {
    return (
      <div className={styles.emptyState}>
        <h2>Ficha</h2>
        <p>O mestre ainda nao vinculou uma ficha a voce nesta sessao.</p>
      </div>
    );
  }

  const preparedSpells = char.spells.filter(spell => spell.prepared || spell.level === 0);
  const combatEntry = session.combat.entries.find(entry => entry.characterId === char.id);
  const hpCurrent = combatEntry?.hp ?? char.hpCurrent;
  const hpMax = combatEntry?.hpMax ?? char.hpMax;
  const activeConditions = combatEntry?.conditions ?? char.conditions;
  const hpPercent = hpMax > 0 ? Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) : 0;

  return (
    <div className={styles.characterView}>
      <section className={styles.charHero}>
        <div className={styles.portrait}>
          {char.avatarDataUrl
            ? <img src={char.avatarDataUrl} alt={char.name} className={styles.portraitImg} />
            : <span>{initials(char.name)}</span>}
        </div>
        <div className={styles.heroInfo}>
          <h2>{char.name}</h2>
          <p>
            {[char.race, char.class, char.subclass].filter(Boolean).join(' - ')}
            {char.level ? ` - Nivel ${char.level}` : ''}
          </p>
        </div>
        <div className={styles.hpBlock}>
          <div className={styles.hpText}>{hpCurrent}/{hpMax} HP</div>
          <div className={styles.hpBar}>
            <span style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.statGrid}>
        <div><span>CA</span><strong>{char.armorClass}</strong></div>
        <div><span>Iniciativa</span><strong>{char.initiative >= 0 ? `+${char.initiative}` : char.initiative}</strong></div>
        <div><span>Velocidade</span><strong>{char.speed} ft</strong></div>
        <div><span>Temp</span><strong>{char.hpTemp}</strong></div>
      </section>

      {activeConditions.length > 0 && (
        <section className={styles.panel}>
          <h3>Condicoes</h3>
          <div className={styles.badges}>
            {activeConditions.map(cond => (
              <span key={cond}>{CONDITION_LABELS[cond as keyof typeof CONDITION_LABELS] ?? cond}</span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <h3>Ataques</h3>
        {char.attacks.length === 0 ? (
          <p className={styles.muted}>Nenhum ataque cadastrado.</p>
        ) : (
          <div className={styles.rows}>
            {char.attacks.map(attack => (
              <div key={attack.id} className={styles.row}>
                <strong>{attack.name}</strong>
                <span>{attack.bonus} - {attack.damage} {attack.damageType}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h3>Recursos</h3>
        {char.classResources.length === 0 ? (
          <p className={styles.muted}>Nenhum recurso cadastrado.</p>
        ) : (
          <div className={styles.rows}>
            {char.classResources.map(resource => (
              <div key={resource.id} className={styles.row}>
                <strong>{resource.name}</strong>
                <span>{resource.current}/{resource.max}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h3>Magias Preparadas</h3>
        {preparedSpells.length === 0 ? (
          <p className={styles.muted}>Nenhuma magia preparada.</p>
        ) : (
          <div className={styles.rows}>
            {preparedSpells.map(spell => (
              <div key={spell.id} className={styles.row}>
                <strong>{spell.name}</strong>
                <span>{spell.level === 0 ? 'Truque' : `Nivel ${spell.level}`} - {spell.school}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SessionGuestShell() {
  const { session } = useSessionStore();
  const [activeTab, setActiveTab] = useState<GuestTab>('session');
  const headerCharacter = session.myCharacter;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span>⚔</span>
          <span className={styles.brandName}>Mesa Digital</span>
        </div>
        <div className={styles.status}>
          {headerCharacter?.avatarDataUrl ? (
            <img src={headerCharacter.avatarDataUrl} alt={headerCharacter.name} className={styles.statusAvatar} />
          ) : headerCharacter ? (
            <span className={styles.statusAvatar}>{initials(headerCharacter.name)}</span>
          ) : null}
          <span className={styles.dot} />
          <span>{session.myPlayerName}</span>
        </div>
      </header>

      <nav className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'session' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('session')}
        >
          Sessao
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'character' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('character')}
        >
          Ficha
        </button>
      </nav>

      <AudioUnlockBanner />
      <main className={styles.main}>
        {activeTab === 'session' ? <SessionLobby /> : <GuestCharacterView />}
      </main>
    </div>
  );
}
