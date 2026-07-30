# AZZAVISION AI — Trading Signal Bot

**Versi aktif: v5.7**  
**Platform:** Telegram Bot + Web Dashboard  
**Runtime:** Node.js 22 (Docker: `ghcr.io/parkervcp/yolks:nodejs_22`)  
**Hosted:** Pterodactyl Panel — `serverku.lynzzofficial.com`  
**Port:** `2389`  
**Entry point:** `node launcher.js`

---

## Deskripsi

AZZAVISION AI adalah bot Telegram untuk sinyal trading Forex (XAUUSD, pair lain) berbasis AI dengan **dua engine independen** yang berjalan secara paralel:

1. **Signal Engine (Realtime)** — Menghasilkan sinyal entry berbasis price action + indikator teknikal secara realtime. Sinyal dikirim otomatis ke channel Telegram.
2. **Trade Scanner AI Engine** — Memberikan *setup market* (zona entry, bukan harga saat ini) untuk timeframe SHORT (1-8 jam), MEDIUM (1-3 hari), dan LONG (1-2 minggu).

Selain sinyal, bot memiliki **dashboard web** yang bisa diakses via Cloudflare Tunnel, dan berbagai fitur analitik untuk tracking performa.

---

## Fitur Utama

| Fitur | Keterangan |
|---|---|
| **Dual AI Engine** | Signal Engine (realtime) + Trade Scanner (setup market) berjalan paralel |
| **News Intelligence** | Filter sinyal berdasarkan dampak news (blockEntry, alignment check) |
| **E-Book Strategy** | Engine berbasis strategi dari strategy_library.js, berjalan hybrid dengan signal engine |
| **Signal Lifecycle** | WAITING → ACTIVE → TP1_HIT / TP2_HIT / SL_HIT / EXPIRED |
| **Signal Lock** | Tidak bisa buat sinyal baru jika ada yang WAITING/ACTIVE |
| **Banner Mascot** | Gambar banner otomatis untuk setiap sinyal yang dikirim ke channel |
| **Pin/Unpin Channel** | Sinyal di-pin otomatis di channel, unpin saat EXPIRED/TP2/SL |
| **Dashboard Web** | UI monitoring sinyal, journal, quotes — akses via Cloudflare Tunnel |
| **Daily Music Player** | 28 lagu viral TikTok, rotasi harian otomatis (di dashboard) |
| **AI Trade Journal** | Narasi AI otomatis untuk setiap trade |
| **Risk Management** | LOW/MEDIUM/HIGH + Risk-Reward Ratio + Suggested Lot |
| **Learning & Retrain** | Bot belajar dari riwayat sinyal, bisa retrain manual |
| **High Confluence** | Boost confidence jika Scanner + Signal Engine searah |
| **Cloudflared Tunnel** | Dashboard URL berubah tiap restart, disimpan di `data/dashboard_config.json` |

---

## Struktur File

```
/                              ← root container (path RELATIF, bukan /home/container/)
├── launcher.js                ← Entry point: jalankan cloudflared + dashboard + bot
├── package.json               ← Dependencies (telegraf, dll)
├── .env                       ← BOT_TOKEN, API keys, CHANNEL_ID, dll
├── pterodactyl-dashboard-server.js  ← HTTP server dashboard (port 2389)
├── cloudflared                ← Binary tunnel (auto-download jika tidak ada)
├── cloudflared.log            ← Log output cloudflared + launcher
├── tunnel-url.txt             ← URL tunnel ditulis otomatis saat start
│
├── dashboard/
│   └── index.html             ← Frontend dashboard UI (monitoring + quotes + music)
│
├── data/
│   ├── signals.json           ← Database sinyal realtime
│   ├── scanner_signals.json   ← Database Trade Scanner
│   ├── scanner_history.json   ← Histori scanner
│   ├── journal.json           ← Trade journal
│   ├── quotes.json            ← Quotes harian
│   ├── dashboard_config.json  ← URL dashboard (persists restart)
│   └── ebooks/                ← E-book strategy files
│
└── src/
    ├── index.js               ← Bot entry (Telegraf setup, register semua commands)
    ├── analysis/
    │   ├── trade_scanner.js   ← Trade Scanner AI Engine (SHORT/MEDIUM/LONG)
    │   ├── scanner.js         ← Signal Engine realtime (overall bias + scan)
    │   ├── ebook_engine.js    ← E-Book Strategy Engine
    │   ├── news_engine.js     ← News Intelligence v3
    │   ├── news_engine_v4.js  ← News Intelligence v4
    │   ├── ai_engine.js       ← Wrapper ke AI provider (Omniroute)
    │   ├── strategy.js        ← Core strategy logic
    │   ├── strategy_library.js ← Kumpulan strategi e-book
    │   ├── ensemble.js        ← Ensemble scoring
    │   ├── learning.js        ← Learning & adaptive confidence
    │   └── indicators.js      ← Indikator teknikal
    ├── banner/
    │   ├── index.js           ← Export `renderBanner()`
    │   ├── registry.js        ← Banner registry (daftar template aktif)
    │   ├── engine.js          ← Render logic
    │   └── theme.js           ← Tema warna banner
    ├── bot/
    │   └── commands/          ← Semua command Telegram (lihat tabel di bawah)
    ├── database/
    │   ├── db.js              ← Database utama (signals.json) + mutex write
    │   └── db_extended.js     ← Extended DB functions
    ├── market/
    │   ├── data.js            ← Fetch price data (API)
    │   ├── cache.js           ← Price + trend cache
    │   └── key_manager.js     ← Rotasi API key market
    └── utils/
        ├── format.js          ← Format pesan sinyal
        ├── wib_time.js        ← Konversi ke WIB
        ├── market_hours.js    ← Cek jam market buka/tutup
        └── signal_validator.js ← Validasi sinyal sebelum broadcast
```

