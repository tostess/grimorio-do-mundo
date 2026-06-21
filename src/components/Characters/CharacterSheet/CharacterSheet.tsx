import { useState, useEffect } from 'react';
import {
  ABILITIES, ABILITY_LABELS, ABILITY_SHORT,
  SKILL_LIST, CONDITIONS, CONDITION_LABELS,
  SPELL_SCHOOLS,
  abilityMod, skillMod, savingThrowMod, formatMod, profBonus,
  type Character, type Attack, type Spell, type ClassResource,
  type Ability5e, type Condition5e, type SpellSlotLevel,
} from '../../../types/character';
import { rollDice, rollModifier, type DiceResult } from '../../../utils/dice';
import { loadAvatars, type AvatarEntry } from '../../../utils/avatarStorage';
import styles from './CharacterSheet.module.css';

type SheetTab = 'basico' | 'combate' | 'pericias' | 'magias' | 'recursos' | 'notas';

const SHEET_TABS: { id: SheetTab; label: string; icon: string }[] = [
  { id: 'basico',    label: 'Básico',    icon: '👤' },
  { id: 'combate',   label: 'Combate',   icon: '⚔️' },
  { id: 'pericias',  label: 'Perícias',  icon: '🎯' },
  { id: 'magias',    label: 'Magias',    icon: '✨' },
  { id: 'recursos',  label: 'Recursos',  icon: '⚡' },
  { id: 'notas',     label: 'Notas',     icon: '📝' },
];

const ALIGNMENTS = [
  'Leal e Bom', 'Neutro e Bom', 'Caótico e Bom',
  'Leal e Neutro', 'Neutro', 'Caótico e Neutro',
  'Leal e Mau', 'Neutro e Mau', 'Caótico e Mau',
];

interface Props {
  character: Character;
  onChange: (char: Character) => void;
  onBack: () => void;
}

