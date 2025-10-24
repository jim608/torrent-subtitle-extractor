export interface LanguageDetectorOptions {
  threshold?: number;
}

export type LanguageCode = 'zh' | 'zh-TW' | 'ja' | 'mixed-zh-ja' | 'mixed-zhTW-ja' | 'unknown';

export interface DetectedLanguage {
  code: LanguageCode;
  bilingual: boolean;
  label: string; // e.g., 繁體-繁體中文 / 简体-简体中文 / 日文 / 繁日-繁日雙語 / 簡日-簡日雙語
}

export class LanguageDetector {
  constructor(private opts: LanguageDetectorOptions = {}) {}

  async detect(input: { format: string; content: Buffer }): Promise<DetectedLanguage> {
    // Minimal heuristic stub: decide by presence of common characters
    const text = input.content.toString('utf8');
    const hasKana = /[\u3040-\u30FF]/.test(text);
    const hasTrad = /[\u9AD8\u570B\u體\u說\u臺\u灣\u後\u複]/.test(text);
    const hasSimp = /[\u56FD\u体\u说\u台\u湾\u后\u复]/.test(text);

    if (hasKana && hasTrad) return { code: 'mixed-zhTW-ja', bilingual: true, label: '繁日-繁日雙語' };
    if (hasKana && hasSimp) return { code: 'mixed-zh-ja', bilingual: true, label: '簡日-簡日雙語' };
    if (hasKana) return { code: 'ja', bilingual: false, label: '日文' };
    if (hasTrad) return { code: 'zh-TW', bilingual: false, label: '繁體-繁體中文' };
    if (hasSimp) return { code: 'zh', bilingual: false, label: '简体-简体中文' };
    return { code: 'unknown', bilingual: false, label: '未知語言' };
  }
}