---

## Command Bot

### Keyboard Menu (Tombol Utama)

| Tombol | Fungsi |
|---|---|
| 📊 Market | Harga & analisis market saat ini |
| 📈 Statistik | Statistik sinyal (win rate, dll) |
| 📅 Daily | Rekap harian |
| 📅 Weekly | Rekap mingguan |
| 📖 Journal | Trade journal semua sinyal |
| 🤖 Bot Status | Status bot + open signals |
| 🧠 Learning | Status learning engine |
| 🔄 Retrain | Manual retrain (Owner) |
| 👀 Watchlist | Cek syarat entry saat ini |
| ❓ Kenapa Belum Entry? | Analisis alasan bot belum entry |
| 📚 Strategi Stats | Performa per strategi |
| 📉 Backtest 7D | Backtest 7 hari |
| 📊 Backtest 30D | Backtest 30 hari |
| 📄 Export Excel | Export ke XLS (Owner) |
| 💼 Money Management | Info risk/lot/broker |
| 👤 Profile | Profil money management |
| 🟢 Force BUY | Force entry BUY (Owner) |
| 🔴 Force SELL | Force entry SELL (Owner) |
| 🔭 Trade Scanner | Status trade scanner aktif (Owner) |
| 📡 Scan Status | Detail scanner SHORT/MEDIUM/LONG (Owner) |
| 📰 News | News Intelligence v4.0 |
| 📑 Export PDF | Export ke PDF (Owner) |
| 🔄 Refresh | Refresh dashboard status |
| ❓ Bantuan | Link ke /help |

### Slash Commands

