export interface BundledTrack {
  id: string;
  label: string;
  kind: 'ambient' | 'sfx';
  sources: string[];
  loop: boolean;
  license: 'CC0' | 'CC-BY' | 'OTHER';
  attribution: string;
  sourceUrl: string;
}

// Vazio até haver arquivos com licença CC0/CC-BY confirmada.
// Para adicionar faixas: colocar os arquivos em public/audio/ e registrar aqui.
// Formato recomendado: mono, OGG Vorbis ~96 kbps + fallback MP3.
export const AUDIO_MANIFEST: BundledTrack[] = [];
