/**
 * learning_mode.js — Daily Learning Mode
 *
 * Setiap hari (08:00 WIB), bot mengirim edukasi singkat ke channel
 * walaupun tidak ada sinyal — agar channel tetap aktif & bernilai.
 */

const { toWIB } = require('../../utils/wib_time');

// ─── KONTEN EDUKASI ────────────────────────────────────────────────────────────
const DAILY_LESSONS = [
  {
    title: 'Teknik Engulfing',
    emoji: '🕯️',
    content: `Bullish Engulfing terjadi saat candle hijau "menelan" candle merah sebelumnya.

Syarat valid:
• Candle sebelumnya bearish (merah)
• Candle baru bullish (hijau) dan body-nya lebih besar
• Terjadi di dekat support atau demand zone

Ini sinyal potensi reversal ke atas yang kuat.`,
    tip: 'Selalu konfirmasi dengan tren H1/H4 yang searah.',
  },
  {
    title: 'Teknik Divergence RSI',
    emoji: '📊',
    content: `Divergence terjadi saat harga dan RSI bergerak berlawanan.

Bullish Divergence:
• Harga membuat Lower Low (LL)
• RSI membuat Higher Low (HL)
→ Sinyal potensi reversal bullish

Bearish Divergence:
• Harga membuat Higher High (HH)
• RSI membuat Lower High (LH)
→ Sinyal potensi reversal bearish`,
    tip: 'Divergence lebih kuat jika terjadi di area support/resistance kunci.',
  },
  {
    title: 'Supply & Demand Zone',
    emoji: '🏛️',
    content: `Supply Zone = area di mana seller kuat (harga cenderung turun).
Demand Zone = area di mana buyer kuat (harga cenderung naik).

Cara identifikasi:
• Cari area konsolidasi kecil (base) sebelum move besar
• Area tersebut adalah zona S&D
• Tunggu harga kembali ke zona tersebut untuk entry

Entry hanya saat ada konfirmasi rejection candle.`,
    tip: 'Zona S&D bekas lebih reliabel dari yang baru terbentuk.',
  },
  {
    title: 'Fibonacci Retracement',
    emoji: '🔢',
    content: `Fibonacci adalah alat untuk menemukan area retracement potensial.

Level kunci:
• 38.2% — retracement ringan
• 50.0% — retracement sedang
• 61.8% — retracement "golden zone" (paling kuat)
• 78.6% — retracement dalam

Cara pakai:
Tarik Fibo dari swing low ke swing high (untuk uptrend).
Entry di sekitar 61.8% dengan konfirmasi rejection candle.`,
    tip: '61.8% adalah level yang paling sering direspons oleh market.',
  },
  {
    title: 'Higher High Lower Low (HHLL)',
    emoji: '📈',
    content: `Uptrend = serangkaian Higher High (HH) dan Higher Low (HL).
Downtrend = serangkaian Lower High (LH) dan Lower Low (LL).

Cara trading:
• Identifikasi tren dengan HHLL di H1/H4
• Tunggu pullback ke area HL (untuk uptrend)
• Entry saat pullback selesai dan muncul bullish candle

Jangan entry saat break of structure (BOS) berlawanan!`,
    tip: 'Tren di H4 lebih reliable untuk menentukan arah utama.',
  },
  {
    title: 'Break of Structure (BOS)',
    emoji: '🔨',
    content: `BOS = harga menembus swing high/low yang signifikan.

Bullish BOS:
• Harga menembus swing high sebelumnya ke atas
• Konfirmasi tren bullish masih kuat

Bearish BOS:
• Harga menembus swing low sebelumnya ke bawah
• Konfirmasi tren bearish masih kuat

BOS berbeda dengan CHOCH (Change of Character) yang menandakan potensi pembalikan tren.`,
    tip: 'BOS di timeframe besar (H4) lebih signifikan dari BOS di M5.',
  },
  {
    title: 'Money Management & Risk',
    emoji: '💰',
    content: `Aturan emas risk management:
• Max risiko per trade: 1-2% dari modal
• Jangan revenge trade setelah loss
• Selalu pasang Stop Loss sebelum entry
• Jangan ubah SL ke arah yang lebih rugi

Formula lot size:
Lot = (Modal × % Risiko) ÷ (SL dalam pips × nilai per pip)

Contoh: Modal $1000, risiko 1%, SL 40 pips
= ($1000 × 1%) ÷ (40 × $1) = 0.25 lot`,
    tip: 'Konsistensi risk management lebih penting dari win rate tinggi.',
  },
  {
    title: 'Candlestick: Rejection Candle',
    emoji: '🕯️',
    content: `Rejection candle = candle dengan ekor panjang yang menunjukkan penolakan harga.

Tipe:
• Hammer (palu) — ekor bawah panjang = bullish rejection
• Shooting Star — ekor atas panjang = bearish rejection
• Pin Bar — ekor sangat panjang di salah satu sisi

Syarat valid:
• Ekor minimal 2x panjang body
• Terjadi di area support/resistance/zone kunci
• Volume konfirmasi (jika tersedia)`,
    tip: 'Rejection candle di H1/H4 lebih kuat dari M5.',
  },
  {
    title: 'Trendline Bounce',
    emoji: '📐',
    content: `Trendline = garis yang menghubungkan minimal 2-3 swing point.

Uptrend line: hubungkan swing low (Higher Lows).
Downtrend line: hubungkan swing high (Lower Highs).

Entry trendline bounce:
• Harga mendekati trendline
• Muncul rejection candle di trendline
• Entry setelah konfirmasi candle berikutnya

Makin banyak kali trendline "disentuh", makin kuat.`,
    tip: 'Trendline yang sudah disentuh 3+ kali biasanya lebih kuat.',
  },
  {
    title: 'Trading Session XAUUSD',
    emoji: '🌍',
    content: `Sesi trading terbaik untuk XAUUSD:

🌅 London Session (15:00–19:00 WIB)
• Volatilitas mulai meningkat
• Banyak setup teknikal terbentuk

🌆 New York Session (19:30–23:00 WIB)
• Paling volatile untuk XAUUSD
• Pergerakan besar sering terjadi di sini
• Hindari 30 menit sebelum/sesudah berita

⚠️ Hindari: Asian session & weekend (spread lebar, volume rendah)`,
    tip: 'Overlap London-NY (19:30-22:00 WIB) adalah periode terbaik.',
  },
  {
    title: 'Teknik Scalping 5 Menit',
    emoji: '⚡',
    content: `Scalping M5 membutuhkan:
• Tren H1 yang jelas (bukan sideways)
• Entry hanya searah tren H1
• SL ketat (20-30 pips)
• TP cepat (20-40 pips)

Langkah:
1. Tentukan arah H1
2. Tunggu pullback di M5
3. Cari rejection candle saat pullback
4. Entry dengan SL di bawah swing low (BUY) atau atas swing high (SELL)

Scalping tidak cocok saat news!`,
    tip: 'Scalping butuh disiplin ketat — jangan overtrading.',
  },
  {
    title: 'Round Number Rejection',
    emoji: '🔢',
    content: `Level psikologis (round number) sering menjadi area support/resistance kuat.

Untuk XAUUSD contohnya: 2300, 2350, 2400, 2450...

Kenapa kuat?
• Banyak trader pasang order di level bulat
• Bank dan institusi sering gunakan level ini

Entry:
• Tunggu harga mendekati round number
• Lihat ada rejection candle atau tidak
• Entry dengan konfirmasi, bukan langsung di level`,
    tip: 'Kombinasikan round number dengan supply/demand zone untuk sinyal lebih kuat.',
  },
  {
    title: 'Liquidity Sweep',
    emoji: '🌊',
    content: `Liquidity Sweep = pergerakan harga yang "menyapu" stop loss trader retail sebelum berbalik arah.

Contoh Bullish Sweep:
• Harga spike turun di bawah swing low
• Memicu stop loss trader BUY yang ada di sana
• Lalu harga langsung berbalik naik kuat

Cara entry:
• Lihat spike pendek melewati level kunci
• Konfirmasi dengan candle pembalikan kuat
• Entry saat candle konfirmasi selesai`,
    tip: 'Liquidity sweep yang disertai volume tinggi lebih reliabel.',
  },
  {
    title: 'Moving Average sebagai Dynamic Support',
    emoji: '📉',
    content: `EMA (Exponential Moving Average) sering bertindak sebagai dynamic support/resistance.

EMA yang populer:
• EMA 20 — support/resistance jangka pendek
• EMA 50 — support/resistance medium
• EMA 200 — garis tren jangka panjang

Golden Cross: EMA 20 melewati EMA 50 ke atas = bullish
Death Cross: EMA 20 melewati EMA 50 ke bawah = bearish

Entry: Tunggu harga bounce dari EMA dengan konfirmasi rejection candle.`,
    tip: 'EMA 50 di H4 sangat sering menjadi support kuat untuk XAUUSD.',
  },
];

