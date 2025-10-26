# Torrent Subtitle Extractor

Advanced torrent subtitle extraction tool with multi-language detection, container format support, and intelligent naming.

## 功能特色

- 🚀 **選擇性下載**：僅下載字幕檔案，不下載完整影片
- 📁 **多容器支援**：支援 MKV、MP4 內嵌字幕抽取
- 🌐 **多語言偵測**：自動識別簡體、繁體、日文與雙語字幕
- 🏷️ **智能命名**：自動依語言生成標準化檔名
- 📺 **季集識別**：自動加入 S01E02 前綴
- 🎨 **圖形字幕**：支援 PGS (.sup) 字幕輸出
- 🌐 **Web 介面**：提供友善的網頁上傳與管理介面
- ⚡ **批次處理**：同時處理多個 torrent 或磁力連結

## 安裝需求

### 系統需求

- Node.js >= 18.0.0
- npm 或 bun

### 外部依賴

必須先安裝以下工具：

#### MKVToolNix (處理 MKV 檔案)

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install mkvtoolnix

# macOS
brew install mkvtoolnix

# Windows
# 下載安裝： https://mkvtoolnix.download/
```

#### FFmpeg (處理 MP4 檔案)

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# 下載安裝： https://ffmpeg.org/download.html
```

## 安裝

```bash
# 複製專案
git clone https://github.com/jim608/torrent-subtitle-extractor.git
cd torrent-subtitle-extractor

# 安裝依賴
npm install
# 或使用 bun（推薦，更快速）
bun install

# 編譯 TypeScript
npm run build
# 或
bun run build
```

## 使用方法

### CLI 命令列

#### 1. 列出檔案 (不下載)

```bash
# 查看 torrent 內容與字幕候選
node dist/cli.js list example.torrent
node dist/cli.js list "magnet:?xt=urn:btih:..."

# 使用開發模式（需要先更新到最新版本）
npm run dev list example.torrent
```

#### 2. 抽取字幕

```bash
# 基本用法
node dist/cli.js extract example.torrent

# 指定輸出目錄
node dist/cli.js extract example.torrent --output ./subtitles

# 多個來源批次處理
node dist/cli.js extract file1.torrent file2.torrent "magnet:?xt=..." --output ./subs

# 進階選項
node dist/cli.js extract example.torrent \
  --output ./subs \
  --ext ass,srt,vtt \
  --lang zh,zh-TW,ja \
  --bilingual-threshold 0.03 \
  --rate-limit 512k \
  --allow-full-download \
  --emit-sup \
  --prefix-episode \
  --verbose
```

#### 3. 啟動 Web 介面

```bash
# 預設 localhost:3000
npm run web

# 指定埠號與主機
npm run dev web --port 8080 --host 0.0.0.0
```

**重要提醒：**
- Windows 系統上，包含 `&tr=` 參數的 magnet 連結必須用雙引號包圍
- 建議使用編譯後的版本 (`node dist/cli.js`) 以獲得最佳穩定性

### 命令選項說明

| 選項 | 預設值 | 說明 |
|------|--------|------|
| `-o, --output <dir>` | `./subs` | 輸出目錄 |
| `-e, --ext <extensions>` | `ass,srt,vtt` | 偏好的字幕格式 |
| `-l, --lang <languages>` | `zh,zh-TW,ja` | 目標語言 |
| `-t, --bilingual-threshold <number>` | `0.03` | 雙語偵測閾值 |
| `-r, --rate-limit <size>` | `512k` | 下載速率限制 |
| `--timeout <ms>` | `15000` | Metadata 取得超時 |
| `--allow-full-download` | `false` | 必要時允許完整下載 |
| `--emit-sup` | `false` | 輸出 PGS 字幕檔 (.sup) |
| `--skip-sup` | `false` | 完全跳過 PGS 字幕 |
| `--prefix-episode` | `true` | 加入季集前綴 (S01E02) |
| `--keep-original-name` | `false` | 保留原始檔名 |
| `-v, --verbose` | `false` | 詳細日誌 |

## 輸出檔名規則

### 單語言字幕

- 簡體中文：`简体-简体中文.zh.ass`
- 繁體中文：`繁體-繁體中文.zh-TW.ass`  
- 日文：`日文.ja.srt`

### 雙語字幕

- 繁體+日文：`繁日-繁日雙語.zh-TW.ass`
- 簡體+日文：`簡日-簡日雙語.zh.ass`

### 圖形字幕

- PGS 字幕：`圖形字幕.sup`

### 多字幕軌道

同語言多條字幕會加入序號：
- `繁體-繁體中文.zh-TW.2.ass`
- `简体-简体中文.zh.3.ass`

### 季集前綴 (開啟 --prefix-episode)

