---
name: Backtest Engine Fix
description: Root cause dan fix untuk backtest engine yang selalu return 0 signal
---

# Backtest Engine — 0 Signals Root Cause

## Masalah
`src/analysis/backtest.js` `analyzeWindow()` selalu return null → 0 sinyal di 7D/30D backtest.

## Root Causes (dua sekaligus)

### 1. `isRejectionCandle` terlalu ketat untuk M5 XAU/USD
Kondisi asli:
- lowerWick > body * **1.5** (untuk BUY)
- upperWick < body * **0.5**
- body / range > 0.2
- harus candle terakhir saja

Kombinasi ini sangat jarang terjadi pada candle M5 gold. Live scanner tidak pakai kondisi ini (pakai `evaluateM5Entry` yang lebih permisif).

### 2. H4/H1 window terlalu kecil untuk EMA50
`h4Window = h4.filter(...).slice(-30)` → hanya 30 H4 candle, tapi `analyzeTimeframe` butuh EMA50 (minimal 50 candle). Hasilnya EMA50 tidak akurat → bias calculation salah → H4+H1 alignment tidak terpenuhi.

## Fix (backtest.js)

1. **Ganti `isRejectionCandle` strict** → cek 3 candle M5 terakhir, cukup satu yang directional (close > open untuk BUY, atau close < open untuk SELL) dengan body/range > 0.2
2. **ATR threshold**: 0.3 → 0.15 (lebih realistis)
3. **H1/H4 window**: `.slice(-30)` → `.slice(-60)` agar EMA50 punya data cukup
4. **h1Count/h4Count**: tambah buffer +100 dan +60 saat fetch
5. **STEP**: 15 → 12 candle (scanning lebih granular, ~1 jam)
6. **MIN_CONFIDENCE default**: 65 → 55 (sesuai env var aktif di server)

**Why:** Live scanner dan backtest pakai code path berbeda. Backtest `analyzeWindow` menggunakan kondisi lebih ketat dari live scanner tanpa alasan — menyebabkan 0 deteksi sinyal historis.

**How to apply:** Kalau backtest kembali return 0 signal setelah perubahan strategy, cek dua hal ini dulu: (1) apakah ada kondisi per-candle yang terlalu spesifik, (2) apakah window H1/H4 cukup besar untuk indicator yang digunakan.

## Report Scheduler Fix

- Cron daily report diubah dari `'0 17 * * *'` (00:00 WIB) ke `'50 4 * * *'` (11:50 WIB)
- **Why:** Report jam 00:00 WIB selalu menampilkan data kosong (hari baru belum ada sinyal). Jam 11:50 WIB sudah melewati sesi London open dan ada sinyal terkumpul.
- File: `src/scheduler/report_scheduler.js`
