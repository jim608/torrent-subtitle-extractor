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
  timeout: number;
  trackers: string | string[];
  dht: boolean;
}

function parseTrackers(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap((x: any) => x.toString().split(',')).map((s: string) => s.trim()).filter(Boolean);
  }
  return input.toString().split(',').map((s: string) => s.trim()).filter(Boolean);
}

program
  .name('torrent-subx')
  .description('Advanced torrent subtitle extraction tool')
  .version('1.0.3');

program
  .command('extract')
  .description('Extract subtitles from torrents or magnet links')
  .argument('<sources...>', 'Torrent files or magnet links')
  .option('-o, --output <dir>', 'Output directory', './subs')
  .option('-e, --ext <extensions>', 'Preferred extensions (comma-separated)', 'ass,srt,vtt')
  .option('-l, --lang <languages>', 'Target languages (comma-separated)', 'zh,zh-TW,ja')
  .option('-t, --bilingual-threshold <number>', 'Bilingual detection threshold', '0.03')
  .option('-r, --rate-limit <size>', 'Download rate limit', '512k')
  .option('--timeout <ms>', 'Metadata timeout in milliseconds', '15000')
  .option('--trackers <list>', 'Additional trackers (comma-separated)', '')
  .option('--no-dht', 'Disable DHT')
  .option('--allow-full-download', 'Allow temporary full download if needed', false)
  .option('--emit-sup', 'Output PGS subtitle files (.sup)', false)
  .option('--skip-sup', 'Skip PGS subtitles completely', false)
  .option('--prefix-episode', 'Add episode prefix (S01E02)', true)
  .option('--keep-original-name', 'Append original filename', false)
  .option('-v, --verbose', 'Verbose logging', false)
  .action(async (sources: string[], options: CliOptions) => {
    const spinner = ora('Initializing subtitle extraction...').start();
    
    let extractor: TorrentExtractor | undefined;
    
    try {
      await fs.ensureDir(options.output);
      
      const trackers = parseTrackers(options.trackers);
      
      extractor = new TorrentExtractor({
        rateLimit: options.rateLimit,
        allowFullDownload: options.allowFullDownload,
        verbose: options.verbose,
        timeout: parseInt(options.timeout.toString()),
        trackers: trackers,
        dht: options.dht
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
          const torrentInfo = await extractor.parseTorrent(source);
          console.log(chalk.blue(`\nFound ${torrentInfo.files.length} files in torrent: ${torrentInfo.name}`));
          
          const candidates = await extractor.filterSubtitleCandidates(torrentInfo);
          console.log(chalk.green(`Found ${candidates.length} subtitle candidates`));
          
          if (candidates.length === 0) {
            console.log(chalk.yellow(`No subtitle files found in ${source}`));
            continue;
          }
          
          processor.setTorrentInfo(extractor, torrentInfo.infoHash!);
          
          let extractedCount = 0;
          for (const candidate of candidates) {
            spinner.text = `Extracting: ${candidate.path}`;
            
            const extracted = await processor.extractSubtitle(candidate);
            if (!extracted) {
              if (candidate.container !== 'external') {
                console.log(chalk.yellow(`Skipping embedded subtitle (not yet supported): ${candidate.path}`));
              }
              continue;
            }
            
            const language = await languageDetector.detect(extracted);
            
            const outputFilename = namingFormatter.format({
              originalPath: extracted.originalPath,
              language: language,
              extension: extracted.format
            });
            
            const outputPath = path.join(options.output, outputFilename);
            await fs.writeFile(outputPath, extracted.content);
            
            console.log(chalk.green(`✓ Saved: ${outputFilename}`));
            extractedCount++;
          }
          
          console.log(chalk.blue(`Completed ${extractedCount} extractions for ${torrentInfo.name}`));
          
        } catch (error) {
          console.error(chalk.red(`Error processing ${source}:`), (error as Error).message);
        }
      }
      
      spinner.succeed('Subtitle extraction completed!');
      
    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    } finally {
      if (extractor) {
        await extractor.cleanup();
      }
    }
  });

program
  .command('list')
  .description('List files in torrent without downloading')
  .argument('<source>', 'Torrent file or magnet link')
  .option('--timeout <ms>', 'Metadata timeout in milliseconds', '15000')
  .option('--trackers <list>', 'Additional trackers (comma-separated)', '')
  .option('--no-dht', 'Disable DHT')
  .option('-v, --verbose', 'Verbose logging', false)
  .action(async (source: string, options: any) => {
    const spinner = ora('Reading torrent info...').start();
    
    let extractor: TorrentExtractor | undefined;
    
    try {
      const trackers = parseTrackers(options.trackers);
      
      extractor = new TorrentExtractor({
        verbose: options.verbose,
        timeout: parseInt(options.timeout),
        trackers: trackers,
        dht: options.dht
      });
      
      const torrentInfo = await extractor.parseTorrent(source);
      
      spinner.succeed('Torrent info loaded');
      
      console.log(chalk.blue(`\nTorrent: ${torrentInfo.name}`));
      console.log(chalk.blue(`Files: ${torrentInfo.files.length}`));
      console.log(chalk.blue(`Total size: ${formatBytes(torrentInfo.length)}`));
      
      const candidates = await extractor.filterSubtitleCandidates(torrentInfo);
      
      console.log(chalk.green(`\nSubtitle candidates (${candidates.length}):`));
      candidates.forEach((file: any, index: number) => {
        const type = file.container === 'external' ? '[EXT]' : `[${file.container?.toUpperCase()}]`;
        console.log(`${index + 1}. ${type} ${file.path} (${formatBytes(file.length)})`);
      });
      
    } catch (error) {
      spinner.fail('Failed to read torrent');
      console.error(chalk.red('Error:'), (error as Error).message);
    } finally {
      if (extractor) {
        await extractor.cleanup();
      }
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
      console.error(chalk.red('Failed to start web server:'), (error as Error).message);
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
