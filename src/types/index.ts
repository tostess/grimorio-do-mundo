import type { WorldMap } from './worldmap';

export type { WorldMap };

export interface CalendarMonth {
  name: string;
  days: number;
}

export interface Calendar {
  type: 'standard' | 'custom';
  customMonths: CalendarMonth[];
}

export interface Setup {
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  worldName: string;
  worldDesc: string;
  calendar: Calendar;
}

export type SpoilerLevel = 'not' | 'minor' | 'major';
export type PersonalFlag = 'not' | 'yes';

export interface GrimoireEvent {
  id: number;
  era: string;
  startYear: number;
  startMonth: number | null;
  startDay: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  name: string;
  significance: string;
  type: string;
  timeline: string;
  summary: string;
  trigger: string;
  result: string;
  location: string;
  chars: string;
  orgs: string;
  article: string;
  other: string;
  spoiler: SpoilerLevel;
  personal: PersonalFlag;
  tags: string[];
  masterNotes: string;
  mapMarkerId: string | null;
}

export interface PromptItem {
  id: string;
  done: boolean;
  note: string;
  text: string;
}

export interface PromptCategory {
  category: string;
  items: PromptItem[];
}

export interface EventIdea {
  title: string;
  description: string;
  used: boolean;
}

export interface EventIdeaCategory {
  category: string;
  ideas: EventIdea[];
}

export interface UIFilters {
  search: string;
  era: string;
  type: string;
  significance: string;
  tagFilter: string;
  viewMode: 'table' | 'visual';
  sortBy: keyof GrimoireEvent | 'duration';
  sortDir: 'asc' | 'desc';
}

export interface UIState {
  activeTab: TabId;
  promptCollapsed: Record<string, boolean>;
  filters: UIFilters;
  ideasCategory: string;
}

export interface Counters {
  nextEventId: number;
}

export interface Meta {
  version: number;
  appName: string;
}

export interface AppState {
  meta: Meta;
  setup: Setup;
  eras: string[];
  customTypes: string[];
  significance: string[];
  events: GrimoireEvent[];
  prompts: PromptCategory[];
  ideas: EventIdeaCategory[];
  ui: UIState;
  counters: Counters;
  worldMaps: WorldMap[];
  activeMapId: string | null;
}

export type TabId = 'timeline' | 'setup' | 'stats' | 'prompts' | 'ideas' | 'types' | 'session' | 'chars' | 'map';

export interface WorldMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: string;
  eventCount: number;
  state: AppState;
}

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'timeline', label: 'Linha do Tempo', icon: '⏳' },
  { id: 'map', label: 'Mapa', icon: '🗺️' },
  { id: 'setup', label: 'Configuração', icon: '🏰' },
  { id: 'stats', label: 'Estatísticas', icon: '📊' },
  { id: 'prompts', label: '400 Prompts', icon: '💡' },
  { id: 'ideas', label: 'Ideias de Eventos', icon: '🎲' },
  { id: 'types', label: 'Tipos & Dados', icon: '🔗' },
  { id: 'session', label: 'Sessão', icon: '⚔️' },
  { id: 'chars', label: 'Fichas', icon: '🧙' },
];

export const DEFAULT_TYPES = [
  '💥 Militar, guerra',
  '👑 Político, sucessão',
  '🔮 Arcano, mágico',
  '🙏 Religioso, divino',
  '🌊 Natural, ambiental',
  '💀 Extinção, catástrofe',
  '🗺️ Descoberta, exploração',
  '🦠 Praga, crise',
  '👥 Social, cultural',
  '💰 Econômico, comercial',
  '👻 Paranormal, espiritual',
  '🏛️ Fundação, construção',
];

export const DEFAULT_SIGNIFICANCE = [
  'Major / Global',
  'Major / Regional',
  'Minor / Local',
  'Trivial',
];

export const DEFAULT_ERAS = ['Antiga', 'Clássica', 'Moderna'];

export const STANDARD_MONTHS: CalendarMonth[] = [
  { name: 'Janeiro', days: 31 },
  { name: 'Fevereiro', days: 28 },
  { name: 'Março', days: 31 },
  { name: 'Abril', days: 30 },
  { name: 'Maio', days: 31 },
  { name: 'Junho', days: 30 },
  { name: 'Julho', days: 31 },
  { name: 'Agosto', days: 31 },
  { name: 'Setembro', days: 30 },
  { name: 'Outubro', days: 31 },
  { name: 'Novembro', days: 30 },
  { name: 'Dezembro', days: 31 },
];
