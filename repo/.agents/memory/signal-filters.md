---
name: Signal Filter Settings
description: Konfigurasi filter sinyal AZZAVISION AI — default values dan rationale perubahan
---

# Signal Filter Settings

## Nilai Default Saat Ini (setelah update Juli 2026)

| Setting | Sebelum | Sesudah | File |
|---------|---------|---------|------|
| SIGNAL_COOLDOWN_H | 4 jam | 2 jam | scanner.js |
| MIN_CONFIDENCE | 65% | 55% | scanner.js (2 tempat: watchlist + doScan) |
| WATCHLIST_COOLDOWN | 30 menit | 15 menit | scanner.js |
| M5 entry required | Strict (valid only) | Relax: valid OR (aligned + !spike + conf>=68%) | scanner.js |
| News direction block | Block jika arah/gold berlawanan | Hanya log, tidak block | scanner.js |
| News direction block (trade scanner) | Block jika arah/gold berlawanan | Hanya log, tidak block | trade_scanner.js |
| forcebuy/forcesell harga | M5 candle terakhir (bisa 5 min stale) | getCachedPrice() → fetchSpotPrice() → M5 fallback | owner.js |

## Env Variables yang Bisa Overide
- `SIGNAL_COOLDOWN_H` = jam cooldown antar signal (default 2)
- `MIN_CONFIDENCE` = minimum confidence untuk entry (default 55)
- `ENTRY_MODE` = 'conservative' untuk mode ketat (default: normal/relax)

## Logika M5 Relax
```javascript
const m5Relaxed = result.m5Entry?.valid ||
  (result.aligned && !result.spikeRisk && finalConfidence >= 68);
```

## News Permissive
- `blockEntry = true` → TETAP block (NFP/FOMC high-impact imminent)
- `direction_support` berbeda → hanya log warning, lanjut entry
- `impact_gold` berlawanan → hanya log warning, lanjut entry

## Fix Forcebuy/Forcesell Harga
Urutan prioritas harga:
1. `getCachedPrice()` — cache real-time update tiap ~6 detik ✅
2. `fetchSpotPrice()` — panggil langsung ke API ✅
3. M5 candle terakhir — fallback (bisa 0-5 menit stale) ⚠️
4. 3300 — absolute fallback jika semua gagal

**Why:** Harga M5 candle bisa 5 menit telat → SL hitam karena entry = harga lama.
