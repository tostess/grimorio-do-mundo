import type { AppState, GrimoireEvent, Setup, UIFilters, TabId } from '../types';
import type { WorldMap, MapMarker } from '../types/worldmap';

export type Action =
  | { type: 'SET_ACTIVE_TAB'; payload: TabId }
  | { type: 'UPDATE_SETUP'; payload: Partial<Setup> }
  | { type: 'ADD_EVENT'; payload: Omit<GrimoireEvent, 'id'> }
  | { type: 'UPDATE_EVENT'; payload: GrimoireEvent }
  | { type: 'DELETE_EVENT'; payload: number }
  | { type: 'ADD_ERA'; payload: string }
  | { type: 'DELETE_ERA'; payload: string }
  | { type: 'ADD_CUSTOM_TYPE'; payload: string }
  | { type: 'DELETE_CUSTOM_TYPE'; payload: string }
  | { type: 'ADD_SIGNIFICANCE'; payload: string }
  | { type: 'DELETE_SIGNIFICANCE'; payload: string }
  | { type: 'TOGGLE_PROMPT'; payload: string }
  | { type: 'UPDATE_PROMPT_NOTE'; payload: { id: string; note: string } }
  | { type: 'TOGGLE_PROMPT_COLLAPSE'; payload: string }
  | { type: 'UPDATE_FILTERS'; payload: Partial<UIFilters> }
  | { type: 'SET_IDEAS_CATEGORY'; payload: string }
  | { type: 'MARK_IDEA_USED'; payload: { categoryIndex: number; ideaIndex: number } }
  | { type: 'IMPORT_STATE'; payload: AppState }
  | { type: 'ADD_WORLD_MAP'; payload: WorldMap }
  | { type: 'UPDATE_WORLD_MAP'; payload: WorldMap }
  | { type: 'DELETE_WORLD_MAP'; payload: string }
  | { type: 'SET_ACTIVE_MAP'; payload: string | null }
  | { type: 'ADD_MARKER'; payload: { mapId: string; marker: MapMarker } }
  | { type: 'UPDATE_MARKER'; payload: { mapId: string; marker: MapMarker } }
  | { type: 'DELETE_MARKER'; payload: { mapId: string; markerId: string } };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.payload } };

    case 'UPDATE_SETUP':
      return { ...state, setup: { ...state.setup, ...action.payload } };

    case 'ADD_EVENT': {
      const newEvent: GrimoireEvent = { ...action.payload, id: state.counters.nextEventId };
      return {
        ...state,
        events: [...state.events, newEvent],
        counters: { nextEventId: state.counters.nextEventId + 1 },
      };
    }

    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e => (e.id === action.payload.id ? action.payload : e)),
      };

    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter(e => e.id !== action.payload) };

    case 'ADD_ERA':
      if (state.eras.includes(action.payload)) return state;
      return { ...state, eras: [...state.eras, action.payload] };

    case 'DELETE_ERA': {
      if (state.eras.length <= 1) return state;
      const hasEvents = state.events.some(e => e.era === action.payload);
      if (hasEvents) return state;
      return { ...state, eras: state.eras.filter(e => e !== action.payload) };
    }

    case 'ADD_CUSTOM_TYPE':
      if (state.customTypes.includes(action.payload)) return state;
      return { ...state, customTypes: [...state.customTypes, action.payload] };

    case 'DELETE_CUSTOM_TYPE':
      return { ...state, customTypes: state.customTypes.filter(t => t !== action.payload) };

    case 'ADD_SIGNIFICANCE':
      if (state.significance.includes(action.payload)) return state;
      return { ...state, significance: [...state.significance, action.payload] };

    case 'DELETE_SIGNIFICANCE': {
      if (state.significance.length <= 1) return state;
      return { ...state, significance: state.significance.filter(s => s !== action.payload) };
    }

    case 'TOGGLE_PROMPT':
      return {
        ...state,
        prompts: state.prompts.map(cat => ({
          ...cat,
          items: cat.items.map(item =>
            item.id === action.payload ? { ...item, done: !item.done } : item
          ),
        })),
      };

    case 'UPDATE_PROMPT_NOTE':
      return {
        ...state,
        prompts: state.prompts.map(cat => ({
          ...cat,
          items: cat.items.map(item =>
            item.id === action.payload.id ? { ...item, note: action.payload.note } : item
          ),
        })),
      };

    case 'TOGGLE_PROMPT_COLLAPSE':
      return {
        ...state,
        ui: {
          ...state.ui,
          promptCollapsed: {
            ...state.ui.promptCollapsed,
            [action.payload]: !state.ui.promptCollapsed[action.payload],
          },
        },
      };

    case 'UPDATE_FILTERS':
      return {
        ...state,
        ui: { ...state.ui, filters: { ...state.ui.filters, ...action.payload } },
      };

    case 'SET_IDEAS_CATEGORY':
      return { ...state, ui: { ...state.ui, ideasCategory: action.payload } };

    case 'MARK_IDEA_USED':
      return {
        ...state,
        ideas: state.ideas.map((cat, ci) =>
          ci === action.payload.categoryIndex
            ? {
                ...cat,
                ideas: cat.ideas.map((idea, ii) =>
                  ii === action.payload.ideaIndex ? { ...idea, used: !idea.used } : idea
                ),
              }
            : cat
        ),
      };

    case 'IMPORT_STATE':
      return action.payload;

    case 'ADD_WORLD_MAP':
      return { ...state, worldMaps: [...(state.worldMaps ?? []), action.payload], activeMapId: state.activeMapId ?? action.payload.id };

    case 'UPDATE_WORLD_MAP':
      return { ...state, worldMaps: (state.worldMaps ?? []).map(m => m.id === action.payload.id ? action.payload : m) };

    case 'DELETE_WORLD_MAP': {
      const remaining = (state.worldMaps ?? []).filter(m => m.id !== action.payload);
      return {
        ...state,
        worldMaps: remaining,
        activeMapId: state.activeMapId === action.payload ? (remaining[0]?.id ?? null) : state.activeMapId,
      };
    }

    case 'SET_ACTIVE_MAP':
      return { ...state, activeMapId: action.payload };

    case 'ADD_MARKER':
      return {
        ...state,
        worldMaps: (state.worldMaps ?? []).map(m =>
          m.id === action.payload.mapId ? { ...m, markers: [...m.markers, action.payload.marker] } : m
        ),
      };

    case 'UPDATE_MARKER':
      return {
        ...state,
        worldMaps: (state.worldMaps ?? []).map(m =>
          m.id === action.payload.mapId
            ? { ...m, markers: m.markers.map(mk => mk.id === action.payload.marker.id ? action.payload.marker : mk) }
            : m
        ),
      };

    case 'DELETE_MARKER':
      return {
        ...state,
        worldMaps: (state.worldMaps ?? []).map(m =>
          m.id === action.payload.mapId ? { ...m, markers: m.markers.filter(mk => mk.id !== action.payload.markerId) } : m
        ),
      };

    default:
      return state;
  }
}