| Command | Siapa | Keterangan |
|---|---|---|
| `/start` | Semua | Dashboard teks + keyboard menu utama |
| `/help` | Semua | Daftar command |
| `/market` | Semua | Harga & status market saat ini |
| `/stats` | Semua | Statistik sinyal (win rate, dll) |
| `/status` | Semua | Status bot (uptime, signal aktif) |
| `/scan` | Semua | Trade Scanner — pilih SHORT/MEDIUM/LONG |
| `/scan short` | Semua | Scanner timeframe 1-8 jam |
| `/scan medium` | Semua | Scanner timeframe 1-3 hari |
| `/scan long` | Semua | Scanner timeframe 1-2 minggu |
| `/scan history` | Semua | Histori scanner |
| `/scan status` | Semua | Signal scanner yang sedang aktif |
| `/ebook` | Semua | Sinyal berbasis strategi e-book |
| `/journal` | Semua | Trade journal |
| `/daily` | Semua | Rekap harian |
| `/backtest` | Semua | Backtest strategi |
| `/news` | Semua | News Intelligence v4.0 (kategori, bobot, AI verdict) |
| `/watchlist` | Semua | Cek syarat entry detail |
| `/why` | Semua | Analisis mendalam kenapa belum entry |
| `/stratstats` | Semua | Statistik per strategi |
| `/learning` | Semua | Status learning mode |
| `/tradejournal` | Semua | Journal berbasis persistent trade DB |
| `/tradehistory` | Semua | Histori trade dari DB |
| `/report` | Semua | Performance report manual |
| `/dailyreport` | Semua | Report harian |
| `/weeklyreport` | Semua | Report mingguan |
| `/reporthistory` | Semua | Histori report |
| `/backup` | Owner | Jalankan backup manual |
| `/backupstatus` | Owner | Kondisi backup engine |
| `/backuphistory` | Owner | Histori backup |
| `/restorelist` | Owner | Daftar backup tersedia |
| `/selftest` | Owner | Self-test koneksi & komponen |
| `/debug` | Owner | Toggle debug mode |
| `/documentation` | Owner | Generate dokumentasi developer |
| `/forcebuy` | Owner | Force entry BUY |
| `/forcesell` | Owner | Force entry SELL |
| `/signaltest` | Owner | Test generate sinyal + banner |
| `/retrain` | Owner | Retrain model learning |
| `/apikey` | Owner | Kelola API key AI |
| `/setdashboard` | Owner | Set URL dashboard manual |
| `/dashboard` | Owner | Tampilkan link dashboard web |
| `/balance` | Owner | Set saldo akun |
| `/risk` | Owner | Set risk per trade |
| `/broker` | Owner | Pilih broker |
| `/lot` | Owner | Kalkulasi lot |
| `/profile` | Owner | Profil money management |

---

## Environment Variables (`.env`)

```env
BOT_TOKEN=          # Telegram bot token
CHANNEL_ID=         # Channel ID untuk broadcast sinyal
OWNER_ID=           # Telegram user ID owner
OMNIROUTE_API_KEY=  # API key Omniroute (AI provider)
MARKET_API_KEY=     # API key data harga
DASHBOARD_PORT=2389 # Port dashboard (= allocated port Pterodactyl)
DB_PATH=./data/signals.json
JOURNAL_PATH=./data/journal.json
QUOTES_PATH=./data/quotes.json
```

---

## Deploy & Startup

```
Panel  : https://serverku.lynzzofficial.com
Server : Omniroute Server (UUID: 11b9ea11-cc5e-4af6-b901-0086cca1c590)
SFTP   : ndserverku.lynzzofficial.com:2022
Port   : 2389
CMD    : node launcher.js
```

`launcher.js` otomatis:
1. Download `cloudflared` binary jika belum ada
2. Start tunnel → tulis URL ke `tunnel-url.txt`
3. Start dashboard server (`pterodactyl-dashboard-server.js`)
4. Start bot (`src/index.js`)

> ⚠️ **Path file ke panel bersifat RELATIF.**  
> Benar: `/package.json`, `/src/index.js`  
> Salah: `/home/container/package.json` (menjadi nested double path)

---

## Backup Lokal di Replit

File-file di bawah adalah backup aktif yang sudah di-patch. Ini yang dipakai sebagai referensi saat push ke GitHub atau upload ke panel:

| File lokal (`remote_work/`) | Tujuan di panel |
|---|---|
| `pterodactyl-dashboard-server.active.js` | `/pterodactyl-dashboard-server.js` |
| `dashboard-index.active.html` | `/dashboard/index.html` |
| `src-index.active.js` | `/src/index.js` |
| `_src_bot_index.js.active` | `/src/bot/index.js` |
| `_src_bot_commands_start.js.active` | `/src/bot/commands/start.js` |
| `_src_bot_commands_scan.js.active` | `/src/bot/commands/scan.js` |
| `_src_bot_commands_owner.js.active` | `/src/bot/commands/owner.js` |
| `_src_bot_commands_signaltest.js.active` | `/src/bot/commands/signaltest.js` |
| `_src_bot_commands_dashboard.js.active` | `/src/bot/commands/dashboard.js` |
| `_src_bot_commands_doctor.js.active` | `/src/bot/commands/doctor.js` |
| `_src_bot_commands_news.js.active` | `/src/bot/commands/news.js` |
| `_src_bot_commands_watchlist_cmd.js.active` | `/src/bot/commands/watchlist_cmd.js` |
| `_src_bot_commands_why.js.active` | `/src/bot/commands/why.js` |
| `_src_analysis_trade_scanner.js.active` | `/src/analysis/trade_scanner.js` |
| `_src_analysis_scanner.js.active` | `/src/analysis/scanner.js` |
| `_src_analysis_ebook_engine.js.active` | `/src/analysis/ebook_engine.js` |
| `_src_analysis_backtest.js.active` | `/src/analysis/backtest.js` |
| `_src_analysis_pullback.js.active` | `/src/analysis/pullback.js` |
| `_src_analysis_strategy.js.active` | `/src/analysis/strategy.js` |
| `_src_banner_registry.js.active` | `/src/banner/registry.js` |
| `_src_database_db.js.active` | `/src/database/db.js` |
| `_src_database_db_extended.js.active` | `/src/database/db_extended.js` |
| `_src_scheduler_report_scheduler.js.active` | `/src/scheduler/report_scheduler.js` |
| `_src_market_key_manager.js.active` | `/src/market/key_manager.js` |

