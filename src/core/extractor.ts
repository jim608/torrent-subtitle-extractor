export interface TorrentInfoFile {
  path: string;
  length: number;
}

export interface TorrentInfo {
  name: string;
  length: number;
  files: TorrentInfoFile[];
}

export interface ExtractorOptions {
  rateLimit?: string;
  allowFullDownload?: boolean;
  verbose?: boolean;
}

export interface SubtitleCandidate {
  path: string;
  length: number;
  container?: 'mkv' | 'mp4' | 'external';
}

export class TorrentExtractor {
  constructor(private opts: ExtractorOptions = {}) {}

  async parseTorrent(source: string): Promise<TorrentInfo> {
    // Minimal stub: returns a fake structure so CLI can compile/run help
    // TODO: Implement real torrent parsing and metadata retrieval
    return {
      name: source,
      length: 0,
      files: []
    };
  }

  async filterSubtitleCandidates(info: TorrentInfo): Promise<SubtitleCandidate[]> {
    // Minimal stub: filter by common subtitle extensions
    const exts = ['.ass', '.ssa', '.srt', '.vtt', '.sup', '.mkv', '.mp4'];
    return info.files.filter(f => exts.some(e => f.path.toLowerCase().endsWith(e))).map(f => ({
      path: f.path,
      length: f.length,
      container: f.path.toLowerCase().endsWith('.mkv') ? 'mkv' : f.path.toLowerCase().endsWith('.mp4') ? 'mp4' : 'external'
    }));
  }
}
