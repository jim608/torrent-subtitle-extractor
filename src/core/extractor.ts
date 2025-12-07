import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';

export interface TorrentInfoFile {
  path: string;
  length: number;
}

export interface TorrentInfo {
  name: string;
  length: number;
  files: TorrentInfoFile[];
  infoHash?: string;
}

export interface ExtractorOptions {
  rateLimit?: string;
  allowFullDownload?: boolean;
  verbose?: boolean;
  timeout?: number;
  trackers?: string[];
  dht?: boolean;
}

export interface SubtitleCandidate {
  path: string;
  length: number;
  container?: 'mkv' | 'mp4' | 'external';
  torrentFile?: any;
}

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce', 
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'http://t.nyaatracker.com/announce',
  'http://tracker.kamigami.org:2710/announce',
  'https://tr.bangumi.moe:9696/announce'
];

// Global WebTorrent client instance
let globalWebTorrentInstance: any = null;

export class TorrentExtractor {
  private client: any = null;
  
  constructor(private opts: ExtractorOptions = {}) {}

  private async getWebTorrentClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    // Try to reuse global instance
    if (globalWebTorrentInstance) {
      this.client = globalWebTorrentInstance;
      return this.client;
    }

    try {
      if (this.opts.verbose) {
        console.log('[Extractor] Initializing WebTorrent client...');
      }

      // Dynamic import with proper ESM handling
      const WebTorrent = await (async () => {
        try {
          const mod = await import('webtorrent');
          return (mod as any).default || mod;
        } catch (e) {
          throw new Error(`Failed to import WebTorrent: ${e}`);
        }
      })();

      this.client = new WebTorrent({
        dht: this.opts.dht !== false,
        tracker: true,
        lsd: true,
        maxConns: this.opts.allowFullDownload ? 100 : 10
      });

      globalWebTorrentInstance = this.client;

      if (this.opts.verbose) {
        console.log('[Extractor] WebTorrent client initialized');
      }

      return this.client;
    } catch (err) {
      throw new Error(`[Extractor] WebTorrent initialization failed: ${err}`);
    }
  }

  async parseTorrent(source: string): Promise<TorrentInfo> {
    const client = await this.getWebTorrentClient();
    
    return new Promise((resolve, reject) => {
      const timeout = this.opts.timeout || 30000;
      let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
        timeoutHandle = null;
        reject(new Error(`Timeout after ${timeout}ms getting torrent metadata`));
      }, timeout);

      try {
        // Add default trackers if using magnet
        let torrentId = source;
        if (source.startsWith('magnet:')) {
          if (!source.includes('&tr=')) {
            const trackerParams = DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');
            torrentId = source + trackerParams;
          }
        }

        if (this.opts.verbose) {
          console.log('[Extractor] Adding torrent:', torrentId.slice(0, 80) + '...');
        }

        const torrent = client.add(torrentId, {
          announce: DEFAULT_TRACKERS
        });

        const handleReady = () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          
          const files: TorrentInfoFile[] = (torrent.files as any[]).map((file: any) => ({
            path: file.path,
            length: file.length
          }));

          if (this.opts.verbose) {
            console.log(`[Extractor] Torrent ready: ${torrent.name} (${files.length} files, ${this.formatBytes(torrent.length)})`);
          }

          // Clean up listeners
          torrent.removeListener('ready', handleReady);
          torrent.removeListener('error', handleError);
          
          resolve({
            name: torrent.name,
            length: torrent.length,
            files: files,
            infoHash: torrent.infoHash
          });
        };

        const handleError = (err: any) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          
          // Clean up listeners
          torrent.removeListener('ready', handleReady);
          torrent.removeListener('error', handleError);
          
          reject(new Error(`[Extractor] Torrent error: ${err.message || err}`));
        };

        torrent.once('ready', handleReady);
        torrent.once('error', handleError);

        // Progress logging
        if (this.opts.verbose) {
          let lastProgress = -1;
          const progressInterval = setInterval(() => {
            if (torrent.ready) {
              clearInterval(progressInterval);
              return;
            }
            const progress = Math.floor(torrent.progress * 100);
            if (progress !== lastProgress && progress > 0) {
              console.log(`[Extractor] Metadata: ${progress}%`);
              lastProgress = progress;
            }
          }, 2000);
        }
      } catch (err) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(err);
      }
    });
  }

  async filterSubtitleCandidates(info: TorrentInfo): Promise<SubtitleCandidate[]> {
    const subtitleExts = ['.ass', '.ssa', '.srt', '.vtt', '.sup'];
    const containerExts = ['.mkv', '.mp4'];
    
    const candidates: SubtitleCandidate[] = [];

    for (const file of info.files) {
      const lower = file.path.toLowerCase();
      const isSubtitle = subtitleExts.some(ext => lower.endsWith(ext));
      const isContainer = containerExts.some(ext => lower.endsWith(ext));

      if (isSubtitle) {
        candidates.push({
          path: file.path,
          length: file.length,
          container: 'external'
        });
      } else if (isContainer) {
        const containerType = lower.endsWith('.mkv') ? 'mkv' : 'mp4';
        candidates.push({
          path: file.path,
          length: file.length,
          container: containerType
        });
      }
    }

    if (this.opts.verbose) {
      console.log(`[Extractor] Found ${candidates.length} subtitle candidates`);
      candidates.forEach((c, i) => {
        console.log(`  [${i + 1}] ${c.container === 'external' ? '[EXT]' : '[' + c.container?.toUpperCase() + ']'} ${c.path} (${this.formatBytes(c.length)})`);
      });
    }

    return candidates;
  }

  async downloadFile(infoHash: string, filePath: string, outputPath: string): Promise<void> {
    const client = await this.getWebTorrentClient();
    
    return new Promise((resolve, reject) => {
      try {
        const torrent = client.get(infoHash);
        if (!torrent) {
          reject(new Error('[Extractor] Torrent not found in client'));
          return;
        }

        const file = (torrent.files as any[]).find((f: any) => f.path === filePath);
        if (!file) {
          reject(new Error(`[Extractor] File not found: ${filePath}`));
          return;
        }

        if (this.opts.verbose) {
          console.log(`[Extractor] Downloading: ${filePath}`);
        }

        const stream = file.createReadStream();
        const writeStream = createWriteStream(outputPath);
        
        const handleError = (err: any) => {
          stream.removeListener('error', handleError);
          writeStream.removeListener('error', handleError);
          writeStream.removeListener('finish', handleFinish);
          reject(err);
        };

        const handleFinish = () => {
          stream.removeListener('error', handleError);
          writeStream.removeListener('error', handleError);
          writeStream.removeListener('finish', handleFinish);
          if (this.opts.verbose) {
            console.log(`[Extractor] Downloaded: ${outputPath}`);
          }
          resolve();
        };
        
        stream.on('error', handleError);
        writeStream.on('error', handleError);
        writeStream.on('finish', handleFinish);
        
        stream.pipe(writeStream);
      } catch (err) {
        reject(err);
      }
    });
  }

  async cleanup(): Promise<void> {
    if (!this.client) return;
    
    return new Promise((resolve) => {
      this.client.destroy((err?: any) => {
        if (err && this.opts.verbose) {
          console.error('[Extractor] Cleanup error:', err);
        }
        if (this.opts.verbose) {
          console.log('[Extractor] Client cleaned up');
        }
        this.client = null;
        resolve();
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
