import { useState, useEffect, useCallback } from 'react';
import { useWorldStore } from '../../../store/worldContext';
import {
  loadCharactersDB,
  upsertCharacterDB,
  deleteCharacterDB,
} from '../../../utils/storageDB';
import { createDefaultCharacter, abilityMod, type Character } from '../../../types/character';
import { loadAvatars, type AvatarEntry } from '../../../utils/avatarStorage';
import { AvatarGallery } from '../AvatarGallery/AvatarGallery';
import { CharacterSheet } from '../CharacterSheet/CharacterSheet';
import styles from './CharacterList.module.css';

type SubView = 'chars' | 'avatars';

export function CharacterList() {
  const { activeWorldId } = useWorldStore();
  const [subView, setSubView] = useState<SubView>('chars');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [avatars, setAvatars] = useState<AvatarEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorldId) return;
    Promise.all([
      loadCharactersDB(activeWorldId),
      loadAvatars(),
    ]).then(([chars, avs]) => {
      setCharacters(chars);
      setAvatars(avs);
      setLoading(false);
    });
  }, [activeWorldId]);

  // Refresh avatars when switching to chars view (user may have added avatars)
  useEffect(() => {
    if (subView === 'chars') loadAvatars().then(setAvatars);
  }, [subView]);

  const handleChange = useCallback((updated: Character) => {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
    upsertCharacterDB(updated).catch(console.error);
  }, []);

  async function handleCreate() {
    if (!activeWorldId) return;
    const char = createDefaultCharacter(activeWorldId);
    await upsertCharacterDB(char);
    setCharacters(prev => [...prev, char]);
    setSelectedId(char.id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este personagem? Esta ação não pode ser desfeita.')) return;
    await deleteCharacterDB(id);
    setCharacters(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const selectedChar = characters.find(c => c.id === selectedId) ?? null;

  // Show CharacterSheet when a character is selected in chars view
  if (selectedChar && subView === 'chars') {
    return (
      <CharacterSheet
        character={selectedChar}
        onChange={handleChange}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🧙 Fichas de Personagem</h2>
        <nav className={styles.subTabs}>
          <button
            className={`${styles.subTab} ${subView === 'chars' ? styles.active : ''}`}
            onClick={() => { setSubView('chars'); setSelectedId(null); }}
          >
            📜 Personagens
          </button>
          <button
            className={`${styles.subTab} ${subView === 'avatars' ? styles.active : ''}`}
            onClick={() => setSubView('avatars')}
          >
            🖼️ Avatares
          </button>
        </nav>
      </div>

      <div className={styles.body}>
        {subView === 'avatars' && <AvatarGallery />}

        {subView === 'chars' && (
          <div className={styles.charList}>
            <div className={styles.listToolbar}>
              <span className={styles.listCount}>
                {characters.length} personagem{characters.length !== 1 ? 's' : ''}
              </span>
              <button className={styles.createBtn} onClick={handleCreate}>
                + Nova Ficha
              </button>
            </div>

            {loading && <p className={styles.loading}>Carregando personagens...</p>}

            {!loading && characters.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📜</div>
                <p className={styles.emptyTitle}>Nenhuma ficha ainda</p>
                <p className={styles.emptyHint}>Clique em "Nova Ficha" para começar.</p>
              </div>
            )}

            {!loading && characters.length > 0 && (
              <div className={styles.grid}>
                {characters.map(char => (
                  <CharacterCard
                    key={char.id}
                    char={char}
                    avatar={avatars.find(a => a.id === char.avatarId)}
                    onOpen={() => setSelectedId(char.id)}
                    onDelete={() => handleDelete(char.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Character Card ────────────────────────────────────────────────────────────

interface CardProps {
  char: Character;
  avatar?: AvatarEntry;
  onOpen: () => void;
  onDelete: () => void;
}

function CharacterCard({ char, avatar, onOpen, onDelete }: CardProps) {
  const hpPercent = Math.max(0, Math.min(100, (char.hpCurrent / Math.max(1, char.hpMax)) * 100));
  const hpColor = hpPercent > 50 ? 'var(--green-light)' : hpPercent > 25 ? '#c9a84c' : 'var(--red-light)';

  const initials = (char.name || '?').slice(0, 2).toUpperCase();
  const subtitle = [char.race, char.class].filter(Boolean).join(' · ') || 'Sem classe';

  // Top 3 modifiers for quick view
  const mods = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => ({
    ab, mod: abilityMod(char.abilities[ab]),
  })).sort((a, b) => b.mod - a.mod).slice(0, 3);

  return (
    <div className={styles.card} onClick={onOpen}>
      <div className={styles.cardAvatarWrap}>
        {avatar
          ? <img src={avatar.dataUrl} alt={char.name} className={styles.cardAvatar} />
          : <div className={styles.cardInitials}>{initials}</div>}
        <button
          className={styles.cardDelete}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Excluir personagem"
        >
          ✕
        </button>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardName}>{char.name || 'Sem nome'}</div>
        <div className={styles.cardSub}>{subtitle}</div>
        {char.level > 0 && (
          <div className={styles.cardLevel}>Nível {char.level}</div>
        )}
        {char.playerName && (
          <div className={styles.cardPlayer}>👤 {char.playerName}</div>
        )}

        {/* HP bar */}
        <div className={styles.cardHp}>
          <span className={styles.cardHpText} style={{ color: hpColor }}>
            {char.hpCurrent}/{char.hpMax} HP
          </span>
          <div className={styles.cardHpTrack}>
            <div className={styles.cardHpFill} style={{ width: `${hpPercent}%`, background: hpColor }} />
          </div>
        </div>

        {/* Active conditions */}
        {char.conditions.length > 0 && (
          <div className={styles.cardConditions}>
            {char.conditions.slice(0, 3).map(c => (
              <span key={c} className={styles.cardConditionBadge}>{c}</span>
            ))}
            {char.conditions.length > 3 && (
              <span className={styles.cardConditionBadge}>+{char.conditions.length - 3}</span>
            )}
          </div>
        )}

        {/* Quick mods */}
        <div className={styles.cardMods}>
          {mods.map(({ ab, mod }) => (
            <div key={ab} className={styles.cardMod}>
              <span className={styles.cardModVal}>{mod >= 0 ? `+${mod}` : mod}</span>
              <span className={styles.cardModLabel}>{ab.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
