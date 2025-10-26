import fs from 'fs-extra';
import path from 'path';
import { TorrentExtractor } from './extractor';

export interface ProcessorOptions {
  outputDir: string;
  extensions?: string[] | string;
  emitSup?: boolean;
  skipSup?: boolean;
}

export interface ExtractedSubtitle {
  format: 'ass' | 'srt' | 'vtt' | 'sup';
  content: Buffer;
  originalPath: string;
}

export interface SubtitleCandidate {
  path: string;
  length: number;
  container?: 'mkv' | 'mp4' | 'external';
  torrentFile?: any;
}

export class SubtitleProcessor {
  private preferred: string[];
  private extractor?: TorrentExtractor;
  private infoHash?: string;

  constructor(private opts: ProcessorOptions) {
    this.preferred = Array.isArray(opts.extensions)
      ? opts.extensions
      : (opts.extensions || 'ass,srt,vtt').split(',').map(s => s.trim());
  }

  setTorrentInfo(extractor: TorrentExtractor, infoHash: string) {
    this.extractor = extractor;
    this.infoHash = infoHash;
  }

  async extractSubtitle(candidate: SubtitleCandidate): Promise<ExtractedSubtitle | null> {
    if (candidate.container === 'external') {
      return await this.extractExternalSubtitle(candidate);
    } else if (candidate.container === 'mkv' || candidate.container === 'mp4') {
      // For now, just log that we found embedded subtitles
      // TODO: Implement MKV/MP4 embedded subtitle extraction
      console.log(`Found embedded subtitle container: ${candidate.path} (${candidate.container})`);
      console.log('Note: Embedded subtitle extraction not yet implemented');
      return null;
    }
    
    return null;
  }

  private async extractExternalSubtitle(candidate: SubtitleCandidate): Promise<ExtractedSubtitle | null> {
    const lower = candidate.path.toLowerCase();
    let ext: 'ass' | 'srt' | 'vtt' | 'sup' | null = null;
    
    if (lower.endsWith('.ass')) ext = 'ass';
    else if (lower.endsWith('.srt')) ext = 'srt';
    else if (lower.endsWith('.vtt')) ext = 'vtt';
    else if (lower.endsWith('.sup')) ext = 'sup';
    
    if (!ext) return null;
    if (ext === 'sup' && this.opts.skipSup) return null;
    if (ext === 'sup' && !this.opts.emitSup) return null;

    try {
      let content: Buffer;
      
      // If we have torrent info, download via WebTorrent
      if (this.extractor && this.infoHash) {
        const tempPath = path.join(this.opts.outputDir, '.temp_' + path.basename(candidate.path));
        await fs.ensureDir(path.dirname(tempPath));
        
        await this.extractor.downloadFile(this.infoHash, candidate.path, tempPath);
        content = await fs.readFile(tempPath);
        await fs.unlink(tempPath); // Clean up temp file
      } else {
        // Fallback: try to read as local file
        content = await fs.readFile(candidate.path);
      }
      
      return {
        format: ext,
        content: content,
        originalPath: candidate.path
      };
    } catch (error) {
      console.error(`Failed to extract ${candidate.path}:`, error);
      return null;
    }
  }

  async listEmbeddedTracks(candidate: SubtitleCandidate): Promise<any[]> {
    if (candidate.container === 'mkv') {
      return await this.listMkvTracks(candidate);
    } else if (candidate.container === 'mp4') {
      return await this.listMp4Tracks(candidate);
    }
    return [];
  }

  private async listMkvTracks(candidate: SubtitleCandidate): Promise<any[]> {
    // TODO: Implement MKV track listing using mkvmerge
    console.log(`Would list MKV tracks for: ${candidate.path}`);
    return [];
  }

  private async listMp4Tracks(candidate: SubtitleCandidate): Promise<any[]> {
    // TODO: Implement MP4 stream listing using ffprobe
    console.log(`Would list MP4 streams for: ${candidate.path}`);
    return [];
  }
}