---

## Changelog

### v5.7 — 2026-07-31

**Keyboard Menu Fix + Tombol News + Backup Start Command**

**`src/bot/commands/start.js`** *(backup baru: `_src_bot_commands_start.js.active`)*
- File ini sebelumnya tidak ada di backup lokal Replit — sekarang dibuat lengkap
- Mendefinisikan `mainKeyboard` (reply keyboard layout) — **ini sumber kebenaran untuk label tombol**
- Label tombol di keyboard HARUS sama persis dengan string `bot.hears()` di `bot/index.js` (termasuk emoji)
- Export `registerStart`, `buildDashboardText`, `sendOrEditDashboard`

**`src/bot/index.js`** *(backup: `_src_bot_index.js.active`)*
- **Tambah**: `bot.hears('📰 News', ...)` — handler baru untuk tombol News di keyboard
  - Logika identik dengan `/news` command (news_engine_v4 + banner + format pesan)
- Keyboard sekarang punya 24 tombol (12 baris × 2) + baris Bantuan

**Keyboard layout baru** (baris 11 diubah):
- Sebelum: `📄 Export PDF | 🔄 Refresh` → `❓ Bantuan` (full)
- Sesudah: `📰 News | 📑 Export PDF` → `🔄 Refresh | ❓ Bantuan`

**README**
- Update tabel backup file lokal (tambah 8+ file yang sebelumnya tidak terdaftar)
- Pisahkan tabel command menjadi dua: **Keyboard Menu** (tombol) + **Slash Commands**
- Update versi ke v5.7

---

### v5.6 — 2026-07-31

**News Intelligence Banner — Content Area Hitam (Black)**

**`src/bot/commands/news.js`**
- **Bug**: Banner News Intelligence hanya menampilkan header; area konten (tengah) sepenuhnya hitam/kosong
- **Root cause**: `renderBanner('news_intelligence', { rows: [...] })` — field `rows` dikirim di level atas (flat), sedangkan engine layout `info` mengharuskan format `sections: [{ heading, rows }]` (lihat komentar di `scanner.js` line 443: *"infoBanner butuh format sections:[{heading, rows, progress?}]"*)
- **Fix**: Ganti kedua panggilan `renderBanner` (user chat + channel forward) dari flat `rows` ke `sections: [{ heading, rows }]`; tambah field `Dampak Gold` dari `v4.ai_verdict.impact_gold`; semua value dikonversi ke `String(...)` agar tidak ada number yang menyebabkan render gagal

---

### v5.5 — 2026-07-30

**Daily Report Bug Fix — WIB Date + AI Insight Message**

**`src/database/db_extended.js`** *(file baru — sebelumnya tidak ada backup lokal)*
- **Bug**: `created_at.slice(0,10)` membaca UTC date, bukan WIB date → sinyal yang dibuat setelah jam 17:00 UTC (= 00:00 WIB) dihitung masuk ke hari UTC berikutnya, padahal secara WIB masih hari yang sama
- **Fix**: Ganti semua filter & grouping tanggal menjadi `toWIBDate(created_at)` (UTC+7 offset) untuk `getExtendedDailyStats` dan per-day rows di `getExtendedWeeklyStats`
- File ini juga dibuat ulang sepenuhnya sebagai backup lokal di `remote_work/`

