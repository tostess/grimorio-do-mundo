import { useState, useEffect } from 'react';
import { useSessionStore } from '../../../store/sessionContext';
import { useWorldStore } from '../../../store/worldContext';
import { loadCharactersDB, upsertCharacterDB } from '../../../utils/storageDB';
import { loadAvatars, type AvatarEntry } from '../../../utils/avatarStorage';
import { buildSessionUrl, generateQRDataUrl } from '../../../net/qr';
import type { AssignedCharacter, InitiativeEntry } from '../../../types/session';
import type { Character, Condition5e } from '../../../types/character';
import { CONDITIONS, CONDITION_LABELS } from '../../../types/character';
import type { SessionMessage } from '../../../net/protocol';
import { AudioMixer } from '../AudioMixer/AudioMixer';
import { BattleMapView } from '../BattleMap/BattleMapView';
import styles from './MasterDashboard.module.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function toAssignedCharacter(char: Character, avatars: AvatarEntry[]): AssignedCharacter {
  const avatar = char.avatarId ? avatars.find(a => a.id === char.avatarId) : undefined;
  return {
    id: char.id,
    playerName: char.playerName,
    avatarId: char.avatarId,
    avatarDataUrl: avatar?.dataUrl,
    name: char.name,
    race: char.race,
    class: char.class,
    subclass: char.subclass,
    level: char.level,
    hpCurrent: char.hpCurrent,
    hpMax: char.hpMax,
    hpTemp: char.hpTemp,
    armorClass: char.armorClass,
    initiative: char.initiative,
    speed: char.speed,
    conditions: char.conditions,
    attacks: char.attacks,
    spells: char.spells.map(spell => ({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      school: spell.school,
      prepared: spell.prepared,
      description: spell.description,
    })),
    classResources: char.classResources,
  };
}

function CharacterPortrait({
  name,
  avatarDataUrl,
  size = 'md',
}: {
  name: string;
  avatarDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className={`${styles.portrait} ${styles[`portrait_${size}`]}`}>
      {avatarDataUrl
        ? <img src={avatarDataUrl} alt={name} className={styles.portraitImg} />
        : <span>{initials(name)}</span>}
    </div>
  );
}

// ── HP Bar ────────────────────────────────────────────────────────────────────

