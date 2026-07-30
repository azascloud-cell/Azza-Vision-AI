---
name: AZZAVISION AI Pterodactyl Setup
description: Info panel Pterodactyl, server dashboard + bot AZZAVISION AI
---

# AZZAVISION AI Pterodactyl Setup

## Panel Aktif (per Juli 2026)
- **Panel URL:** https://serverku.lynzzofficial.com
- **Server UUID:** 11b9ea11-cc5e-4af6-b901-0086cca1c590
- **SFTP:** ndserverku.lynzzofficial.com:2022
- **Allocated Port:** 2389
- **Server Name:** Omniroute Server
- **Docker Image:** ghcr.io/parkervcp/yolks:nodejs_22

## Konfigurasi Startup
- **CMD_RUN:** `node launcher.js`
- **launcher.js** = wrapper yang menjalankan: cloudflared tunnel + dashboard server + bot Telegram
- cloudflared didownload otomatis ke `/cloudflared` jika tidak ditemukan di system

## PATH FILE — PENTING
Panel ini menggunakan path **RELATIF** dari root container:
- ✅ BENAR: `/package.json`, `/src/index.js`, `/.env`
- ❌ SALAH: `/home/container/package.json` (akan nested jadi `/home/container/home/container/...`)

## Struktur File di Container
- `launcher.js` — startup wrapper (tunnel + dashboard + bot)
- `package.json` — scripts.start = node launcher.js, semua deps telegraf dll
- `.env` — BOT_TOKEN, API keys, CHANNEL_ID, dll
- `src/` — full bot source (AZZAVISION AI v5.1)
- `dashboard/index.html` — frontend dashboard UI
- `pterodactyl-dashboard-server.js` — dashboard HTTP server (port 2389)
- `data/` — signals.json, journal.json, quotes.json, ebooks/, dll
- `data/dashboard_config.json` — URL dashboard yang di-set manual (persists restart)
- `cloudflared` — binary didownload otomatis saat pertama start
- `tunnel-url.txt` — tunnel URL ditulis otomatis oleh launcher
- `cloudflared.log` — log output cloudflared + launcher

## API Key Panel
- Panel baru (serverku.lynzzofficial.com) menggunakan key berbeda dari panel lama
- Key format: `ptlc_...` (Pterodactyl Client API Key)
- Buat key baru di: Login → foto profil → API Credentials → Create New
- PTERODACTYL_API_KEY secret di Replit harus diperbarui jika expired/401

## Akses API Panel
- Gunakan `$PTERODACTYL_API_KEY` via ShellExec + curl (bukan CodeExecution fetch)
- Contoh: `curl -H "Authorization: Bearer $PTERODACTYL_API_KEY" -H "Accept: application/json" "${PANEL}/api/client/account"`
- requestSecrets() di CodeExecution tidak works untuk ini — pakai ShellExec

## Bug yang Sudah Diperbaiki

### pterodactyl-dashboard-server.js harus auto-start
- **Masalah:** File hanya `module.exports = { startDashboard }` tanpa memanggil fungsinya. Launcher meng-spawn file langsung via `spawn(node, [dsFile])`, bukan require, jadi file keluar exit=0 tanpa bind port.
- **Fix:** Tambahkan di akhir file: `if (require.main === module) { startDashboard(); }`
- **Tanda masalah:** log `Dashboard exit=0, restart 3s` berulang sangat cepat

### Syntax error akibat double-patch
- **Masalah:** Patch sebelumnya menghasilkan `}` ganda di baris 38 → SyntaxError → exit=1 crash loop
- **Tanda masalah:** log `Dashboard exit=1, restart 3s` berulang sangat cepat
- **Fix:** Gunakan file backup lokal `remote_work/pterodactyl-dashboard-server.active.js` yang sudah bersih, syntax-check dengan `node --check`, lalu upload
### readQuotes() array safety
- **Masalah:** `readQuotes()` return apapun isi JSON (bisa object), `all.push` crash
- **Fix:** tambah `Array.isArray(raw) ? raw : []` check
- **File:** `/pterodactyl-dashboard-server.js`

### readBody size limit
- **Masalah:** canvas 1080×1920 PNG = 3-5MB base64, tapi readBody limit 2MB → destroy connection → "Failed to fetch"
- **Fix:** ubah `2e6` → `15e6` di readBody function
- **File:** `/pterodactyl-dashboard-server.js`

### Canvas quote text overflow
- **Masalah:** font FSZ hardcoded 80px → quote panjang terpotong di bagian bawah card
- **Fix:** auto-size loop 80→40px step 4, cek `_wrapCount(sz) * LH <= AVAIL_H` sebelum render
- **File:** `/dashboard/index.html` (fungsi `_renderCardDataUrl`)

### Riwayat Quote stuck "Loading..."
- **Masalah:** `onclick="_aQ(${JSON.stringify(JSON.stringify(q))})"` — double serialize menghasilkan `"..."` yang memecah HTML attribute → klik tidak bekerja; plus `catch(e){}` silent menelan error
- **Fix:** gunakan `window._histQ` array + `_selHistQ(i)` index-based; error handler tampilkan pesan
- **File:** `/dashboard/index.html` (fungsi `_lHist`, tambah `_selHistQ`)

### Dashboard backsound — Daily Music Player
- **File:** `/dashboard/index.html`
- **Fitur:** Floating player kiri bawah, 28 lagu viral TikTok, rotasi tiap hari otomatis (`dayNum % PL.length`), skip otomatis jika video unavailable
- **Tech:** YouTube IFrame API, volume slider, progress bar, spin disc animation
- **Backup lokal:** `remote_work/dashboard-index.active.html`