// Index lesson hari ini (rotasi harian)
function getTodayLesson() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_LESSONS[dayOfYear % DAILY_LESSONS.length];
}

// ─── FORMAT PESAN EDUKASI ──────────────────────────────────────────────────────
function formatLearningMessage(lesson, wib) {
  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📖 <b>AZZAVISION AI — DAILY LEARNING</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
    `${lesson.emoji} <b>Hari ini: ${lesson.title}</b>`,
    ``,
    lesson.content,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `💡 <b>Tips:</b>`,
    lesson.tip,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🎓 <i>Daily Learning — AZZAVISION AI v3.0</i>`,
    `📚 <i>Konsisten belajar = konsisten profit</i>`,
  ].join('\n');
}

// ─── KIRIM DAILY LEARNING ─────────────────────────────────────────────────────
async function sendDailyLearning(bot) {
  const channelId = process.env.CHANNEL_ID;
  if (!channelId || !bot) return;

  const lesson = getTodayLesson();
  const wib    = toWIB();
  const msg    = formatLearningMessage(lesson, wib);

  try {
    await bot.telegram.sendMessage(channelId, msg, { parse_mode: 'HTML' });
    console.log(`[DAILY-LEARNING] ✅ Terkirim: "${lesson.title}"`);
  } catch (err) {
    console.error('[DAILY-LEARNING] Gagal kirim:', err.message);
  }
}

// ─── REGISTER /learning COMMAND ───────────────────────────────────────────────
function registerLearningMode(bot) {
  bot.command('learning', async (ctx) => {
    const lesson = getTodayLesson();
    const wib    = toWIB();
    const msg    = formatLearningMessage(lesson, wib);
    await ctx.replyWithHTML(msg);
  });
}

// ─── SCHEDULER: kirim otomatis jam 08:00 WIB setiap hari ─────────────────────
let lastSentDate = null;

function scheduleDailyLearning(bot) {
  setInterval(() => {
    const wib    = toWIB();
    const today  = `${wib.year}-${wib.month}-${wib.dateNum}`;
    const hour   = parseInt(wib.hours);
    const minute = parseInt(wib.minutes);

    // Kirim sekitar jam 08:00 WIB (08:00 - 08:02)
    if (hour === 8 && minute <= 2 && lastSentDate !== today) {
      lastSentDate = today;
      sendDailyLearning(bot).catch(err => {
        console.error('[DAILY-LEARNING] Scheduler error:', err.message);
      });
    }
  }, 60 * 1000); // cek setiap menit

  console.log('[DAILY-LEARNING] Scheduler aktif — akan kirim setiap 08:00 WIB');
}

module.exports = {
  registerLearningMode,
  scheduleDailyLearning,
  sendDailyLearning,
  getTodayLesson,
  formatLearningMessage,
};