function HpBar({ hp, hpMax }: { hp: number; hpMax: number }) {
  const pct = hpMax > 0 ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0;
  const color = pct > 50 ? 'var(--green-light)' : pct > 25 ? '#c9a84c' : 'var(--red-light)';
  return (
    <div className={styles.hpBar}>
      <div className={styles.hpFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Dice Roller (shared) ──────────────────────────────────────────────────────

function DiceRoller() {
  const { rollDice } = useSessionStore();
  const [notation, setNotation] = useState('');
  const [lastResult, setLastResult] = useState<{ total: number; breakdown: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  function handleRoll(n: string) {
    const r = rollDice(n);
    if (r) { setLastResult({ total: r.total, breakdown: r.breakdown }); setInvalid(false); }
    else setInvalid(true);
  }

  return (
    <div className={styles.diceRoller}>
      <div className={styles.quickDice}>
        {QUICK.map(d => (
          <button key={d} className={`btn btn-sm ${styles.dieBadge}`}
            onClick={() => { setNotation(d); handleRoll(d); }}>{d}</button>
        ))}
      </div>
      <form className={styles.diceForm} onSubmit={e => { e.preventDefault(); if (notation.trim()) handleRoll(notation.trim()); }}>
        <input
          className={`${styles.diceInput} ${invalid ? styles.diceInputError : ''}`}
          value={notation}
          onChange={e => { setNotation(e.target.value); setInvalid(false); }}
          placeholder="2d6+3"
        />
        <button className="btn btn-sm btn-primary" type="submit">🎲</button>
      </form>
      {lastResult && (
        <div className={styles.diceResult}>
          <span className={styles.diceTotal}>{lastResult.total}</span>
          <span className={styles.diceBreak}>{lastResult.breakdown}</span>
        </div>
      )}
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────────

function LogPanel() {
  const { session, broadcastFromHost, sendMessage } = useSessionStore();
  const [chatInput, setChatInput] = useState('');

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg: SessionMessage = {
      type: 'CHAT_MESSAGE',
      peerId: session.myPeerId ?? 'host',
      playerName: 'Mestre',
      text: chatInput.trim(),
    };
    broadcastFromHost(msg);
    sendMessage(msg);
    setChatInput('');
  }

  return (
    <div className={styles.logPanel}>
      <h3 className={styles.panelTitle}>Log da Sessão</h3>
      <div className={styles.logList}>
        {session.log.length === 0 ? (
          <p className={styles.empty}>Nenhuma atividade ainda.</p>
        ) : (
          [...session.log].reverse().map(entry => (
            <div key={entry.id} className={`${styles.logEntry} ${styles[`log_${entry.type}`]}`}>
              <span className={styles.logTime}>
                {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={styles.logText}>{entry.text}</span>
            </div>
          ))
        )}
      </div>
      <div className={styles.diceSection}>
        <DiceRoller />
      </div>
      <form className={styles.chatForm} onSubmit={sendChat}>
        <input
          className={styles.chatInput}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Mensagem do mestre..."
        />
        <button className="btn btn-sm" type="submit">Enviar</button>
      </form>
    </div>
  );
}

// ── Peers Panel ───────────────────────────────────────────────────────────────

function PeersPanel({ characters, avatars }: { characters: Character[]; avatars: AvatarEntry[] }) {
  const { session, applyHp, applyConditions, assignCharacter } = useSessionStore();
  const [dmgTarget, setDmgTarget] = useState<string | null>(null);
  const [dmgValue, setDmgValue] = useState('');
  const [condTarget, setCondTarget] = useState<string | null>(null);

  function getEntry(peerId: string): InitiativeEntry | undefined {
    return session.combat.entries.find(e => e.peerId === peerId);
  }

  function handleDmgHeal(entryId: string, isDamage: boolean) {
    const entry = session.combat.entries.find(e => e.id === entryId);
    if (!entry) return;
    const delta = parseInt(dmgValue, 10);
    if (isNaN(delta) || delta <= 0) return;
    const newHp = isDamage
      ? Math.max(0, entry.hp - delta)
      : Math.min(entry.hpMax, entry.hp + delta);
    applyHp(entryId, newHp);
    setDmgTarget(null);
    setDmgValue('');
  }

  const hasCombat = session.combat.active;

  return (
    <div className={styles.peersPanel}>
      <h3 className={styles.panelTitle}>
        Jogadores <span className={styles.peerCount}>({session.peers.length}/6)</span>
      </h3>

      {session.peers.length === 0 ? (
        <p className={styles.empty}>Aguardando jogadores...</p>
      ) : (
        <div className={styles.peerCards}>
          {session.peers.map(peer => {
            const entry = getEntry(peer.peerId);
            const char = peer.characterId
              ? characters.find(c => c.id === peer.characterId)
              : characters.find(c => c.playerName.toLowerCase() === peer.playerName.toLowerCase());
            const assigned = session.assignedCharacters[peer.peerId];
            const avatar = char?.avatarId ? avatars.find(a => a.id === char.avatarId) : undefined;

            return (
              <div key={peer.peerId} className={`${styles.peerCard} ${!peer.connected ? styles.peerDisconnected : ''}`}>
                <div className={styles.peerCardHead}>
                  <CharacterPortrait
                    name={char?.name ?? assigned?.name ?? peer.playerName}
                    avatarDataUrl={avatar?.dataUrl ?? assigned?.avatarDataUrl}
                    size="md"
                  />
                  <span className={styles.peerDot} />
                  <span className={styles.peerCardName}>{peer.playerName}</span>
                  {entry && <span className={styles.acBadge}>CA {entry.ac}</span>}
                  {char && !entry && (
                    <span className={styles.charHint}>{char.name} - lv{char.level}</span>
                  )}
                </div>

                <label className={styles.assignRow}>
                  <span>Ficha</span>
                  <select
                    className={styles.charSelect}
                    value={peer.characterId ?? ''}
                    onChange={e => {
                      const nextId = e.target.value || null;
                      const nextChar = nextId ? characters.find(c => c.id === nextId) ?? null : null;
                      assignCharacter(peer.peerId, nextId, nextChar ? toAssignedCharacter(nextChar, avatars) : null);
                    }}
                  >
                    <option value="">Sem ficha vinculada</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.playerName || 'sem jogador'})
                      </option>
                    ))}
                  </select>
                </label>

                {hasCombat && entry ? (
                  <>
                    <div className={styles.hpRow}>
                      <HpBar hp={entry.hp} hpMax={entry.hpMax} />
                      <span className={styles.hpText}>{entry.hp}/{entry.hpMax}</span>
                    </div>

                    {entry.conditions.length > 0 && (
                      <div className={styles.condBadges}>
                        {entry.conditions.map(c => (
                          <span key={c} className={styles.condBadge}>
                            {CONDITION_LABELS[c as keyof typeof CONDITION_LABELS] ?? c}
                          </span>
                        ))}
                      </div>
                    )}

                    {dmgTarget === entry.id ? (
                      <div className={styles.dmgForm}>
                        <input
                          className={styles.dmgInput}
                          type="number"
                          min="1"
                          value={dmgValue}
                          onChange={e => setDmgValue(e.target.value)}
                          placeholder="valor"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Escape') { setDmgTarget(null); setDmgValue(''); } }}
                        />
                        <button className={`btn btn-sm ${styles.btnDmg}`} onClick={() => handleDmgHeal(entry.id, true)}>Dano</button>
                        <button className={`btn btn-sm ${styles.btnHeal}`} onClick={() => handleDmgHeal(entry.id, false)}>Cura</button>
                        <button className="btn btn-sm" onClick={() => { setDmgTarget(null); setDmgValue(''); }}>✕</button>
                      </div>
                    ) : (
                      <div className={styles.peerActions}>
                        <button className="btn btn-sm" onClick={() => { setDmgTarget(entry.id); setCondTarget(null); }}>
                          ⚔️ HP
                        </button>
                        <button
                          className={`btn btn-sm ${condTarget === entry.id ? styles.btnCondActive : ''}`}
                          onClick={() => { setCondTarget(condTarget === entry.id ? null : entry.id); setDmgTarget(null); }}
                        >
                          🔮 Cond.
                        </button>
                      </div>
                    )}

                    {condTarget === entry.id && (
                      <div className={styles.condGrid}>
                        {CONDITIONS.map(c => (
                          <button
                            key={c}
                            className={`${styles.condToggle} ${entry.conditions.includes(c) ? styles.condToggleActive : ''}`}
                            onClick={() => {
                              const next = entry.conditions.includes(c)
                                ? entry.conditions.filter(x => x !== c)
                                : [...entry.conditions, c];
                              applyConditions(entry.id, next);
                            }}
                          >
                            {CONDITION_LABELS[c]}
                          </button>
                        ))}
                        <button className="btn btn-sm" style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}
                          onClick={() => setCondTarget(null)}>
                          Fechar
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  !hasCombat && char && (
                    <div className={styles.charSummary}>
                      <span className={styles.charClass}>{char.class} {char.level}</span>
                      <span className={styles.charHpSmall}>HP {char.hpCurrent}/{char.hpMax}</span>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Initiative Tracker ────────────────────────────────────────────────────────

interface SetupRow {
  id: string;
  name: string;
  initiative: string;
  hp: string;
  hpMax: string;
  ac: string;
  isNPC: boolean;
  peerId?: string;
  characterId?: string;
}

function InitiativeTracker({
  characters,
  avatars,
  onEndCombat,
}: {
  characters: Character[];
  avatars: AvatarEntry[];
  onEndCombat: () => void;
}) {
  const { session, startCombat, advanceTurn, applyHp } = useSessionStore();
  const [showSetup, setShowSetup] = useState(false);
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [showAddNpc, setShowAddNpc] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcHp, setNpcHp] = useState('10');
  const [npcAc, setNpcAc] = useState('10');
  const [npcIni, setNpcIni] = useState('');
  const [inlineTarget, setInlineTarget] = useState<string | null>(null);
  const [inlineDmg, setInlineDmg] = useState('');

  const { combat, peers } = session;

  function openSetup() {
    const initial: SetupRow[] = peers.map(peer => {
      const char = peer.characterId
        ? characters.find(c => c.id === peer.characterId)
        : characters.find(c => c.playerName.toLowerCase() === peer.playerName.toLowerCase());
      return {
        id: peer.peerId,
        name: peer.playerName,
        initiative: '',
        hp: char ? String(char.hpCurrent) : '10',
        hpMax: char ? String(char.hpMax) : '10',
        ac: char ? String(char.armorClass) : '10',
        isNPC: false,
        peerId: peer.peerId,
        characterId: char?.id,
      };
    });
    setRows(initial);
    setShowSetup(true);
    setShowAddNpc(false);
  }

  function addNpc() {
    if (!npcName.trim()) return;
    const id = 'npc_' + Date.now().toString(36);
    setRows(prev => [...prev, {
      id,
      name: npcName.trim(),
      initiative: npcIni,
      hp: npcHp,
      hpMax: npcHp,
      ac: npcAc,
      isNPC: true,
    }]);
    setNpcName(''); setNpcHp('10'); setNpcAc('10'); setNpcIni('');
    setShowAddNpc(false);
  }

  function updateRow(i: number, patch: Partial<SetupRow>) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  }

  function handleStart() {
    const entries: InitiativeEntry[] = rows
      .filter(r => r.name.trim())
      .map(r => ({
        id: r.id,
        name: r.name.trim(),
        initiative: parseInt(r.initiative, 10) || 0,
        hp: parseInt(r.hp, 10) || 10,
        hpMax: parseInt(r.hpMax, 10) || parseInt(r.hp, 10) || 10,
        ac: parseInt(r.ac, 10) || 10,
        isNPC: r.isNPC,
        peerId: r.peerId,
        characterId: r.characterId,
        conditions: [],
      }));
    startCombat(entries);
    setShowSetup(false);
  }

  function handleInlineDmgHeal(entryId: string, isDamage: boolean) {
    const entry = combat.entries.find(e => e.id === entryId);
    if (!entry) return;
    const delta = parseInt(inlineDmg, 10);
    if (isNaN(delta) || delta <= 0) return;
    const newHp = isDamage ? Math.max(0, entry.hp - delta) : Math.min(entry.hpMax, entry.hp + delta);
    applyHp(entryId, newHp);
    setInlineTarget(null);
    setInlineDmg('');
  }

  // ── Setup Form ────────────────────────────────────────────────────────────

  if (showSetup) {
    return (
      <div className={styles.initiativePanel}>
        <div className={styles.setupHeader}>
          <h3 className={styles.panelTitle}>⚔️ Configurar Combate</h3>
        </div>

        <div className={styles.setupLabels}>
          <span className={styles.setupLabelName}>Nome</span>
          <span className={styles.setupLabelNum}>Ini</span>
          <span className={styles.setupLabelNum}>HP</span>
          <span className={styles.setupLabelNum}>Max</span>
          <span className={styles.setupLabelNum}>CA</span>
        </div>

        <div className={styles.setupRows}>
          {rows.map((row, i) => (
            <div key={row.id} className={`${styles.setupRow} ${row.isNPC ? styles.setupRowNpc : ''}`}>
              <input
                className={styles.setupName}
                value={row.name}
                onChange={e => updateRow(i, { name: e.target.value })}
                placeholder="Nome"
              />
              <input className={styles.setupNum} type="number" value={row.initiative}
                onChange={e => updateRow(i, { initiative: e.target.value })} placeholder="—" title="Iniciativa" />
              <input className={styles.setupNum} type="number" value={row.hp}
                onChange={e => updateRow(i, { hp: e.target.value })} placeholder="HP" title="HP Atual" />
              <input className={styles.setupNum} type="number" value={row.hpMax}
                onChange={e => updateRow(i, { hpMax: e.target.value })} placeholder="Max" title="HP Máximo" />
              <input className={styles.setupNum} type="number" value={row.ac}
                onChange={e => updateRow(i, { ac: e.target.value })} placeholder="CA" title="Classe de Armadura" />
              {row.isNPC && (
                <button className={`btn btn-sm ${styles.removeBtn}`}
                  onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
        </div>

        {showAddNpc ? (
          <div className={styles.addNpcForm}>
            <input className={styles.setupName} value={npcName} onChange={e => setNpcName(e.target.value)}
              placeholder="Nome do NPC" autoFocus />
            <input className={styles.setupNum} type="number" value={npcIni}
              onChange={e => setNpcIni(e.target.value)} placeholder="Ini" title="Iniciativa" />
            <input className={styles.setupNum} type="number" value={npcHp}
              onChange={e => setNpcHp(e.target.value)} placeholder="HP" />
            <input className={styles.setupNum} type="number" value={npcAc}
              onChange={e => setNpcAc(e.target.value)} placeholder="CA" />
            <button className="btn btn-sm btn-primary" onClick={addNpc}>Add</button>
            <button className="btn btn-sm" onClick={() => setShowAddNpc(false)}>✕</button>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
            onClick={() => setShowAddNpc(true)}>+ NPC</button>
        )}

        <div className={styles.setupFooter}>
          <button className="btn btn-sm" onClick={() => setShowSetup(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleStart} disabled={rows.length === 0}>
            ⚔️ Iniciar Combate
          </button>
        </div>
      </div>
    );
  }

  // ── No Combat ────────────────────────────────────────────────────────────

  if (!combat.active) {
    return (
      <div className={styles.initiativePanel}>
        <h3 className={styles.panelTitle}>⚔️ Iniciativa</h3>
        <p className={styles.empty}>Nenhum combate ativo.</p>
        <button className="btn btn-primary" onClick={openSetup}>
          ⚔️ Iniciar Combate
        </button>
      </div>
    );
  }

  // ── Active Combat ────────────────────────────────────────────────────────

  const currentEntry = combat.entries[combat.currentTurnIndex];

  return (
    <div className={styles.initiativePanel}>
      <div className={styles.combatHeader}>
        <h3 className={styles.panelTitle}>⚔️ Round {combat.round}</h3>
        <div className={styles.combatActions}>
          <button className="btn btn-primary btn-sm" onClick={advanceTurn}>
            Próximo →
          </button>
          <button className="btn btn-sm btn-danger" onClick={onEndCombat}>
            Encerrar
          </button>
        </div>
      </div>

      {currentEntry && (
        <div className={styles.currentTurnBanner}>
          Turno de <strong>{currentEntry.name}</strong>
        </div>
      )}

      <div className={styles.entryList}>
        {combat.entries.map((entry, idx) => {
          const isActive = idx === combat.currentTurnIndex;
          const entryChar = entry.characterId ? characters.find(c => c.id === entry.characterId) : undefined;
          const entryAvatar = entryChar?.avatarId ? avatars.find(a => a.id === entryChar.avatarId) : undefined;
          return (
            <div key={entry.id} className={`${styles.entryRow} ${isActive ? styles.entryActive : ''}`}>
              <span className={styles.entryIni}>{entry.initiative}</span>
              <CharacterPortrait
                name={entry.name}
                avatarDataUrl={entryAvatar?.dataUrl}
                size="sm"
              />
              <div className={styles.entryInfo}>
                <div className={styles.entryNameRow}>
                  <span className={styles.entryName}>{entry.name}</span>
                  {entry.isNPC && <span className={styles.npcBadge}>NPC</span>}
                  {isActive && <span className={styles.activeTick}>●</span>}
                </div>
                {entry.conditions.length > 0 && (
                  <div className={styles.entryConditions}>
                    {entry.conditions.map(c => (
                      <span key={c} className={styles.miniCondBadge}>
                        {CONDITION_LABELS[c as keyof typeof CONDITION_LABELS]?.slice(0, 4) ?? c.slice(0, 4)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.entryHpCol}>
                <HpBar hp={entry.hp} hpMax={entry.hpMax} />
                <span className={styles.entryHpText}>{entry.hp}/{entry.hpMax}</span>
              </div>
              <span className={styles.entryAc}>CA {entry.ac}</span>

              {inlineTarget === entry.id ? (
                <div className={styles.inlineDmg}>
                  <input
                    className={styles.inlineDmgInput}
                    type="number" min="1" value={inlineDmg}
                    onChange={e => setInlineDmg(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') { setInlineTarget(null); setInlineDmg(''); } }}
                  />
                  <button className={`btn btn-sm ${styles.btnDmg}`} onClick={() => handleInlineDmgHeal(entry.id, true)}>D</button>
                  <button className={`btn btn-sm ${styles.btnHeal}`} onClick={() => handleInlineDmgHeal(entry.id, false)}>C</button>
                  <button className="btn btn-sm" onClick={() => { setInlineTarget(null); setInlineDmg(''); }}>✕</button>
                </div>
              ) : (
                <button
                  className={`btn btn-sm ${styles.entryHpBtn}`}
                  onClick={() => { setInlineTarget(entry.id); setInlineDmg(''); }}
                  title="Aplicar dano ou cura"
                >±</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick add NPC mid-combat */}
      {showAddNpc ? (
        <div className={styles.addNpcForm}>
          <input className={styles.setupName} value={npcName} onChange={e => setNpcName(e.target.value)}
            placeholder="Nome do NPC" autoFocus />
          <input className={styles.setupNum} type="number" value={npcIni}
            onChange={e => setNpcIni(e.target.value)} placeholder="Ini" />
          <input className={styles.setupNum} type="number" value={npcHp}
            onChange={e => setNpcHp(e.target.value)} placeholder="HP" />
          <input className={styles.setupNum} type="number" value={npcAc}
            onChange={e => setNpcAc(e.target.value)} placeholder="CA" />
          <button className="btn btn-sm btn-primary" onClick={() => {
            if (!npcName.trim()) return;
            const entries = [...combat.entries, {
              id: 'npc_' + Date.now().toString(36),
              name: npcName.trim(),
              initiative: parseInt(npcIni, 10) || 0,
              hp: parseInt(npcHp, 10) || 10,
              hpMax: parseInt(npcHp, 10) || 10,
              ac: parseInt(npcAc, 10) || 10,
              isNPC: true,
              conditions: [],
            }].sort((a, b) => b.initiative - a.initiative);
            startCombat(entries);
            setNpcName(''); setNpcHp('10'); setNpcAc('10'); setNpcIni('');
            setShowAddNpc(false);
          }}>Add</button>
          <button className="btn btn-sm" onClick={() => setShowAddNpc(false)}>✕</button>
        </div>
      ) : (
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
          onClick={() => setShowAddNpc(true)}>+ NPC</button>
      )}
    </div>
  );
}

// ── Connection Bar ────────────────────────────────────────────────────────────

function ConnectionBar({
  onClose, showAudio, onToggleAudio, showBattle, onToggleBattle,
}: {
  onClose: () => void;
  showAudio: boolean;
  onToggleAudio: () => void;
  showBattle: boolean;
  onToggleBattle: () => void;
}) {
  const { session } = useSessionStore();
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = session.myPeerId ?? '';
  const sessionUrl = buildSessionUrl(code);

  useEffect(() => {
    if (!code || !showQr) return;
    generateQRDataUrl(code).then(setQrUrl).catch(console.warn);
  }, [code, showQr]);

  function copyLink() {
    navigator.clipboard.writeText(sessionUrl).catch(() => {
      const el = document.createElement('textarea');
      el.value = sessionUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.connectionBar}>
      <div className={styles.codeCompact}>
        <span className={styles.codeLabel}>Código</span>
        <span className={styles.codeValue}>{code.toUpperCase()}</span>
      </div>
      <button className="btn btn-sm" onClick={copyLink}>{copied ? '✓ Copiado' : '🔗 Link'}</button>
      <button className="btn btn-sm" onClick={() => setShowQr(s => !s)}>QR</button>
      <div className={styles.barSpacer} />
      <span className={styles.peerCountBar}>{session.peers.length}/6 jogadores</span>
      <button
        className={`btn btn-sm ${showAudio ? styles.btnAudioActive : ''}`}
        onClick={onToggleAudio}
        title="Mesa de Som"
      >
        🎵
      </button>
      <button
        className={`btn btn-sm ${showBattle ? styles.btnAudioActive : ''}`}
        onClick={onToggleBattle}
        title="Grid de Batalha"
      >
        ⚔️🗺️
      </button>
      <button className="btn btn-sm btn-danger" onClick={onClose}>Encerrar Sessão</button>

      {showQr && (
        <div className={styles.qrPopover}>
          {qrUrl
            ? <img src={qrUrl} alt="QR da sessão" className={styles.qrImg} />
            : <div className={styles.qrLoading}>Gerando QR...</div>
          }
          <p className={styles.qrHint}>
            Link: <a href={sessionUrl} target="_blank" rel="noreferrer" className={styles.qrLink}>{sessionUrl}</a>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function MasterDashboard({ onClose }: { onClose: () => void }) {
  const { activeWorldId } = useWorldStore();
  const { session, endCombat } = useSessionStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [avatars, setAvatars] = useState<AvatarEntry[]>([]);
  const [showAudio, setShowAudio] = useState(false);
  const [showBattle, setShowBattle] = useState(false);

  useEffect(() => {
    if (!activeWorldId) return;
    loadCharactersDB(activeWorldId).then(setCharacters).catch(console.warn);
    loadAvatars().then(setAvatars).catch(console.warn);
  }, [activeWorldId]);

  function handleEndCombat() {
    const updates = session.combat.entries
      .filter(entry => entry.characterId)
      .map(entry => {
        const char = characters.find(c => c.id === entry.characterId);
        if (!char) return null;
        return {
          ...char,
          hpCurrent: Math.max(0, Math.min(entry.hpMax, entry.hp)),
          conditions: entry.conditions as Condition5e[],
          updatedAt: new Date().toISOString(),
        };
      })
      .filter((char): char is Character => Boolean(char));

    setCharacters(prev => prev.map(char => updates.find(u => u.id === char.id) ?? char));
    Promise.all(updates.map(upsertCharacterDB)).catch(console.warn);
    endCombat();
  }

  return (
    <div className={styles.dashboard}>
      <ConnectionBar
        onClose={onClose}
        showAudio={showAudio}
        onToggleAudio={() => setShowAudio(s => !s)}
        showBattle={showBattle}
        onToggleBattle={() => setShowBattle(s => !s)}
      />
      {showAudio && <AudioMixer />}
      {showBattle ? (
        <BattleMapView />
      ) : (
        <div className={styles.panels}>
          <PeersPanel characters={characters} avatars={avatars} />
          <InitiativeTracker characters={characters} avatars={avatars} onEndCombat={handleEndCombat} />
          <LogPanel />
        </div>
      )}
    </div>
  );
}
