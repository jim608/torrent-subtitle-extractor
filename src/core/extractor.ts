import WebTorrent from 'webtorrent';
import { promises as fs } from 'fs';
import path from 'path';

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
  torrentFile?: any; // WebTorrent file object for downloading
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

export class TorrentExtractor {
  private client: WebTorrent.Instance;
  
  constructor(private opts: ExtractorOptions = {}) {
    this.client = new (WebTorrent as any)({
      dht: opts.dht !== false,
      tracker: true,
      lsd: true,
      maxConns: opts.allowFullDownload ? 100 : 10
    }) as WebTorrent.Instance;
  }

  async parseTorrent(source: string): Promise<TorrentInfo> {
    return new Promise((resolve, reject) => {
      const timeout = this.opts.timeout || 15000;
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout after ${timeout}ms getting torrent metadata`));
      }, timeout);

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
        console.log('Adding torrent with trackers:', torrentId.length > 100 ? torrentId.slice(0, 100) + '...' : torrentId);
      }

      const torrent = (this.client as any).add(torrentId, {
        announce: this.opts.trackers || DEFAULT_TRACKERS
      });

      torrent.on('ready', () => {
        clearTimeout(timeoutHandle);
        
        const files: TorrentInfoFile[] = torrent.files.map((file: any) => ({
          path: file.path,
          length: file.length
        }));

        if (this.opts.verbose) {
          console.log(`Torrent ready: ${torrent.name}, ${files.length} files, ${torrent.length} bytes`);
        }

        resolve({
          name: torrent.name,
          length: torrent.length,
          files: files,
          infoHash: torrent.infoHash
        });
      });

      torrent.on('error', (err: any) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Torrent error: ${err.message}`));
      });

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
            console.log(`Metadata progress: ${progress}%`);
            lastProgress = progress;
          }
        }, 1000);
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
      console.log(`Found ${candidates.length} subtitle candidates:`);
      candidates.forEach(c => {
        console.log(`  ${c.container === 'external' ? '[EXT]' : '[' + c.container?.toUpperCase() + ']'} ${c.path} (${this.formatBytes(c.length)})`);
      });
    }

    return candidates;
  }

  async downloadFile(infoHash: string, filePath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Find existing torrent by hash
      const torrent = (this.client as any).get(infoHash);
      if (!torrent) {
        reject(new Error('Torrent not found for downloading'));
        return;
      }

      // Find the specific file
      const file = torrent.files.find((f: any) => f.path === filePath);
      if (!file) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      if (this.opts.verbose) {
        console.log(`Downloading file: ${filePath} -> ${outputPath}`);
      }

      // Create readable stream and pipe to output
      const stream = file.createReadStream();
      const writeStream = require('fs').createWriteStream(outputPath);
      
      stream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        if (this.opts.verbose) {
          console.log(`Download completed: ${outputPath}`);
        }
        resolve();
      });

      stream.on('error', reject);
      writeStream.on('error', reject);
    });
  }

  async cleanup(): Promise<void> {
    return new Promise((resolve) => {
      (this.client as any).destroy(() => {
        if (this.opts.verbose) {
          console.log('WebTorrent client destroyed');
        }
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