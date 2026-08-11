# Torrent Subtitle Extractor

[![CI](https://github.com/jim608/torrent-subtitle-extractor/actions/workflows/ci.yml/badge.svg)](https://github.com/jim608/torrent-subtitle-extractor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen.svg)](package.json)

A TypeScript tool for discovering and selectively downloading subtitle files from `.torrent` files and magnet links, with Chinese/Japanese language heuristics, standardized naming, CLI workflows, and a basic Web UI.

繁體中文：這是一個用來從 torrent / magnet 中找出字幕候選檔並優先下載字幕的開源工具，支援繁中、簡中、日文與中日雙語的基本辨識及標準化命名。

## Why this project exists

Large media torrents often contain subtitle files that are tiny compared with the video payload. Torrent Subtitle Extractor is designed to inspect torrent metadata, identify subtitle candidates, and retrieve the subtitle files without intentionally downloading the full video payload when the subtitle is available as a separate file.

The project focuses on:

- selective subtitle retrieval through WebTorrent
- `.torrent` files and magnet links
- ASS, SRT, VTT, and optional PGS/SUP output
- heuristic Traditional Chinese, Simplified Chinese, Japanese, and mixed Chinese/Japanese detection
- standardized language-aware filenames
- episode-prefix detection such as `S01E02`
- CLI and Web UI workflows

## Project status

The project is actively maintained and currently targets Node.js 18 or newer.

**Implemented today:** external subtitle files contained in a torrent can be discovered and downloaded selectively.

**In progress / not yet implemented:** extracting embedded subtitle tracks from MKV or MP4 containers. The current code can identify container candidates, but embedded-track extraction is intentionally reported as unsupported instead of pretending that it succeeded.

This distinction matters because the project aims to keep documentation aligned with actual behavior.

## Quick start

### Requirements

- Node.js 18+
- npm or Bun

Clone and build:

```bash
git clone https://github.com/jim608/torrent-subtitle-extractor.git
cd torrent-subtitle-extractor
npm install
npm run build
```

### Inspect a torrent without downloading files

```bash
node dist/cli.js list example.torrent
node dist/cli.js list "magnet:?xt=urn:btih:..."
```

Development mode:

```bash
npm run dev -- list example.torrent
```

### Extract external subtitle files

```bash
node dist/cli.js extract example.torrent
node dist/cli.js extract example.torrent --output ./subtitles
node dist/cli.js extract file1.torrent file2.torrent "magnet:?xt=..." --output ./subs
```

Example with additional options:

```bash
node dist/cli.js extract example.torrent \
  --output ./subs \
  --ext ass,srt,vtt \
  --lang zh,zh-TW,ja \
  --rate-limit 512k \
  --emit-sup \
  --prefix-episode \
  --verbose
```

On Windows, quote magnet links containing `&tr=` parameters.

## CLI commands

### `list`

Reads torrent metadata and lists files and subtitle candidates without intentionally downloading the media payload.

```bash
node dist/cli.js list <torrent-or-magnet> [options]
```

Useful options:

- `--timeout <ms>` metadata timeout
- `--trackers <list>` additional comma-separated trackers
- `--no-dht` disable DHT
- `--verbose` detailed output

### `extract`

Downloads supported external subtitle candidates and writes normalized output filenames.

```bash
node dist/cli.js extract <sources...> [options]
```

Common options:

| Option | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `./subs` | Output directory |
| `-e, --ext <extensions>` | `ass,srt,vtt` | Preferred subtitle extensions |
| `-l, --lang <languages>` | `zh,zh-TW,ja` | Target language preference |
| `-r, --rate-limit <size>` | `512k` | Download rate limit |
| `--timeout <ms>` | `15000` | Metadata timeout |
| `--trackers <list>` | empty | Additional trackers |
| `--no-dht` | off | Disable DHT |
| `--allow-full-download` | false | Allow fallback behavior when required |
| `--emit-sup` | false | Allow PGS/SUP output |
| `--skip-sup` | false | Skip PGS/SUP candidates |
| `--prefix-episode` | true | Add an `S01E02`-style prefix when detected |
| `--keep-original-name` | false | Preserve additional original-name context where supported |
| `-v, --verbose` | false | Verbose logging |

## Web UI

Start the Web UI through the CLI:

```bash
node dist/cli.js web --host 0.0.0.0 --port 3000
```

Or in development mode:

```bash
npm run dev -- web --host 0.0.0.0 --port 3000
```

Then open `http://localhost:3000` when using the default host and port.

The Web UI currently provides a basic upload / magnet-link extraction workflow. It shares the same current limitation as the CLI: embedded subtitle extraction from MKV/MP4 is not yet implemented.

## Language detection

Language detection currently uses lightweight text heuristics rather than a heavyweight language model.

The detector checks for:

- Japanese kana
- representative Traditional Chinese characters
- representative Simplified Chinese characters
- mixed Chinese/Japanese text

Current language labels include:

- `zh-TW` → Traditional Chinese
- `zh` → Simplified Chinese
- `ja` → Japanese
- mixed Traditional Chinese + Japanese
- mixed Simplified Chinese + Japanese
- unknown

This approach is fast and dependency-light, but contributors are welcome to improve its accuracy.

## Output naming

Examples:

```text
繁體-繁體中文.zh-TW.ass
简体-简体中文.zh.srt
日文.ja.vtt
S01E02-繁體-繁體中文.zh-TW.ass
```

## Architecture

```text
src/
├── cli.ts
├── core/
│   ├── extractor.ts
│   ├── processor.ts
│   ├── language.ts
│   └── naming.ts
├── types/
│   └── webtorrent.d.ts
└── web/
    ├── server.ts
    └── static/
```

`extractor.ts` handles torrent metadata and selective downloading. `processor.ts` handles subtitle candidates and output. `language.ts` performs lightweight language classification. `naming.ts` creates normalized filenames. The Web UI uses the same core modules as the CLI.

## Development

```bash
npm install
npm run build
npm run dev -- list example.torrent
npm run dev -- web --port 3000
```

The repository includes a GitHub Actions build workflow for supported Node.js versions.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, bug-report requirements, and pull-request guidance.

Please do not upload copyrighted media, private tracker credentials, or other sensitive torrent data to public issues.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability-reporting guidance. Sensitive security details should not be posted publicly.

## Maintainer

Primary maintainer: [@jim608](https://github.com/jim608)

## License

MIT License. See [LICENSE](LICENSE).

## Legal use

This project is intended for lawful subtitle extraction and processing. Users are responsible for complying with applicable copyright law, service terms, and tracker rules.
