import type { AppState } from '../types';
import { DEFAULT_ERAS, DEFAULT_SIGNIFICANCE } from '../types';
import { PROMPTS_DATA } from './prompts';
import { EVENT_IDEAS_DATA } from './eventIdeas';

export function createDefaultState(): AppState {
  return {
    meta: { version: 1, appName: 'Grimório do Mundo' },
    setup: {
      currentYear: 1637,
      currentMonth: 1,
      currentDay: 1,
      worldName: 'Meu Mundo',
      worldDesc: '',
      calendar: {
        type: 'standard',
        customMonths: [
          { name: 'Mês 1', days: 30 },
          { name: 'Mês 2', days: 30 },
          { name: 'Mês 3', days: 30 },
        ],
      },
    },
    eras: [...DEFAULT_ERAS],
    customTypes: [],
    significance: [...DEFAULT_SIGNIFICANCE],
    events: [],
    prompts: PROMPTS_DATA.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item })),
    })),
    ideas: EVENT_IDEAS_DATA.map(cat => ({
      ...cat,
      ideas: cat.ideas.map(idea => ({ ...idea })),
    })),
    ui: {
      activeTab: 'timeline',
      promptCollapsed: {},
      filters: {
        search: '',
        era: '',
        type: '',
        significance: '',
        tagFilter: '',
        viewMode: 'table' as const,
        sortBy: 'startYear',
        sortDir: 'asc',
      },
      ideasCategory: '',
    },
    counters: { nextEventId: 1 },
    worldMaps: [],
    activeMapId: null,
  };
}
