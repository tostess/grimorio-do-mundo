export type GridType = 'square' | 'hex';

export const TOKEN_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#a8dadc',
  '#8b5aaa', '#c9a84c', '#c04040', '#40a050',
] as const;

export type TokenColor = typeof TOKEN_COLORS[number];

export interface BattleMap {
  id: string;
  name: string;
  imageRefId: string | null;
  imageMime: string;
  width: number;
  height: number;
  gridType: GridType;
  cellSize: number;
  feetPerCell: number;
  fogEnabled: boolean;
}

// x/y são coordenadas de célula (coluna/linha), não pixels
export interface MapToken {
  id: string;
  name: string;
  initials: string;
  color: string;
  characterId: string | null;
  peerId: string | null;
  x: number;
  y: number;
  size: number;
  isNPC: boolean;
}

export interface FogCell {
  x: number;
  y: number;
}

// Régua de medição — coordenadas em pixels da imagem (efêmera, nunca sincronizada)
export interface Measurement {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  feet: number;
}

// Unidade completa de um mapa de batalha: config + tokens + névoa revelada
export interface BattleMapRecord {
  map: BattleMap;
  tokens: MapToken[];
  revealed: FogCell[];
}

export function tokenInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
