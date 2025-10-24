import fs from 'fs-extra';

export interface ProcessorOptions {
  outputDir: string;
  extensions?: string[] | string;
  emitSup?: boolean;
  skipSup?: boolean;
}

export interface ExtractedSubtitle {
  format: 'ass' | 'srt' | 'vtt' | 'sup';
  content: Buffer;
}

export interface SubtitleCandidate {
  path: string;
  length: number;
  container?: 'mkv' | 'mp4' | 'external';
}

export class SubtitleProcessor {
  private preferred: string[];

  constructor(private opts: ProcessorOptions) {
    this.preferred = Array.isArray(opts.extensions)
      ? opts.extensions
      : (opts.extensions || 'ass,srt,vtt').split(',').map(s => s.trim());
  }

  async extractSubtitle(candidate: SubtitleCandidate): Promise<ExtractedSubtitle | null> {
    // Minimal stub: if it's an external subtitle, just read it
    if (candidate.container === 'external') {
      const lower = candidate.path.toLowerCase();
      const ext = lower.endsWith('.ass') ? 'ass' : lower.endsWith('.srt') ? 'srt' : lower.endsWith('.vtt') ? 'vtt' : lower.endsWith('.sup') ? 'sup' : null;
      if (!ext) return null;
      if (ext === 'sup' && this.opts.skipSup) return null;
      const content = await fs.readFile(candidate.path).catch(() => Buffer.from(''));
      return { format: ext as any, content };
    }
    // TODO: Implement MKV/MP4 track probing and extraction via mkvextract/ffmpeg
    return null;
  }
}
