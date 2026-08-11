# Contributing

Thanks for helping improve Torrent Subtitle Extractor.

## Before you start

- Use Node.js 18 or newer.
- Search existing issues before opening a new one.
- Keep bug reports focused on reproducible behavior.
- Do not attach copyrighted media or torrent content that you are not authorized to share.

## Development setup

```bash
git clone https://github.com/jim608/torrent-subtitle-extractor.git
cd torrent-subtitle-extractor
npm install
npm run build
```

Run the CLI in development mode:

```bash
npm run dev -- list example.torrent
npm run dev -- extract example.torrent --output ./subs
npm run dev -- web --port 3000
```

## Pull requests

1. Create a focused branch for one change.
2. Keep behavior changes and refactors separate when practical.
3. Run `npm run build` before opening the pull request.
4. Describe what changed, why it changed, and how you tested it.
5. Mention any compatibility impact for Windows, macOS, Linux, Node.js, WebTorrent, FFmpeg, or MKVToolNix when relevant.

## Bug reports

Please include:

- Operating system and version
- Node.js version
- Command used, with private tracker tokens or credentials removed
- Expected behavior
- Actual behavior and complete error output
- Whether the source is a `.torrent` file or magnet link
- Subtitle/container format involved

## Feature requests

Explain the user problem first, then the proposed behavior. For format or language-detection changes, include a minimal non-copyrighted sample when possible.

## Scope

This project is intended for lawful subtitle extraction and processing. Contributions that primarily enable copyright infringement, credential theft, malware, or abuse are out of scope.
