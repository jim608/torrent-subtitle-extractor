#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { TorrentExtractor } from './core/extractor';
import { SubtitleProcessor } from './core/processor';
import { LanguageDetector } from './core/language';
import { NamingFormatter } from './core/naming';

const program = new Command();

interface CliOptions {
  output: string;
  extensions: string[];
  languages: string[];
  bilingualThreshold: number;
  rateLimit: string;
  allowFullDownload: boolean;
  emitSup: boolean;
  skipSup: boolean;
  prefixEpisode: boolean;
  keepOriginalName: boolean;
  verbose: boolean;
}

program
  .name('torrent-subx')
  .description('Advanced torrent subtitle extraction tool')
  .version('1.0.0');

program
  .command('extract')
  .description('Extract subtitles from torrents or magnet links')
  .argument('<sources...>', 'Torrent files or magnet links')
  .option('-o, --output <dir>', 'Output directory', './subs')
  .option('-e, --ext <extensions>', 'Preferred extensions (comma-separated)', 'ass,srt,vtt')
  .option('-l, --lang <languages>', 'Target languages (comma-separated)', 'zh,zh-TW,ja')
  .option('-t, --bilingual-threshold <number>', 'Bilingual detection threshold', '0.03')
  .option('-r, --rate-limit <size>', 'Download rate limit', '512k')
  .option('--allow-full-download', 'Allow temporary full download if needed', false)
  .option('--emit-sup', 'Output PGS subtitle files (.sup)', false)
  .option('--skip-sup', 'Skip PGS subtitles completely', false)
  .option('--prefix-episode', 'Add episode prefix (S01E02)', true)
  .option('--keep-original-name', 'Append original filename', false)
  .option('-v, --verbose', 'Verbose logging', false)
  .action(async (sources: string[], options: CliOptions) => {
    const spinner = ora('Initializing subtitle extraction...').start();
    
    try {
      // Ensure output directory exists
      await fs.ensureDir(options.output);
      
      const extractor = new TorrentExtractor({
        rateLimit: options.rateLimit,
        allowFullDownload: options.allowFullDownload,
        verbose: options.verbose
      });
      
      const processor = new SubtitleProcessor({
        outputDir: options.output,
        extensions: options.extensions,
        emitSup: options.emitSup,
        skipSup: options.skipSup
      });
      
      const languageDetector = new LanguageDetector({
        threshold: parseFloat(options.bilingualThreshold.toString())
      });
      
      const namingFormatter = new NamingFormatter({
        prefixEpisode: options.prefixEpisode,
        keepOriginalName: options.keepOriginalName
      });
      
      for (const source of sources) {
        spinner.text = `Processing: ${path.basename(source)}`;
        
        try {
          // Step 1: Parse torrent and get file list
          const torrentInfo = await extractor.parseTorrent(source);
          console.log(chalk.blue(`\\nFound ${torrentInfo.files.length} files in torrent`));
          
          // Step 2: Filter subtitle candidates
          const candidates = await extractor.filterSubtitleCandidates(torrentInfo);
          console.log(chalk.green(`Found ${candidates.length} subtitle candidates`));
          
          if (candidates.length === 0) {
            console.log(chalk.yellow(`No subtitle files found in ${source}`));
            continue;
          }
          
          // Step 3: Extract subtitles
          for (const candidate of candidates) {
            spinner.text = `Extracting: ${candidate.path}`;
            
            const extracted = await processor.extractSubtitle(candidate);
            if (!extracted) continue;
            
            // Step 4: Detect language
            const language = await languageDetector.detect(extracted);
            
            // Step 5: Generate output filename
            const outputFilename = namingFormatter.format({
              originalPath: candidate.path,
              language: language,
              extension: extracted.format
            });
            
            // Step 6: Save to output directory
            const outputPath = path.join(options.output, outputFilename);
            await fs.writeFile(outputPath, extracted.content);
            
            console.log(chalk.green(`✓ Saved: ${outputFilename}`));
          }
          
        } catch (error) {
          console.error(chalk.red(`Error processing ${source}:`), error);
        }
      }
      
      spinner.succeed('Subtitle extraction completed!');
      
    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List files in torrent without downloading')
  .argument('<source>', 'Torrent file or magnet link')
  .action(async (source: string) => {
    const spinner = ora('Reading torrent info...').start();
    
    try {
      const extractor = new TorrentExtractor({ verbose: true });
      const torrentInfo = await extractor.parseTorrent(source);
      
      spinner.succeed('Torrent info loaded');
      
      console.log(chalk.blue(`\\nTorrent: ${torrentInfo.name}`));
      console.log(chalk.blue(`Files: ${torrentInfo.files.length}`));
      console.log(chalk.blue(`Total size: ${formatBytes(torrentInfo.length)}`));
      
      const candidates = await extractor.filterSubtitleCandidates(torrentInfo);
      
      console.log(chalk.green(`\\nSubtitle candidates (${candidates.length}):`));
      candidates.forEach((file, index) => {
        console.log(`${index + 1}. ${file.path} (${formatBytes(file.length)})`);
      });
      
    } catch (error) {
      spinner.fail('Failed to read torrent');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('web')
  .description('Start web interface')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('-h, --host <string>', 'Host address', 'localhost')
  .action(async (options) => {
    console.log(chalk.blue('Starting web interface...'));
    
    try {
      const { startWebServer } = await import('./web/server');
      await startWebServer({
        port: parseInt(options.port),
        host: options.host
      });
    } catch (error) {
      console.error(chalk.red('Failed to start web server:'), error);
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

if (require.main === module) {
  program.parse();
}