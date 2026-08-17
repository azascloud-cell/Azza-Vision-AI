/**
 * ebook.js — Perintah /ebook untuk akses koleksi e-book forex
 * Kirim PDF langsung ke user via Telegram Document
 */
const fs   = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const EBOOK_DIR = path.resolve('./data/ebooks');

// Daftar e-book dengan nama tampilan yang lebih rapi
const EBOOK_CATALOG = [
  { file: '5TeknikHedgingBONUS.pdf',                        title: '5 Teknik Hedging (BONUS)' },
  { file: '7PowerfulCandleStickPattern.pdf',                title: '7 Powerful Candlestick Pattern' },
  { file: 'BFX strategy.pdf',                               title: 'BFX Strategy' },
  { file: 'Cara Trade News NFP.pdf',                        title: 'Cara Trade News NFP' },
  { file: 'HHLL TRADING STRATEGY.pdf',                      title: 'HHLL Trading Strategy' },
  { file: 'Harmonic Pattern Trading Strategy Farhan Alif.pdf', title: 'Harmonic Pattern Trading Strategy' },
  { file: 'ILMU FIBONACCI  by Jayzee FX (5).pdf',           title: 'Ilmu Fibonacci by Jayzee FX' },
  { file: 'KOLEKSI CHART & CANDLESTICK PATTERN.pdf',        title: 'Koleksi Chart & Candlestick Pattern' },
  { file: 'Nota Asas Fundamental.pdf',                      title: 'Nota Asas Fundamental' },
  { file: 'RAHSIA ENGULFING.pdf',                           title: 'Rahsia Engulfing' },
  { file: 'TEKNIK FIBO DERHAKA.pdf',                        title: 'Teknik Fibo Derhaka' },
  { file: 'TEKNIK MAUT.pdf',                                title: 'Teknik Maut' },
  { file: 'TEKNIK RM50K PIJAT RUSLI.pdf',                   title: 'Teknik RM50K Pijat Rusli' },
  { file: 'TEKNIK SCALPING 5 MINIT (3).pdf',               title: 'Teknik Scalping 5 Minit' },
  { file: 'TEKNIK SCALPING AO (2).pdf',                     title: 'Teknik Scalping AO' },
  { file: 'TEKNIK SCALPING RED5.pdf',                       title: 'Teknik Scalping Red5' },
  { file: 'TEKNIK SCALPING.pdf',                            title: 'Teknik Scalping' },
  { file: 'TEKNIK SNIPER.pdf',                              title: 'Teknik Sniper' },
  { file: 'TEKNIK SUPPLY DAN DEMAND.pdf',                   title: 'Teknik Supply & Demand' },
  { file: 'TEKNIK TRADING ROUND NUMBER.pdf',               title: 'Teknik Trading Round Number' },
  { file: 'Teknik 10 PIPS.pdf',                             title: 'Teknik 10 Pips' },
  { file: 'Teknik Bendera.pdf',                             title: 'Teknik Bendera' },
  { file: 'Teknik Kamikaze.pdf',                            title: 'Teknik Kamikaze' },
  { file: 'Teknik Money Management.pdf',                    title: 'Teknik Money Management' },
  { file: 'Teknik Mudah Trendline.pdf',                     title: 'Teknik Mudah Trendline' },
  { file: 'Teknik Set & Forget.pdf',                        title: 'Teknik Set & Forget' },
  { file: 'Teknik Sharp Entry.pdf',                         title: 'Teknik Sharp Entry' },
  { file: 'Teknik Simple Follow Trend.pdf',                 title: 'Teknik Simple Follow Trend' },
  { file: 'TeknikDivergence.pdf',                           title: 'Teknik Divergence' },
  { file: 'Topik_Forex_Cara_Trading_Aussie.pdf',            title: 'Cara Trading Aussie' },
];

// Cek berapa e-book yang benar-benar ada di folder
function getAvailableEbooks() {
  return EBOOK_CATALOG.filter((eb) => {
    try {
      return fs.existsSync(path.join(EBOOK_DIR, eb.file));
    } catch {
      return false;
    }
  });
}

const PAGE_SIZE = 10;

function buildEbookListMsg(books, page, totalPages) {
  const start = (page - 1) * PAGE_SIZE;
  const slice = books.slice(start, start + PAGE_SIZE);

  const lines = slice.map((eb, i) => {
    const num = start + i + 1;
    return `${String(num).padStart(2, '0')}. 📄 ${eb.title}`;
  });

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📚 <b>AZZAVISION AI — E-BOOK FOREX</b>`,
    `📄 Halaman ${page}/${totalPages}  |  ${books.length} e-book tersedia`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `<code>${lines.join('\n')}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `💡 Ketik nomor e-book untuk download:`,
    `   Contoh: <code>/ebook 5</code>`,
    `   Contoh halaman: <code>/ebook list 2</code>`,
    ``,
    `⚡ <i>AZZAVISION AI | Forex Education Library</i>`,
  ].join('\n');
}

function registerEbook(bot) {
  bot.command('ebook', async (ctx) => {
    const args = (ctx.message?.text || '').split(' ').slice(1);
    const available = getAvailableEbooks();

    // Tidak ada e-book sama sekali
    if (available.length === 0) {
      return ctx.replyWithHTML([
        `📚 <b>E-Book Library</b>`,
        ``,
        `⚠️ <i>Folder e-book belum disiapkan atau kosong.</i>`,
        ``,
        `Letakkan file PDF di folder:`,
        `<code>data/ebooks/</code>`,
      ].join('\n'));
    }

    // /ebook list [page]
    if (args[0] === 'list' || args.length === 0) {
      const page = Math.max(1, parseInt(args[1] || args[0] === 'list' ? args[1] : '1') || 1);
      const totalPages = Math.ceil(available.length / PAGE_SIZE);
      const safePage   = Math.min(page, totalPages);

      const msg = buildEbookListMsg(available, safePage, totalPages);
      return ctx.replyWithHTML(msg);
    }

    // /ebook <nomor>
    const num = parseInt(args[0]);
    if (!isNaN(num) && num >= 1 && num <= available.length) {
      const eb     = available[num - 1];
      const fbPath = path.join(EBOOK_DIR, eb.file);

      let loading;
      try {
        loading = await ctx.replyWithHTML(`⏳ <b>Mengirim e-book...</b>\n📄 <i>${eb.title}</i>`);
      } catch { /* ignore */ }

      try {
        await ctx.replyWithDocument(
          { source: fs.createReadStream(fbPath), filename: eb.file },
          { caption: `📄 <b>${eb.title}</b>\n\n⚡ <i>AZZAVISION AI | Forex Education Library</i>`, parse_mode: 'HTML' }
        );
        if (loading) await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      } catch (err) {
        if (loading) await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
        await ctx.replyWithHTML(`❌ <b>Gagal kirim e-book.</b>\n<code>${err.message}</code>`);
      }
      return;
    }

    // Nomor tidak valid
    await ctx.replyWithHTML([
      `❌ <b>Nomor e-book tidak valid.</b>`,
      ``,
      `Ketik <code>/ebook</code> untuk lihat daftar.`,
      `Ketik <code>/ebook &lt;nomor&gt;</code> untuk download.`,
      `Contoh: <code>/ebook 5</code>`,
    ].join('\n'));
  });
}

module.exports = { registerEbook, getAvailableEbooks, EBOOK_CATALOG };
