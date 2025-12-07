import express from 'express';
import multer from 'multer';
import path from 'path';
import { TorrentExtractor, type ExtractorOptions } from '../core/extractor';
import { SubtitleProcessor, type ProcessorOptions } from '../core/processor';
import fs from 'fs-extra';

export interface WebOptions { 
  port: number; 
  host: string; 
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function startWebServer(opts: WebOptions) {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Serve static files
  app.use(express.static(path.join(__dirname, '../web/static')));
  
  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.3' });
  });
  
  // Upload and extract endpoint
  app.post('/api/extract', upload.single('torrent'), async (req, res) => {
    let tempDir = '';
    let torrentFilePath = '';
    let extractor: TorrentExtractor | null = null;
    
    try {
      if (!req.file && !req.body.magnetLink) {
        return res.status(400).json({ error: 'No file uploaded or magnet link provided', success: false });
      }
      
      tempDir = path.join(__dirname, '../../temp-' + Date.now());
      await fs.ensureDir(tempDir);
      
      // Prepare torrent source
      let torrentSource: string;
      if (req.file) {
        torrentFilePath = path.join(tempDir, req.file.originalname);
        await fs.writeFile(torrentFilePath, req.file.buffer);
        torrentSource = torrentFilePath;
      } else {
        torrentSource = req.body.magnetLink;
      }
      
      // Parse extraction options
      const langs = (req.body.lang || 'zh,zh-TW,ja').split(',').map((s: string) => s.trim());
      const exts = (req.body.ext || 'ass,srt,vtt').split(',').map((s: string) => s.trim());
      const verbose = req.body.verbose === 'true';
      
      // Create extractor
      const extractorOpts: ExtractorOptions = {
        verbose,
        timeout: 30000
      };
      
      extractor = new TorrentExtractor(extractorOpts);
      
      // Parse torrent
      console.log(`[Web] Parsing torrent: ${torrentSource.slice(0, 60)}...`);
      const torrentInfo = await extractor.parseTorrent(torrentSource);
      console.log(`[Web] Found torrent: ${torrentInfo.name} with ${torrentInfo.files.length} files`);
      
      // Filter subtitle candidates
      const candidates = await extractor.filterSubtitleCandidates(torrentInfo);
      console.log(`[Web] Found ${candidates.length} subtitle candidates`);
      
      if (candidates.length === 0) {
        return res.json({ 
          success: true, 
          subtitles: [],
          message: 'No subtitle files found in torrent'
        });
      }
      
      // Create processor
      const outputDir = path.join(tempDir, 'output');
      const processorOpts: ProcessorOptions = {
        outputDir,
        extensions: exts,
        skipSup: !req.body.emitSup
      };
      
      const processor = new SubtitleProcessor(processorOpts);
      processor.setTorrentInfo(extractor, torrentInfo.infoHash || '');
      
      // Extract subtitles
      const results: string[] = [];
      for (const candidate of candidates) {
        try {
          const extracted = await processor.extractSubtitle(candidate);
          if (extracted) {
            const outputPath = path.join(outputDir, path.basename(candidate.path));
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, extracted.content);
            results.push(`✓ ${path.basename(candidate.path)}`);
            console.log(`[Web] Extracted: ${path.basename(candidate.path)}`);
          }
        } catch (error) {
          console.error(`[Web] Error extracting ${candidate.path}:`, error);
          results.push(`✗ ${path.basename(candidate.path)}`);
        }
      }
      
      res.json({ 
        success: true, 
        subtitles: results,
        torrentName: torrentInfo.name,
        outputDir
      });
      
    } catch (error) {
      console.error('[Web] Extraction error:', error);
      res.status(500).json({ 
        error: String(error),
        success: false
      });
    } finally {
      // Cleanup
      if (extractor) {
        try {
          await extractor.cleanup();
          console.log('[Web] Extractor cleaned up');
        } catch (err) {
          console.error('[Web] Cleanup error:', err);
        }
      }
      
      // Delete temp directory
      if (tempDir && await fs.pathExists(tempDir)) {
        try {
          await fs.remove(tempDir);
        } catch (err) {
          console.error('[Web] Failed to remove temp dir:', err);
        }
      }
    }
  });
  
  // Serve index.html for all non-API routes
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../web/static/index.html'));
  });
  
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../web/static/index.html'));
  });
  
  await new Promise<void>((resolve) => {
    app.listen(opts.port, opts.host, () => resolve());
  });
  
  // eslint-disable-next-line no-console
  console.log(`\n🎬 Web UI listening at http://${opts.host}:${opts.port}\n`);
}
