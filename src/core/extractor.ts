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

// Lazy-loaded WebTorrent client
let WebTorrentClient: any = null;

// Initialize WebTorrent module (handles ESM/CommonJS compatibility)
async function getWebTorrentClient(): Promise<any> {
  if (WebTorrentClient === null) {
    try {
      // Use dynamic import for ESM compatibility
      const mod = await import('webtorrent');
      WebTorrentClient = (mod as any).default || mod;
    } catch (err) {
      throw new Error(`Failed to load WebTorrent: ${err}`);
    }
  }
  return WebTorrentClient;
}

// Create WebTorrent client instance
async function createWebTorrentClient(options: any): Promise<any> {
  const WebTorrent = await getWebTorrentClient();
  return new WebTorrent(options);
}

export class TorrentExtractor {
  private client: any = null;
  private clientReady: Promise<any>;
  
  constructor(private opts: ExtractorOptions = {}) {
    this.clientReady = this.initializeClient();
  }

  private async initializeClient(): Promise<any> {
    if (!this.client) {
      this.client = await createWebTorrentClient({
        dht: this.opts.dht !== false,
        tracker: true,
        lsd: true,
        maxConns: this.opts.allowFullDownload ? 100 : 10
      });
    }
    return this.client;
  }

  async parseTorrent(source: string): Promise<TorrentInfo> {
    const client = await this.clientReady;
    
    return new Promise((resolve, reject) => {
      const timeout = this.opts.timeout || 15000;
      let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
        timeoutHandle = null;
        reject(new Error(`Timeout after ${timeout}ms getting torrent metadata`));
      }, timeout);

      try {
        // Add default trackers if using magnet
        let torrentId = source;
        if (source.startsWith('magnet:') && this.opts.trackers) {
          const trackers = [...DEFAULT_TRACKERS, ...this.opts.trackers];
          const trackerParams = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
          if (!source.includes('&tr=')) {
            torrentId = source + trackerParams;
          }
        } else if (source.startsWith('magnet:') && !source.includes('&tr=')) {
          const trackerParams = DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');
          torrentId = source + trackerParams;
        }

        if (this.opts.verbose) {
          console.log('[Extractor] Adding torrent:', torrentId.length > 100 ? torrentId.slice(0, 100) + '...' : torrentId);
        }

        const torrent = client.add(torrentId, {
          announce: this.opts.trackers || DEFAULT_TRACKERS
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
            console.log(`[Extractor] Torrent ready: ${torrent.name}, ${files.length} files, ${this.formatBytes(torrent.length)}`);
          }

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
          
          torrent.removeListener('ready', handleReady);
          torrent.removeListener('error', handleError);
          
          reject(new Error(`Torrent error: ${err.message}`));
        };

        torrent.on('ready', handleReady);
        torrent.on('error', handleError);

        // Progress logging for verbose mode
        if (this.opts.verbose) {
          let lastProgress = -1;
          const progressInterval = setInterval(() => {
            if (torrent.ready) {
              clearInterval(progressInterval);
              return;
            }
            const progress = Math.floor(torrent.progress * 100);
            if (progress !== lastProgress && progress > 0) {
              console.log(`[Extractor] Metadata progress: ${progress}%`);
              lastProgress = progress;
            }
          }, 1000);
        }
      } catch (err) {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
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
        // Containers will be processed for embedded subtitles
        const containerType = lower.endsWith('.mkv') ? 'mkv' : 'mp4';
        candidates.push({
          path: file.path,
          length: file.length,
          container: containerType
        });
      }
    }

    if (this.opts.verbose) {
      console.log(`[Extractor] Found ${candidates.length} subtitle candidates:`);
      candidates.forEach(c => {
        console.log(`  ${c.container === 'external' ? '[EXT]' : '[' + c.container?.toUpperCase() + ']'} ${c.path} (${this.formatBytes(c.length)})`);
      });
    }

    return candidates;
  }

  async downloadFile(infoHash: string, filePath: string, outputPath: string): Promise<void> {
    const client = await this.clientReady;
    
    return new Promise((resolve, reject) => {
      try {
        // Find existing torrent by hash
        const torrent = client.get(infoHash);
        if (!torrent) {
          reject(new Error('Torrent not found for downloading'));
          return;
        }

        // Find the specific file
        const file = (torrent.files as any[]).find((f: any) => f.path === filePath);
        if (!file) {
          reject(new Error(`File not found: ${filePath}`));
          return;
        }

        if (this.opts.verbose) {
          console.log(`[Extractor] Downloading file: ${filePath} -> ${outputPath}`);
        }

        // Create readable stream and pipe to output
        const stream = file.createReadStream();
        const writeStream = createWriteStream(outputPath);
        
        stream.pipe(writeStream);
        
        stream.on('error', reject);
        writeStream.on('error', reject);
        
        writeStream.on('finish', () => {
          if (this.opts.verbose) {
            console.log(`[Extractor] Download completed: ${outputPath}`);
          }
          resolve();
        });
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
          console.error('[Extractor] Error during cleanup:', err);
        }
        if (this.opts.verbose) {
          console.log('[Extractor] WebTorrent client destroyed');
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