**`src/scheduler/report_scheduler.js`**
- **Bug**: `formatDailyReportV4` menampilkan `<i>AI Insight unavailable.</i>` bahkan ketika tidak ada data sama sekali (bukan error AI) — pesan menyesatkan
- **Fix**: Cek `s.total === 0` sebelum menampilkan pesan AI → jika tidak ada sinyal CLOSED, tampilkan `<i>Tidak ada sinyal CLOSED hari ini.</i>`; jika ada trade tapi AI gagal, tampilkan `<i>AI Insight tidak tersedia.</i>`
- Hal sama diterapkan pada `formatWeeklyReportV4` untuk Weekly Review

---

### v5.4 — 2026-07-30

**Pullback Zone Fix — Sinyal Sering Tidak Muncul di Trending Market**

**`src/analysis/pullback.js`**
- **Bug**: Bot tidak pernah entry saat STRONG_BUY karena zona pullback terlalu ketat (±0.5 ATR dari EMA20 ≈ 1-3 pips). Gold sedang uptrend kuat → harga jarang pullback sedalam itu
- **Fix buffer20**: `lastAtr * 0.5` → `lastAtr * 3.0` (zona EMA20 lebih realistis ≈ 15-20 pips)
- **Fix buffer50**: `lastAtr * 1.0` → `lastAtr * 4.0` (zona EMA50 lebih toleran)
- **Tambah zona baru `TREND_CONTINUATION`**: jika harga di atas EMA20 DAN masih dalam jarak ≤20 ATR (~80-120 pips) dari EMA20, bot diizinkan entry mengikuti momentum trend tanpa tunggu pullback dalam. Untuk kondisi uptrend/downtrend kuat yang jarang koreksi.

**`src/bot/commands/watchlist_cmd.js`**
- Tambah label display untuk zona `TREND_CONTINUATION` → tampil sebagai "Trend continuation — ikuti momentum"

---

### v5.3 — 2026-07-30

**Backtest Engine Fix (`src/analysis/backtest.js`)**
- **Bug**: Backtest selalu return 0 sinyal (7D maupun 30D)
- **Root cause 1**: `isRejectionCandle` terlalu ketat — syarat `lowerWick > body × 1.5` + `upperWick < body × 0.5` hampir tidak pernah terpenuhi di candle M5 XAU/USD → semua window di-skip
- **Root cause 2**: H4/H1 window hanya `.slice(-30)` tetapi `analyzeTimeframe` butuh EMA50 (min. 50 candle) → nilai EMA tidak akurat → bias selalu NEUTRAL → alignment H4+H1 tidak pernah terpenuhi
- **Fix**: Ganti `isRejectionCandle` ketat → cek 3 candle M5 terakhir, cukup satu yang directional (bullish untuk BUY / bearish untuk SELL) dengan body/range > 0.2
- **Fix**: H1/H4 window `.slice(-30)` → `.slice(-60)` agar EMA50 punya data cukup
- **Fix**: Fetch buffer `h1Count +100`, `h4Count +60` untuk histori lebih dalam
- **Fix**: ATR threshold: `0.3` → `0.15` (lebih realistis untuk M5 gold)
- **Fix**: STEP: `15` → `12` candle (scanning lebih granular, ~1 jam per iterasi)
- **Fix**: `MIN_CONFIDENCE` default: `65` → `55` (sesuai env var aktif di server)

**Daily Report Schedule Fix (`src/scheduler/report_scheduler.js`)**
- **Bug**: Report otomatis jalan jam 00:00 WIB → selalu tampilkan 0 sinyal karena hari baru belum ada trade
- **Fix**: Cron diubah dari `'0 17 * * *'` (00:00 WIB / 17:00 UTC) → `'50 16 * * *'` (23:50 WIB / 16:50 UTC)
- Report sekarang kirim 10 menit sebelum tengah malam — semua sinyal hari itu sudah terkumpul

---

### v5.2 — 2026-07-29
- **News Direction Filter di Signal Engine realtime** (`scanner.js`): tambah 2 layer filter baru setelah `blockEntry` yang sudah ada sebelumnya:
  1. **Direction Support Check** — jika `analysis.direction_support` dari news engine tidak `NETRAL` dan berlawanan dengan arah sinyal → `newsDirectionBlocked = true`, sinyal di-skip
  2. **Gold Impact Check** — jika `impact_gold` = `BEARISH` sedangkan sinyal `BUY` (atau sebaliknya) → `newsDirectionBlocked = true`, sinyal di-skip