- `S01E02-繁體-繁體中文.zh-TW.ass`
- `S02E15-繁日-繁日雙語.zh-TW.ass`

## Web 介面

啟動 Web 服務後，在瀏覽器開啟 http://localhost:3000

### 功能

- 📤 上傳 .torrent 檔案或貼上磁力連結
- 📋 預覽檔案列表與字幕軌道
- ⚙️ 設定語言與格式偏好  
- 📊 即時顯示處理進度
- 💾 批次下載處理結果

## 語言偵測

### 偵測層級

1. **Metadata 層**：檢查容器的語言標籤與軌道名稱
2. **檔名層**：分析檔名中的語言標示 (chs, cht, tc, sc, jp, 簡, 繁, 日)
3. **內容層**：抽樣分析文字內容判斷語言特徵

### 雙語判斷

- 繁體字形比例 + 假名比例 > 閾值 → 繁日雙語
- 簡體字形比例 + 假名比例 > 閾值 → 簡日雙語  
- 軌道名稱包含 "雙語"、"繁日"、"簡日" → 直接判定

## 支援格式

### 容器格式

- **MKV**：Matroska 容器，支援內嵌 ASS/SRT/VTT/PGS 字幕
- **MP4**：MPEG-4 容器，支援 mov_text/tx3g 字幕

### 字幕格式

- **ASS/SSA**：Advanced SubStation Alpha (保留樣式)
- **SRT**：SubRip (純文字)
- **VTT**：WebVTT (網頁字幕)
- **PGS**：Presentation Graphic Stream (圖形字幕)

## 故障排除

### 常見錯誤

#### "mkvextract not found"

```bash
# 確認 MKVToolNix 已安裝
which mkvextract
mkvextract --version

# 若未安裝，參考上方安裝指令
```

#### "ffmpeg not found"

```bash
# 確認 FFmpeg 已安裝
which ffmpeg
ffmpeg -version

# 若未安裝，參考上方安裝指令
```

#### "No subtitle files found"

可能原因：
- Torrent 內真的沒有字幕檔案
- 字幕內嵌在容器中，但偵測失敗
- 檔名不符合字幕格式規則

解決方法：

```bash
# 先用 list 命令檢查檔案列表
node dist/cli.js list example.torrent

# 使用 --verbose 查看詳細日誌
node dist/cli.js extract example.torrent --verbose

# 嘗試允許完整下載
node dist/cli.js extract example.torrent --allow-full-download

# 增加超時時間
node dist/cli.js extract example.torrent --timeout 30000
```

#### ESM/CommonJS 模組錯誤

如果遇到模組載入錯誤，請：

```bash
# 清理並重新編譯
npm run clean
npm run build

# 使用編譯後版本
node dist/cli.js list "your-magnet-link"
```

#### 編碼問題

如果字幕出現亂碼：
- 工具會自動偵測並轉換為 UTF-8
- 支援 Big5、GBK、Shift-JIS 等編碼
- 若仍有問題，請回報具體檔案供改進偵測邏輯

### 效能調整

#### 限制下載速度

```bash
# 限制為 256KB/s
node dist/cli.js extract example.torrent --rate-limit 256k

# 限制為 1MB/s  
node dist/cli.js extract example.torrent --rate-limit 1m
```

#### 記憶體使用

```bash
# 設定 Node.js 記憶體上限
node --max-old-space-size=4096 dist/cli.js extract example.torrent
```

## 開發

### 開發模式

```bash
# 監視檔案變更並重新編譯
npm run dev

# 執行測試
npm test

# 程式碼檢查
npm run lint

# 清理編譯檔案
npm run clean
```

### 專案結構

```
src/
├── cli.ts                 # CLI 入口點
├── core/                  # 核心功能模組
│   ├── extractor.ts       # Torrent 解析與選擇性下載
│   ├── processor.ts       # 字幕檔案處理
│   ├── language.ts        # 語言偵測
│   └── naming.ts          # 檔名格式化
├── types/                 # TypeScript 型別定義
│   └── webtorrent.d.ts    # WebTorrent 型別
└── web/                   # Web 介面
    ├── server.ts          # Express 服務器
    ├── routes/            # API 路由
    └── static/            # 靜態檔案
```

## 授權

MIT License - 詳見LICENSE 檔案

## 貢獻

歡迎提交 Issue 和 Pull Request！

### 回報問題

- 提供完整的錯誤訊息
- 包含作業系統與 Node.js 版本
- 如可能，提供測試用的 torrent 檔案

### 功能建議

- 描述具體使用情境
- 說明預期行為
- 考慮向後相容性

**注意**：本工具僅用於合法的字幕提取用途，請遵守當地法律法規。