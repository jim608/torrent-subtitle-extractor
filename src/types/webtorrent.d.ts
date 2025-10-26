declare module 'webtorrent' {
  interface TorrentFile {
    path: string;
    length: number;
    createReadStream(): NodeJS.ReadableStream;
  }

  interface Torrent {
    name: string;
    length: number;
    files: TorrentFile[];
    infoHash: string;
    progress: number;
    ready: boolean;
    on(event: 'ready', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
  }

  interface WebTorrentInstance {
    add(torrentId: string, options?: any): Torrent;
    get(torrentId: string): Torrent | null;
    destroy(callback?: () => void): void;
  }

  interface WebTorrentOptions {
    dht?: boolean;
    tracker?: boolean;
    lsd?: boolean;
    maxConns?: number;
  }

  interface WebTorrentStatic {
    new (options?: WebTorrentOptions): WebTorrentInstance;
  }

  const WebTorrent: WebTorrentStatic;
  export default WebTorrent;
}