export function CharacterSheet({ character: char, onChange, onBack }: Props) {
  const [tab, setTab] = useState<SheetTab>('basico');
  const [diceInput, setDiceInput] = useState('');
  const [diceResult, setDiceResult] = useState<DiceResult | null>(null);

  function update(patch: Partial<Character>) {
    onChange({ ...char, ...patch, updatedAt: new Date().toISOString() });
  }

  function roll(notation?: string) {
    const n = (notation ?? diceInput).trim();
    if (!n) return;
    try {
      setDiceResult(rollDice(n));
      if (!notation) setDiceInput('');
    } catch { /* invalid notation */ }
  }

  const hpPercent = Math.max(0, Math.min(100, (char.hpCurrent / Math.max(1, char.hpMax)) * 100));
  const hpColor = hpPercent > 50 ? 'var(--green-light)' : hpPercent > 25 ? '#c9a84c' : 'var(--red-light)';

  return (
    <div className={styles.sheet}>
      {/* ── Header ── */}
      <div className={styles.sheetHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Personagens</button>
        <div className={styles.sheetIdentity}>
          <span className={styles.sheetName}>{char.name || 'Sem nome'}</span>
          <span className={styles.sheetSub}>
            {[char.race, char.class, char.subclass].filter(Boolean).join(' · ')}
            {char.level ? ` · Nível ${char.level}` : ''}
          </span>
        </div>
        <div className={styles.sheetHpBar}>
          <span className={styles.sheetHpText} style={{ color: hpColor }}>
            {char.hpCurrent}/{char.hpMax} HP
          </span>
          <div className={styles.sheetHpTrack}>
            <div className={styles.sheetHpFill} style={{ width: `${hpPercent}%`, background: hpColor }} />
          </div>
        </div>
      </div>

      {/* ── Dice roller strip ── */}
      <div className={styles.diceStrip}>
        <input
          className={styles.diceInput}
          value={diceInput}
          onChange={e => setDiceInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && roll()}
          placeholder="1d20+5, 4d6kh3…"
        />
        <button className={styles.diceBtn} onClick={() => roll()}>🎲 Rolar</button>
        {diceResult && (
          <span className={styles.diceResult}>
            <strong>{diceResult.total}</strong>
            <span className={styles.diceBreakdown}>{diceResult.breakdown}</span>
          </span>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {SHEET_TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={styles.tabIcon}>{t.icon}</span>
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>
        {tab === 'basico'   && <TabBasico char={char} update={update} />}
        {tab === 'combate'  && <TabCombate char={char} update={update} roll={roll} />}
        {tab === 'pericias' && <TabPericias char={char} update={update} roll={roll} />}
        {tab === 'magias'   && <TabMagias char={char} update={update} />}
        {tab === 'recursos' && <TabRecursos char={char} update={update} />}
        {tab === 'notas'    && <TabNotas char={char} update={update} />}
      </div>
    </div>
  );
}

// ── TabBasico ─────────────────────────────────────────────────────────────────

function AvatarPicker({ avatarId, onPick }: { avatarId?: string; onPick: (id: string | undefined) => void }) {
  const [avatars, setAvatars] = useState<AvatarEntry[]>([]);
  const [open, setOpen] = useState(false);
  const current = avatars.find(a => a.id === avatarId);

  useEffect(() => { loadAvatars().then(setAvatars); }, []);

  return (
    <div className={styles.avatarPicker}>
      <div className={styles.avatarPreview} onClick={() => setOpen(o => !o)}>
        {current
          ? <img src={current.dataUrl} alt={current.name} className={styles.avatarImg} />
          : <span className={styles.avatarInitial}>👤</span>}
        <span className={styles.avatarChangeHint}>Trocar</span>
      </div>
      {open && (
        <div className={styles.avatarDropdown}>
          <div className={styles.avatarGrid}>
            {avatars.map(a => (
              <div
                key={a.id}
                className={`${styles.avatarOption} ${a.id === avatarId ? styles.avatarSelected : ''}`}
                onClick={() => { onPick(a.id); setOpen(false); }}
              >
                <img src={a.dataUrl} alt={a.name} />
              </div>
            ))}
            {avatarId && (
              <div className={styles.avatarOption} onClick={() => { onPick(undefined); setOpen(false); }}>
                <span className={styles.avatarRemove}>✕</span>
              </div>
            )}
            {avatars.length === 0 && (
              <p className={styles.avatarEmpty}>Adicione avatares na aba Avatares.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBasico({ char, update }: { char: Character; update: (p: Partial<Character>) => void }) {
  return (
    <div className={styles.tabBody}>
      <div className={styles.basicTop}>
        <AvatarPicker avatarId={char.avatarId} onPick={id => update({ avatarId: id })} />
        <div className={styles.basicNames}>
          <label className={styles.fieldLabel}>Nome do Personagem</label>
          <input className={styles.fieldInput} value={char.name}
            onChange={e => update({ name: e.target.value })} />
          <label className={styles.fieldLabel}>Jogador</label>
          <input className={styles.fieldInput} value={char.playerName}
            onChange={e => update({ playerName: e.target.value })} placeholder="Nome do jogador" />
        </div>
      </div>

      <div className={styles.fieldGrid4}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Raça</label>
          <input className={styles.fieldInput} value={char.race}
            onChange={e => update({ race: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Classe</label>
          <input className={styles.fieldInput} value={char.class}
            onChange={e => update({ class: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Subclasse</label>
          <input className={styles.fieldInput} value={char.subclass}
            onChange={e => update({ subclass: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nível</label>
          <input className={styles.fieldInput} type="number" min={1} max={20}
            value={char.level}
            onChange={e => {
              const lv = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
              update({ level: lv, proficiencyBonus: profBonus(lv) });
            }} />
        </div>
      </div>

      <div className={styles.fieldGrid4}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Background</label>
          <input className={styles.fieldInput} value={char.background}
            onChange={e => update({ background: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Alinhamento</label>
          <select className={styles.fieldInput} value={char.alignment}
            onChange={e => update({ alignment: e.target.value })}>
            <option value="">—</option>
            {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Experiência</label>
          <input className={styles.fieldInput} type="number" min={0}
            value={char.experience}
            onChange={e => update({ experience: Math.max(0, parseInt(e.target.value) || 0) })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Bônus de Proficiência</label>
          <input className={styles.fieldInput} type="number" min={2} max={6}
            value={char.proficiencyBonus}
            onChange={e => update({ proficiencyBonus: Math.max(2, parseInt(e.target.value) || 2) })} />
        </div>
      </div>

      <div className={styles.inspirationRow}>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={char.inspiration}
            onChange={e => update({ inspiration: e.target.checked })} />
          ✨ Inspiração
        </label>
      </div>
    </div>
  );
}

// ── TabCombate ────────────────────────────────────────────────────────────────

function TabCombate({ char, update, roll }: {
  char: Character;
  update: (p: Partial<Character>) => void;
  roll: (n: string) => void;
}) {
  function adjustHp(delta: number) {
    update({ hpCurrent: Math.max(0, Math.min(char.hpMax + char.hpTemp, char.hpCurrent + delta)) });
  }

  function toggleCondition(c: Condition5e) {
    const has = char.conditions.includes(c);
    update({ conditions: has ? char.conditions.filter(x => x !== c) : [...char.conditions, c] });
  }

  function addAttack() {
    const atk: Attack = {
      id: Date.now().toString(36),
      name: 'Novo Ataque', bonus: '+0', damage: '1d6', damageType: '', range: '', notes: '',
    };
    update({ attacks: [...char.attacks, atk] });
  }

  function updateAttack(id: string, patch: Partial<Attack>) {
    update({ attacks: char.attacks.map(a => a.id === id ? { ...a, ...patch } : a) });
  }

  function removeAttack(id: string) {
    update({ attacks: char.attacks.filter(a => a.id !== id) });
  }

  return (
    <div className={styles.tabBody}>
      {/* HP section */}
      <div className={styles.hpSection}>
        <div className={styles.hpBlock}>
          <label className={styles.fieldLabel}>HP Atual</label>
          <input className={`${styles.fieldInput} ${styles.hpInput}`} type="number" min={0}
            value={char.hpCurrent}
            onChange={e => update({ hpCurrent: Math.max(0, parseInt(e.target.value) || 0) })} />
          <div className={styles.hpBtns}>
            {[-10, -5, -1, +1, +5, +10].map(d => (
              <button key={d} className={`${styles.hpBtn} ${d < 0 ? styles.hpBtnDmg : styles.hpBtnHeal}`}
                onClick={() => adjustHp(d)}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.hpBlock}>
          <label className={styles.fieldLabel}>HP Máximo</label>
          <input className={styles.fieldInput} type="number" min={1}
            value={char.hpMax}
            onChange={e => update({ hpMax: Math.max(1, parseInt(e.target.value) || 1) })} />
        </div>
        <div className={styles.hpBlock}>
          <label className={styles.fieldLabel}>HP Temporário</label>
          <input className={styles.fieldInput} type="number" min={0}
            value={char.hpTemp}
            onChange={e => update({ hpTemp: Math.max(0, parseInt(e.target.value) || 0) })} />
        </div>
      </div>

      {/* Combat stats */}
      <div className={styles.fieldGrid4}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Classe de Armadura</label>
          <input className={styles.fieldInput} type="number"
            value={char.armorClass}
            onChange={e => update({ armorClass: parseInt(e.target.value) || 0 })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Iniciativa</label>
          <div className={styles.rollableField}>
            <input className={styles.fieldInput} type="number"
              value={char.initiative}
              onChange={e => update({ initiative: parseInt(e.target.value) || 0 })} />
            <button className={styles.rollBtn} title="Rolar iniciativa"
              onClick={() => roll(`1d20${char.initiative >= 0 ? '+' : ''}${char.initiative}`)}>🎲</button>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Velocidade (pés)</label>
          <input className={styles.fieldInput} type="number" min={0}
            value={char.speed}
            onChange={e => update({ speed: Math.max(0, parseInt(e.target.value) || 0) })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Proficiência</label>
          <input className={styles.fieldInput} type="number" readOnly value={char.proficiencyBonus} />
        </div>
      </div>

      {/* Death saves */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Salvaguardas da Morte</h4>
        <div className={styles.deathSaves}>
          <div className={styles.dsRow}>
            <span>✅ Sucessos</span>
            {[0, 1, 2].map(i => (
              <input key={i} type="checkbox"
                checked={char.deathSaves.successes > i}
                onChange={e => update({ deathSaves: { ...char.deathSaves, successes: e.target.checked ? i + 1 : i } })} />
            ))}
          </div>
          <div className={styles.dsRow}>
            <span>❌ Falhas</span>
            {[0, 1, 2].map(i => (
              <input key={i} type="checkbox"
                checked={char.deathSaves.failures > i}
                onChange={e => update({ deathSaves: { ...char.deathSaves, failures: e.target.checked ? i + 1 : i } })} />
            ))}
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Condições</h4>
        <div className={styles.conditionGrid}>
          {CONDITIONS.map(c => (
            <label key={c} className={`${styles.conditionChip} ${char.conditions.includes(c) ? styles.conditionActive : ''}`}>
              <input type="checkbox" checked={char.conditions.includes(c)} onChange={() => toggleCondition(c)} />
              {CONDITION_LABELS[c]}
            </label>
          ))}
        </div>
        {char.conditions.includes('exhaustion') && (
          <div className={styles.exhaustionRow}>
            <label className={styles.fieldLabel}>Nível de Exaustão</label>
            <input className={styles.fieldInput} type="number" min={0} max={6}
              value={char.exhaustionLevel}
              onChange={e => update({ exhaustionLevel: Math.max(0, Math.min(6, parseInt(e.target.value) || 0)) })} />
          </div>
        )}
      </div>

      {/* Attacks */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Ataques</h4>
          <button className={styles.addBtn} onClick={addAttack}>+ Adicionar</button>
        </div>
        {char.attacks.length === 0
          ? <p className={styles.empty}>Nenhum ataque cadastrado.</p>
          : (
            <div className={styles.attackTable}>
              <div className={styles.attackHeader}>
                <span>Nome</span><span>Bônus</span><span>Dano</span><span>Tipo</span><span>Alcance</span><span></span>
              </div>
              {char.attacks.map(atk => (
                <div key={atk.id} className={styles.attackRow}>
                  <input className={styles.attackInput} value={atk.name}
                    onChange={e => updateAttack(atk.id, { name: e.target.value })} />
                  <div className={styles.rollableField}>
                    <input className={styles.attackInput} value={atk.bonus}
                      onChange={e => updateAttack(atk.id, { bonus: e.target.value })} />
                    <button className={styles.rollBtn} onClick={() => roll(`1d20${atk.bonus}`)}>🎲</button>
                  </div>
                  <div className={styles.rollableField}>
                    <input className={styles.attackInput} value={atk.damage}
                      onChange={e => updateAttack(atk.id, { damage: e.target.value })} />
                    <button className={styles.rollBtn} onClick={() => roll(atk.damage)}>🎲</button>
                  </div>
                  <input className={styles.attackInput} value={atk.damageType}
                    onChange={e => updateAttack(atk.id, { damageType: e.target.value })} />
                  <input className={styles.attackInput} value={atk.range}
                    onChange={e => updateAttack(atk.id, { range: e.target.value })} />
                  <button className={styles.deleteBtn} onClick={() => removeAttack(atk.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── TabPericias ───────────────────────────────────────────────────────────────

function TabPericias({ char, update, roll }: {
  char: Character;
  update: (p: Partial<Character>) => void;
  roll: (n: string) => void;
}) {
  function toggleSave(ab: Ability5e) {
    update({ savingThrows: { ...char.savingThrows, [ab]: !char.savingThrows[ab] } });
  }

  function toggleProf(id: string) {
    const cur = char.skills[id as keyof typeof char.skills];
    const next = cur.proficient
      ? { proficient: false, expertise: false }
      : { proficient: true, expertise: false };
    update({ skills: { ...char.skills, [id]: next } });
  }

  function toggleExpertise(id: string) {
    const cur = char.skills[id as keyof typeof char.skills];
    if (!cur.proficient) return;
    update({ skills: { ...char.skills, [id]: { ...cur, expertise: !cur.expertise } } });
  }

  return (
    <div className={styles.tabBody}>
      {/* Ability scores */}
      <div className={styles.abilityRow}>
        {ABILITIES.map(ab => {
          const score = char.abilities[ab];
          const mod = abilityMod(score);
          return (
            <div key={ab} className={styles.abilityBox}>
              <span className={styles.abilityLabel}>{ABILITY_SHORT[ab]}</span>
              <button className={styles.abilityMod} onClick={() => roll(rollModifier(mod).notation)}>
                {formatMod(mod)}
              </button>
              <input
                className={styles.abilityScore}
                type="number" min={1} max={30}
                value={score}
                onChange={e => update({ abilities: { ...char.abilities, [ab]: Math.max(1, Math.min(30, parseInt(e.target.value) || 10)) } })}
              />
              <span className={styles.abilityName}>{ABILITY_LABELS[ab]}</span>
            </div>
          );
        })}
      </div>

      {/* Saving throws */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Salvaguardas</h4>
        <div className={styles.saveGrid}>
          {ABILITIES.map(ab => {
            const mod = savingThrowMod(char, ab);
            return (
              <label key={ab} className={styles.saveRow}>
                <input type="checkbox" checked={char.savingThrows[ab]} onChange={() => toggleSave(ab)} />
                <span className={styles.saveVal}>{formatMod(mod)}</span>
                <span>{ABILITY_LABELS[ab]}</span>
                <button className={styles.rollBtnSm} onClick={() => roll(`1d20${mod >= 0 ? '+' : ''}${mod}`)}>🎲</button>
              </label>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Perícias</h4>
        <div className={styles.skillList}>
          {SKILL_LIST.map(sk => {
            const entry = char.skills[sk.id];
            const mod = skillMod(char, sk.id);
            return (
              <div key={sk.id} className={styles.skillRow}>
                <input type="checkbox" title="Proficiência"
                  checked={entry.proficient} onChange={() => toggleProf(sk.id)} />
                <input type="checkbox" title="Expertise (requer proficiência)"
                  checked={entry.expertise} disabled={!entry.proficient}
                  onChange={() => toggleExpertise(sk.id)} />
                <span className={styles.skillMod}>{formatMod(mod)}</span>
                <span className={styles.skillName}>{sk.label}</span>
                <span className={styles.skillAbility}>{ABILITY_SHORT[sk.ability]}</span>
                <button className={styles.rollBtnSm} onClick={() => roll(`1d20${mod >= 0 ? '+' : ''}${mod}`)}>🎲</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TabMagias ─────────────────────────────────────────────────────────────────

function TabMagias({ char, update }: { char: Character; update: (p: Partial<Character>) => void }) {
  function updateSlot(level: SpellSlotLevel, field: 'max' | 'used', val: number) {
    update({
      spellSlots: {
        ...char.spellSlots,
        [level]: { ...char.spellSlots[level], [field]: Math.max(0, val) },
      },
    });
  }

  function addSpell() {
    const sp: Spell = {
      id: Date.now().toString(36),
      name: 'Nova Magia', level: 1, school: 'Evocação',
      castingTime: '1 ação', range: '18m', components: 'V, S',
      duration: 'Instantâneo', concentration: false, ritual: false,
      prepared: true, description: '',
    };
    update({ spells: [...char.spells, sp] });
  }

  function updateSpell(id: string, patch: Partial<Spell>) {
    update({ spells: char.spells.map(s => s.id === id ? { ...s, ...patch } : s) });
  }

  function removeSpell(id: string) {
    update({ spells: char.spells.filter(s => s.id !== id) });
  }

  const spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  const spellsByLevel = spellLevels.map(lv => ({
    lv,
    spells: char.spells.filter(s => s.level === lv),
  })).filter(g => g.lv === 0 || g.spells.length > 0 || (lv => lv >= 1 && lv <= 9 && char.spellSlots[lv as SpellSlotLevel]?.max > 0)(g.lv));

  return (
    <div className={styles.tabBody}>
      {/* Spellcasting info */}
      <div className={styles.fieldGrid4}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Habilidade de Conjuração</label>
          <select className={styles.fieldInput}
            value={char.spellcastingAbility}
            onChange={e => update({ spellcastingAbility: e.target.value as Ability5e | '' })}>
            <option value="">—</option>
            {ABILITIES.map(ab => <option key={ab} value={ab}>{ABILITY_LABELS[ab]}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>CD de Resistência</label>
          <input className={styles.fieldInput} type="number"
            value={char.spellSaveDC}
            onChange={e => update({ spellSaveDC: parseInt(e.target.value) || 0 })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Bônus de Ataque Mágico</label>
          <input className={styles.fieldInput} type="number"
            value={char.spellAttackBonus}
            onChange={e => update({ spellAttackBonus: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Spell slots */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Espaços de Magia</h4>
        <div className={styles.slotsGrid}>
          {([1,2,3,4,5,6,7,8,9] as SpellSlotLevel[]).map(lv => {
            const sl = char.spellSlots[lv];
            return (
              <div key={lv} className={styles.slotBlock}>
                <span className={styles.slotLabel}>{lv}º</span>
                <input className={styles.slotInput} type="number" min={0}
                  value={sl.used} title="Usados"
                  onChange={e => updateSlot(lv, 'used', parseInt(e.target.value) || 0)} />
                <span className={styles.slotSep}>/</span>
                <input className={styles.slotInput} type="number" min={0}
                  value={sl.max} title="Total"
                  onChange={e => updateSlot(lv, 'max', parseInt(e.target.value) || 0)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Spells list */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Lista de Magias</h4>
          <button className={styles.addBtn} onClick={addSpell}>+ Adicionar</button>
        </div>
        {char.spells.length === 0 && <p className={styles.empty}>Nenhuma magia cadastrada.</p>}
        {spellsByLevel.map(({ lv, spells }) => (
          spells.length === 0 ? null : (
            <div key={lv} className={styles.spellGroup}>
              <h5 className={styles.spellGroupTitle}>{lv === 0 ? 'Truques' : `${lv}º Círculo`}</h5>
              {spells.map(sp => (
                <div key={sp.id} className={styles.spellRow}>
                  <label className={styles.checkLabel} title="Preparada">
                    <input type="checkbox" checked={sp.prepared}
                      onChange={e => updateSpell(sp.id, { prepared: e.target.checked })} />
                  </label>
                  <input className={styles.spellName} value={sp.name}
                    onChange={e => updateSpell(sp.id, { name: e.target.value })} />
                  <select className={styles.spellSchool} value={sp.school}
                    onChange={e => updateSpell(sp.id, { school: e.target.value })}>
                    {SPELL_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className={styles.spellCast} value={sp.castingTime} placeholder="Tempo"
                    onChange={e => updateSpell(sp.id, { castingTime: e.target.value })} />
                  <label className={styles.spellBadge} title="Concentração">
                    <input type="checkbox" checked={sp.concentration}
                      onChange={e => updateSpell(sp.id, { concentration: e.target.checked })} />
                    C
                  </label>
                  <label className={styles.spellBadge} title="Ritual">
                    <input type="checkbox" checked={sp.ritual}
                      onChange={e => updateSpell(sp.id, { ritual: e.target.checked })} />
                    R
                  </label>
                  <button className={styles.deleteBtn} onClick={() => removeSpell(sp.id)}>✕</button>
                </div>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ── TabRecursos ───────────────────────────────────────────────────────────────

const RECHARGE_LABELS = { short: 'Descanso Curto', long: 'Descanso Longo', dawn: 'Amanhecer', other: 'Outro' };

function TabRecursos({ char, update }: { char: Character; update: (p: Partial<Character>) => void }) {
  function addResource() {
    const r: ClassResource = {
      id: Date.now().toString(36),
      name: 'Novo Recurso', current: 1, max: 1, rechargeOn: 'long',
    };
    update({ classResources: [...char.classResources, r] });
  }

  function updateRes(id: string, patch: Partial<ClassResource>) {
    update({ classResources: char.classResources.map(r => r.id === id ? { ...r, ...patch } : r) });
  }

  function removeRes(id: string) {
    update({ classResources: char.classResources.filter(r => r.id !== id) });
  }

  return (
    <div className={styles.tabBody}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>Recursos de Classe</h4>
        <button className={styles.addBtn} onClick={addResource}>+ Adicionar</button>
      </div>
      {char.classResources.length === 0 && (
        <p className={styles.empty}>
          Nenhum recurso. Exemplos: Pontos de Ki, Inspiração Bárdica, Surto de Ação.
        </p>
      )}
      <div className={styles.resourceList}>
        {char.classResources.map(r => (
          <div key={r.id} className={styles.resourceCard}>
            <input className={styles.resourceName} value={r.name}
              onChange={e => updateRes(r.id, { name: e.target.value })} />
            <div className={styles.resourceControls}>
              <button className={styles.hpBtn} onClick={() => updateRes(r.id, { current: Math.max(0, r.current - 1) })}>−</button>
              <span className={styles.resourceVal}>{r.current}</span>
              <span className={styles.slotSep}>/</span>
              <input className={styles.resourceMax} type="number" min={0}
                value={r.max}
                onChange={e => updateRes(r.id, { max: Math.max(0, parseInt(e.target.value) || 0) })} />
              <button className={styles.hpBtn} onClick={() => updateRes(r.id, { current: Math.min(r.max, r.current + 1) })}>+</button>
            </div>
            <select className={styles.resourceRecharge}
              value={r.rechargeOn}
              onChange={e => updateRes(r.id, { rechargeOn: e.target.value as ClassResource['rechargeOn'] })}>
              {Object.entries(RECHARGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={styles.deleteBtn} onClick={() => removeRes(r.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TabNotas ──────────────────────────────────────────────────────────────────

function TabNotas({ char, update }: { char: Character; update: (p: Partial<Character>) => void }) {
  return (
    <div className={styles.tabBody}>
      <div className={styles.notesGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Traços de Personalidade</label>
          <textarea className={styles.textarea} rows={3} value={char.personality}
            onChange={e => update({ personality: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Ideais</label>
          <textarea className={styles.textarea} rows={3} value={char.ideals}
            onChange={e => update({ ideals: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Laços</label>
          <textarea className={styles.textarea} rows={3} value={char.bonds}
            onChange={e => update({ bonds: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Fraquezas</label>
          <textarea className={styles.textarea} rows={3} value={char.flaws}
            onChange={e => update({ flaws: e.target.value })} />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Aparência</label>
        <textarea className={styles.textarea} rows={3} value={char.appearance}
          onChange={e => update({ appearance: e.target.value })} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>História / Backstory</label>
        <textarea className={styles.textarea} rows={6} value={char.backstory}
          onChange={e => update({ backstory: e.target.value })} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Notas do Mestre</label>
        <textarea className={styles.textarea} rows={4} value={char.notes}
          onChange={e => update({ notes: e.target.value })} />
      </div>
    </div>
  );
}
