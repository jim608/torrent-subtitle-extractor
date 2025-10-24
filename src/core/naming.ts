export interface NamingFormatterOptions {
  prefixEpisode?: boolean;
  keepOriginalName?: boolean;
}

export interface NamingInput {
  originalPath: string;
  language: { code: string; bilingual: boolean; label: string };
  extension: string; // 'ass' | 'srt' | 'vtt' | 'sup'
}

export class NamingFormatter {
  constructor(private opts: NamingFormatterOptions = {}) {}

  private detectEpisodePrefix(filename: string): string | null {
    const m = filename.match(/(S\d{2}E\d{2})/i);
    return m ? m[1].toUpperCase() : null;
  }

  format(input: NamingInput): string {
    const base = input.language.label;
    const ext = input.extension;
    const episode = this.opts.prefixEpisode ? this.detectEpisodePrefix(input.originalPath) : null;

    let name = base;
    if (input.language.code === 'zh-TW' && input.language.bilingual) {
      // already labeled 繁日
    }

    if (episode) name = `${episode}-${name}`;

    // Append language code suffix if Chinese
    const lc = input.language.code === 'zh-TW' ? 'zh-TW' : input.language.code === 'zh' ? 'zh' : input.language.code === 'ja' ? 'ja' : 'zh';

    return `${name}.${lc}.${ext}`;
  }
}
