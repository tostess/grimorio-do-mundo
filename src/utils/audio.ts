import { Howl, Howler } from 'howler';
import { getAudioBufferDB, listAudioDB, type AudioMeta } from './audioStorage';

export interface PlayOptions {
  sources?: string[];
  mime?: string;
  loop?: boolean;
  volume?: number;
}

class AudioManagerImpl {
  private howls = new Map<string, Howl>();
  private objUrls = new Map<string, string>();
  private metaCache: AudioMeta[] = [];

  async refreshMeta(): Promise<void> {
    try {
      this.metaCache = await listAudioDB();
    } catch {
      // non-fatal — cache stays stale
    }
  }

  private async _resolveSource(trackId: string, options: PlayOptions): Promise<{ src: string[]; format: string[] }> {
    if (options.sources?.length) {
      const ext = options.sources[0].split('.').pop()?.toLowerCase() ?? 'ogg';
      return { src: options.sources, format: [ext === 'mp3' ? 'mp3' : 'ogg', 'mp3'] };
    }

    const buffer = await getAudioBufferDB(trackId);
    if (!buffer) throw new Error(`Audio not found in IDB: ${trackId}`);

    const meta = this.metaCache.find(m => m.id === trackId);
    const mime = options.mime ?? meta?.mime ?? 'audio/ogg';
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);

    const prev = this.objUrls.get(trackId);
    if (prev) URL.revokeObjectURL(prev);
    this.objUrls.set(trackId, url);

    const format = mime.includes('mp3') || mime.includes('mpeg') ? 'mp3' : 'ogg';
    return { src: [url], format: [format] };
  }

  private _unload(trackId: string): void {
    const h = this.howls.get(trackId);
    if (h) { h.unload(); this.howls.delete(trackId); }
    const url = this.objUrls.get(trackId);
    if (url) { URL.revokeObjectURL(url); this.objUrls.delete(trackId); }
  }

  async play(trackId: string, options: PlayOptions = {}): Promise<void> {
    this._unload(trackId);
    const { src, format } = await this._resolveSource(trackId, options);
    const howl = new Howl({
      src,
      format,
      loop: options.loop ?? true,
      volume: options.volume ?? 0.8,
      html5: false,
    });
    this.howls.set(trackId, howl);
    howl.play();
  }

  stop(trackId: string): void {
    this._unload(trackId);
  }

  stopAll(): void {
    for (const id of [...this.howls.keys()]) this._unload(id);
  }

  setVolume(trackId: string, volume: number): void {
    this.howls.get(trackId)?.volume(volume);
  }

  isPlaying(trackId: string): boolean {
    const h = this.howls.get(trackId);
    return h ? h.playing() : false;
  }

  async crossfade(fromId: string, toId: string, durationMs: number, toOptions: PlayOptions = {}): Promise<void> {
    const fromHowl = this.howls.get(fromId);
    const targetVol = toOptions.volume ?? 0.8;

    // Start new track silently then fade in
    await this.play(toId, { ...toOptions, volume: 0 });
    this.howls.get(toId)?.fade(0, targetVol, durationMs);

    // Fade out old track and unload
    if (fromHowl) {
      const curVol = typeof fromHowl.volume() === 'number' ? (fromHowl.volume() as number) : 0.8;
      fromHowl.fade(curVol, 0, durationMs);
      setTimeout(() => this._unload(fromId), durationMs + 100);
    }
  }

  // Destravar autoplay: toca WAV silencioso para liberar AudioContext
  unlock(): void {
    try {
      const h = new Howl({
        src: ['data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='],
        volume: 0,
        html5: false,
      });
      h.play();
      h.once('end', () => h.unload());
    } catch {
      // silently ignore if AudioContext unavailable
    }
  }

  destroy(): void {
    this.stopAll();
    try { Howler.unload(); } catch { /* ignore */ }
  }
}

export const audioManager = new AudioManagerImpl();
