import express from 'express';
import multer from 'multer';
import path from 'path';
import { extractSubtitles } from '../core/extractor';
import { processSubtitles } from '../core/processor';
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
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const tempDir = path.join(__dirname, '../../temp');
      await fs.ensureDir(tempDir);
      
      const tempFile = path.join(tempDir, req.file.originalname);
      await fs.writeFile(tempFile, req.file.buffer);
      
      // Extract subtitles
      const extractOptions = {
        output: path.join(tempDir, 'output'),
        ext: (req.body.ext || 'ass,srt,vtt').split(','),
        lang: (req.body.lang || 'zh,zh-TW,ja').split(','),
        rateLimit: req.body.rateLimit || '512k',
        bilingual: parseFloat(req.body.bilingual || '0.03'),
      };
      
      const results = await extractSubtitles(tempFile, extractOptions);
      
      // Clean up temp file
      await fs.remove(tempFile);
      
      res.json({ 
        success: true, 
        subtitles: results,
        outputDir: extractOptions.output
      });
    } catch (error) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Serve index.html for all non-API routes
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../web/static/index.html'));
  });
  
  await new Promise<void>((resolve) => {
    app.listen(opts.port, opts.host, () => resolve());
  });
  
  // eslint-disable-next-line no-console
  console.log(`Web UI listening at http://${opts.host}:${opts.port}`);
}
