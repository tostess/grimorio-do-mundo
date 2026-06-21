export type MarkerKind = 'city' | 'kingdom' | 'dungeon' | 'poi' | 'danger';

export type MarkerVisibility = 'hidden' | 'revealed';

export interface MapMarker {
  id: string;
  // Position as fraction of image dimensions (0–1) — survives image swaps
  x: number;
  y: number;
  kind: MarkerKind;
  label: string;
  description: string;
  linkedEventIds: number[];
  color: string;
  // Future: controls guest visibility; not used in this phase
  visibility: MarkerVisibility;
}

export interface WorldMap {
  id: string;
  name: string;
  // ID used to look up the image binary in IDB (grimorio-maps)
  imageRefId: string | null;
  // Natural dimensions of the image (set on upload, used to restore fractional coords)
  width: number;
  height: number;
  markers: MapMarker[];
}

export const MARKER_LABELS: Record<MarkerKind, string> = {
  city: '🏙️ Cidade',
  kingdom: '👑 Reino',
  dungeon: '🏚️ Masmorra',
  poi: '📍 Ponto de Interesse',
  danger: '⚠️ Perigo',
};

export const MARKER_ICONS: Record<MarkerKind, string> = {
  city: '🏙',
  kingdom: '👑',
  dungeon: '🏚',
  poi: '📍',
  danger: '⚠',
};
