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
    const text = input.content.toString('utf8');

    // 假名：平假名/片假名
    const hasKana = /[\u3040-\u30FF]/.test(text);

    // 直接使用中文字元集合避免不完整的 \uXXXX
    const hasTrad = /[高國體說臺灣後複]/.test(text);
    const hasSimp = /[国体说台湾后复]/.test(text);

    if (hasKana && hasTrad) return { code: 'mixed-zhTW-ja', bilingual: true, label: '繁日-繁日雙語' };
    if (hasKana && hasSimp) return { code: 'mixed-zh-ja', bilingual: true, label: '簡日-簡日雙語' };
    if (hasKana) return { code: 'ja', bilingual: false, label: '日文' };
    if (hasTrad) return { code: 'zh-TW', bilingual: false, label: '繁體-繁體中文' };
    if (hasSimp) return { code: 'zh', bilingual: false, label: '简体-简体中文' };

    return { code: 'unknown', bilingual: false, label: '未知語言' };
  }
}