- Variabel `newsBlocked` sekarang = `blockEntry OR newsDirectionBlocked` (sebelumnya hanya `blockEntry`)
- Fail-safe tetap berlaku: jika news engine error → lanjut tanpa filter
- Logika ini sudah proven di `trade_scanner.js` (v5.1), sekarang diaplikasikan ke Signal Engine utama untuk konsistensi
- **Motivasi**: WR rendah disebabkan sinyal masuk berlawanan arah news berdampak tinggi meski confidence 65%+

### v5.1 — 2026-07-29
- **News Intelligence Filter di Trade Scanner** (`trade_scanner.js`): sebelum generate setup, cek `getNewsImpact()`. Jika news berlawanan (`blockEntry`, `direction_support` beda, atau `impact_gold` berlawanan) → return `newsBlocked: true`, sinyal tidak dibuat. Jika aligned → boost confidence + tambahkan field `news_aligned` + `news_info` ke sinyal.
- **`scan.js`**: handle `result.newsBlocked` — tampilkan pesan info arah news, alasan, dan instruksi coba lagi.
- **Pin/Unpin pesan channel otomatis** (`scan.js`, `trade_scanner.js`, `owner.js`, `db.js`): sinyal di-pin setelah terkirim ke channel, unpin otomatis saat EXPIRED / TP2_HIT / SL_HIT. `db.js` tambah fungsi `setChannelMsgId()`.
- **Banner Mascot** jadi satu-satunya banner (`scan.js`, `owner.js`, `signaltest.js`): ganti dari `generateSignalChart` → `renderBanner` dari `../../banner`.
- **`scan.js` forward banner ke channel**: `renderBanner` → `bannerBuffer` → `ctx.telegram.sendPhoto(channelId, { source: bannerBuffer })` sebelum `sendMessage`.
- **`ebook_engine.js`**: tambahkan `newsInfo` ke parameter dan tampilkan di pesan sinyal ebook.
- **`scanner.js`**: teruskan `newsInfoForBroadcast` ke ebook engine.
- **`banner/registry.js`**: update registry template aktif.
- **`bot/commands/news.js`**: update handler news command.

### v5.0 — 2026-07-27 (baseline Replit)
- Dual AI Engine pertama kali aktif: Signal Engine + Trade Scanner berjalan paralel
- Trade Scanner dengan lifecycle: WAITING → ACTIVE → TP1_HIT / TP2_HIT / SL_HIT / EXPIRED
- Signal Lock system
- Dashboard web + Cloudflare Tunnel auto-setup via `launcher.js`
- Daily Music Player di dashboard (28 lagu TikTok viral, rotasi harian)
- E-Book Strategy Engine hybrid
- AI Trade Journal (narasi AI per trade)
- Risk Management: LOW/MEDIUM/HIGH + RR + Suggested Lot
- High Confluence detection (Scanner + Signal Engine searah)
- Learning & Adaptive Confidence system
- `pterodactyl-dashboard-server.js`: readBody limit 15MB (naik dari 2MB untuk handle canvas PNG)
- `dashboard/index.html`: auto-size font quote (80→40px) agar tidak overflow
- Riwayat Quote: index-based (`window._histQ` + `_selHistQ(i)`) menggantikan double-serialize onclick yang rusak
- `doctor.js`: tambah `stream: false` di body Omniroute call (fix SSE crash `/audit`)
- `dashboard.js`: fix `updatedAt` undefined di branch non-owner

---

## Panduan Update ke Depan

Setiap kali ada perubahan file di panel atau di Replit, **wajib update tabel Changelog di atas** dengan:
- Versi baru (increment minor jika fitur, patch jika bugfix)
- Tanggal update (format YYYY-MM-DD)
- File mana yang berubah
- Apa yang diubah dan kenapa

### Cara push ke GitHub
```bash
# 1. Download file terbaru dari panel ke remote_work/ (jika ada perubahan di panel)
# 2. Cek perbandingan timestamp: panel vs lokal
# 3. Simpan versi yang lebih baru
# 4. Commit + push
git add .
git commit -m "vX.Y — deskripsi singkat perubahan"
git push github main
```

### Jika terjadi error/crash di panel
1. Cek log: `cloudflared.log` di root container
2. Cek apakah error di dashboard server (exit=0 → tidak ada `if (require.main === module)`) atau exit=1 (syntax error)
3. Upload file backup dari `remote_work/` yang sesuai
4. Restart server dari panel

---

*Repository ini dikelola via Replit. Source lokal ada di folder `remote_work/`. Untuk pertanyaan atau kontribusi, hubungi owner bot.*