### dashboard command `updatedAt` undefined
- **Masalah:** di branch non-owner ada `${updatedAt}` yang tidak defined
- **Fix:** ganti ke `${sourceLabel ? "\n\n" + sourceLabel : ""}`
- **File:** `/src/bot/commands/dashboard.js`

### /audit gagal — Unexpected token 'd' (SSE streaming)
- **File:** `/src/bot/commands/doctor.js` — fungsi `callOmni()`
- **Masalah:** `body: JSON.stringify({model, messages, max_tokens})` tanpa `stream: false` → Omniroute balik SSE format `data: {...}` bukan JSON → `res.json()` crash
- **Fix:** tambah `stream: false` di body JSON.stringify
- **Backup lokal:** `remote_work/_src_bot_commands_doctor.js.active`

## Dashboard URL
- Tunnel berubah setiap restart → simpan di `/data/dashboard_config.json`
- Set via `/setdashboard <url>` di bot (owner only)
- Bot juga baca otomatis dari `tunnel-url.txt`

## Fitur yang Sudah Ditambahkan

### Trade Scanner News Alignment Filter
- **File:** `/src/analysis/trade_scanner.js` + `/src/bot/commands/scan.js`
- **Fitur:** `generateScan` sekarang cek `getNewsImpact()` sebelum generate setup. Jika news berlawanan (blockEntry, direction_support berbeda, atau impact_gold berlawanan) → return `newsBlocked: true` — sinyal tidak dibuat. Jika aligned → confidence di-boost sebagian dari `confidence_impact` news, field `news_aligned` + `news_info` ditambahkan ke signal dan ditampilkan di pesan.
- **scan.js:** handle `result.newsBlocked` dengan pesan info detail arah news, alasan, dan instruksi coba lagi.
- **Fail-safe:** jika news engine error → lanjut tanpa filter (seperti ebook engine).
- **Backup lokal:** `remote_work/_src_analysis_trade_scanner.js.active`, `remote_work/_src_bot_commands_scan.js.active`

## Fitur Pin/Unpin Pesan Channel (Juli 2026)

### Cara kerja
- **scan.js** → setelah `sendMessage` sinyal ke channel, tangkap `message_id` → `pinChatMessage` (disable_notification: true) → `saveChannelMsgId(signal.type, msgId)` simpan ke scanner DB
- **trade_scanner.js** → fungsi `saveChannelMsgId(type, msgId)` simpan `channel_msg_id` ke `scanner_signals.json`. Unpin otomatis di 3 titik: EXPIRED (top archive loop), TP2_HIT (setelah kirim notif + banner), SL_HIT (setelah kirim notif + banner)
- **owner.js** → `handleForce()` tangkap `message_id` dari sendPhoto/sendMessage → pin + `setChannelMsgId(signalId, msgId)` ke DB. `handleForceOutcome()` baca `sig.channel_msg_id` → unpin sebelum kirim journal
- **db.js** → `setChannelMsgId(id, msgId)` fungsi baru, ikut pola mutex write, simpan `channel_msg_id` di signal object

### File backup lokal
- `remote_work/_src_database_db.js.active` — db.js dengan setChannelMsgId

### Note
- `saveChannelMsgId` diekspor dari trade_scanner dan diimport di scan.js
- `setChannelMsgId` diekspor dari db.js dan diimport di owner.js

## Source Lokal (backup di repl)
- `remote_work/pterodactyl-dashboard-server.active.js` — dashboard server source (patched)
- `remote_work/dashboard-index.active.html` — dashboard HTML
- `remote_work/_src_bot_commands_dashboard.js.active` — dashboard command (patched)
- `remote_work/_src_analysis_trade_scanner.js.active` — trade scanner dengan news filter (patched)
- `remote_work/_src_bot_commands_scan.js.active` — scan command dengan newsBlocked handler + banner forward ke channel (patched)
- `remote_work/_src_bot_commands_owner.js.active` — owner forcebuy/forcesell dengan mascot banner (patched)
- `remote_work/_src_bot_commands_signaltest.js.active` — signaltest dengan mascot banner (patched)
- `remote_work/_src_analysis_ebook_engine.js.active` — ebook engine dengan news info di pesan (patched)
- `remote_work/_src_analysis_scanner.js.active` — scanner dengan newsInfoForBroadcast diteruskan ke ebook (patched)
- `attached_assets/abangwan-source-*.zip` — full bot source backup
- `attached_assets/abangwan-data-*.zip` — data files backup
- `attached_assets/abangwan-config-*.zip` — .env + config backup

## Banner Sistem (per Juli 2026)
- **Mascot banner** (`/src/banner/`) adalah satu-satunya banner yang dipakai — chart lama (`/src/chart/generator.js`) sudah tidak dipakai
- `signaltest.js` dan `owner.js` (forcebuy/forcesell) sudah diganti dari `generateSignalChart` → `renderBanner` dari `../../banner`
- `scan.js` sudah forward banner ke channel: `renderBanner` → simpan ke `bannerBuffer` → `ctx.telegram.sendPhoto(channelId, { source: bannerBuffer })` sebelum `sendMessage`
- `renderBanner('signal_buy'/'signal_sell', { direction, pair, entry, sl, tp1, tp2, tp3, riskReward, confidence, setupTime })`

**Why:** Panel lama (private.lynzzofficial.com) expired Juli 2026. Panel baru path-nya relatif bukan absolute.
