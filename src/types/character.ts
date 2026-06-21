// ── Ability Scores ────────────────────────────────────────────────────────────

export type Ability5e = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_LABELS: Record<Ability5e, string> = {
  str: 'Força', dex: 'Destreza', con: 'Constituição',
  int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma',
};
export const ABILITY_SHORT: Record<Ability5e, string> = {
  str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
};
export const ABILITIES: Ability5e[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export type CharacterAbilities = Record<Ability5e, number>;

// ── Skills (18 standard D&D 5e) ───────────────────────────────────────────────

export type Skill5e =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleightOfHand'
  | 'stealth' | 'survival';

export interface SkillDef { id: Skill5e; label: string; ability: Ability5e }

export const SKILL_LIST: SkillDef[] = [
  { id: 'athletics',      label: 'Atletismo',       ability: 'str' },
  { id: 'acrobatics',     label: 'Acrobacia',        ability: 'dex' },
  { id: 'sleightOfHand',  label: 'Prestidigitação',  ability: 'dex' },
  { id: 'stealth',        label: 'Furtividade',      ability: 'dex' },
  { id: 'arcana',         label: 'Arcanismo',        ability: 'int' },
  { id: 'history',        label: 'História',         ability: 'int' },
  { id: 'investigation',  label: 'Investigação',     ability: 'int' },
  { id: 'nature',         label: 'Natureza',         ability: 'int' },
  { id: 'religion',       label: 'Religião',         ability: 'int' },
  { id: 'animalHandling', label: 'Adestramento',     ability: 'wis' },
  { id: 'insight',        label: 'Intuição',         ability: 'wis' },
  { id: 'medicine',       label: 'Medicina',         ability: 'wis' },
  { id: 'perception',     label: 'Percepção',        ability: 'wis' },
  { id: 'survival',       label: 'Sobrevivência',    ability: 'wis' },
  { id: 'deception',      label: 'Enganação',        ability: 'cha' },
  { id: 'intimidation',   label: 'Intimidação',      ability: 'cha' },
  { id: 'performance',    label: 'Atuação',          ability: 'cha' },
  { id: 'persuasion',     label: 'Persuasão',        ability: 'cha' },
];

export interface SkillEntry { proficient: boolean; expertise: boolean }
export type CharacterSkills = Record<Skill5e, SkillEntry>;

// ── Attacks ───────────────────────────────────────────────────────────────────

export interface Attack {
  id: string;
  name: string;
  bonus: string;       // "+5", "STR+prof"
  damage: string;      // "1d8+3"
  damageType: string;
  range: string;
  notes: string;
}

// ── Spells ────────────────────────────────────────────────────────────────────

export const SPELL_SCHOOLS = [
  'Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento',
  'Evocação', 'Ilusão', 'Necromancia', 'Transmutação',
] as const;

export interface Spell {
  id: string;
  name: string;
  level: number;        // 0 = truque
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  description: string;
}

// ── Conditions (15 SRD) ───────────────────────────────────────────────────────

export type Condition5e =
  | 'blinded' | 'charmed' | 'deafened' | 'exhaustion'
  | 'frightened' | 'grappled' | 'incapacitated' | 'invisible'
  | 'paralyzed' | 'petrified' | 'poisoned' | 'prone'
  | 'restrained' | 'stunned' | 'unconscious';

export const CONDITIONS: Condition5e[] = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious',
];

export const CONDITION_LABELS: Record<Condition5e, string> = {
  blinded: 'Cego', charmed: 'Enfeitiçado', deafened: 'Surdo',
  exhaustion: 'Exaustão', frightened: 'Amedrontado', grappled: 'Agarrado',
  incapacitated: 'Incapacitado', invisible: 'Invisível', paralyzed: 'Paralisado',
  petrified: 'Petrificado', poisoned: 'Envenenado', prone: 'Caído',
  restrained: 'Contido', stunned: 'Atordoado', unconscious: 'Inconsciente',
};

// ── Class Resources ───────────────────────────────────────────────────────────

export interface ClassResource {
  id: string;
  name: string;
  current: number;
  max: number;
  rechargeOn: 'short' | 'long' | 'dawn' | 'other';
}

// ── Spell Slots ───────────────────────────────────────────────────────────────

export type SpellSlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SpellSlots = Record<SpellSlotLevel, { max: number; used: number }>;

// ── Default factories ─────────────────────────────────────────────────────────

export function defaultSpellSlots(): SpellSlots {
  return {
    1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
    4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
    7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
  };
}

export function defaultSkills(): CharacterSkills {
  const s = {} as CharacterSkills;
  for (const sk of SKILL_LIST) s[sk.id] = { proficient: false, expertise: false };
  return s;
}

export function defaultSavingThrows(): Record<Ability5e, boolean> {
  return { str: false, dex: false, con: false, int: false, wis: false, cha: false };
}

// ── Character ─────────────────────────────────────────────────────────────────

export interface Character {
  id: string;
  worldId: string;
  playerName: string;
  avatarId?: string;
  // Basic
  name: string;
  race: string;
  class: string;
  subclass: string;
  level: number;
  background: string;
  alignment: string;
  experience: number;
  // Combat
  hpMax: number;
  hpCurrent: number;
  hpTemp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  inspiration: boolean;
  deathSaves: { successes: number; failures: number };
  conditions: Condition5e[];
  exhaustionLevel: number;
  // Abilities & skills
  abilities: CharacterAbilities;
  savingThrows: Record<Ability5e, boolean>;
  skills: CharacterSkills;
  // Attacks
  attacks: Attack[];
  // Spells
  spellcastingAbility: Ability5e | '';
  spellSaveDC: number;
  spellAttackBonus: number;
  spellSlots: SpellSlots;
  spells: Spell[];
  // Class resources
  classResources: ClassResource[];
  // Notes
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  appearance: string;
  backstory: string;
  notes: string;
  // Meta
  createdAt: string;
  updatedAt: string;
}

export function createDefaultCharacter(worldId: string): Character {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    worldId,
    playerName: '',
    name: 'Novo Personagem',
    race: '',
    class: '',
    subclass: '',
    level: 1,
    background: '',
    alignment: '',
    experience: 0,
    hpMax: 10,
    hpCurrent: 10,
    hpTemp: 0,
    armorClass: 10,
    initiative: 0,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    exhaustionLevel: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: defaultSavingThrows(),
    skills: defaultSkills(),
    attacks: [],
    spellcastingAbility: '',
    spellSaveDC: 0,
    spellAttackBonus: 0,
    spellSlots: defaultSpellSlots(),
    spells: [],
    classResources: [],
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    appearance: '',
    backstory: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function skillMod(char: Character, skillId: Skill5e): number {
  const def = SKILL_LIST.find(s => s.id === skillId)!;
  const base = abilityMod(char.abilities[def.ability]);
  const entry = char.skills[skillId];
  const pb = char.proficiencyBonus;
  if (entry.expertise) return base + pb * 2;
  if (entry.proficient) return base + pb;
  return base;
}

export function savingThrowMod(char: Character, ability: Ability5e): number {
  const base = abilityMod(char.abilities[ability]);
  return char.savingThrows[ability] ? base + char.proficiencyBonus : base;
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}
