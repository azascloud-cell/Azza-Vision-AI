const { getOpenSignals, getLastSignalTime } = require('../../database/db');
const { getMarketStatus }                   = require('../../utils/market_hours');
const { getStatusSummary }                  = require('../../market/key_manager');
const { toWIB, isoToWIBShort }             = require('../../utils/wib_time');
const { renderBanner }                      = require('../../banner');

let startTime = Date.now();

function setStartTime(t) {
  startTime = t;
}

function registerStatus(bot) {
  bot.command('status', async (ctx) => {
    try {
      const openSignals = await getOpenSignals();
      const lastSignal  = await getLastSignalTime();
      const uptime      = formatUptime(Date.now() - startTime);
      const interval    = parseInt(process.env.SCAN_INTERVAL || '6000') / 1000;
      const wib         = toWIB();

      // API key summary
      let keyLine = '';
      try {
        const keySummary   = getStatusSummary();
        const throttleInfo = keySummary.totalThrottle > 0
          ? ` | ⚡ ${keySummary.totalThrottle} throttled`
          : '';
        keyLine = `\n🔑 <b>API Keys</b>  : <code>${keySummary.totalActive} aktif / ${keySummary.total} total | ${keySummary.totalCooling} cooling | ${keySummary.totalInvalid} invalid${throttleInfo}</code>`;
      } catch { /* non-fatal */ }

      const openLines = openSignals.length > 0
        ? openSignals.slice(0, 3).map((s) => {
            const tp1done  = s.tp1_hit             ? ' ✅TP1' : '';
            const beActive = s.breakeven_triggered  ? ' 🔒BE'  : '';
            // Tampilkan waktu open sinyal dalam WIB
            const openWIB  = s.created_at ? isoToWIBShort(s.created_at) : '-';
            return `  • ${s.direction} @ ${s.entry} (conf: ${s.confidence}%) — ${openWIB}${tp1done}${beActive}`;
          }).join('\n')
        : '  Tidak ada sinyal terbuka saat ini.';

      const mkt = getMarketStatus();
      const marketStatusLine = mkt.open
        ? `${mkt.emoji} <b>Market</b>    : OPEN | ${mkt.session}`
        : `${mkt.emoji} <b>Market</b>    : CLOSED | ${mkt.session}${mkt.timeUntilOpen ? '\n⏱ <b>Buka dalam</b>: <code>' + mkt.timeUntilOpen + '</code>' : ''}`;

      const scannerStatusLine = mkt.open
        ? `🟢 <b>Scanner</b>   : AKTIF`
        : `🟡 <b>Scanner</b>   : PAUSED (market tutup)`;

      // Waktu sinyal terakhir dalam WIB
      const lastSignalWIB = lastSignal ? isoToWIBShort(lastSignal) : 'Belum ada sinyal';

      const msg = [
        `🔍 <b>AZZAVISION AI — BOT STATUS</b>`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🟢 <b>Status</b>    : ONLINE & AKTIF`,
        `⏱ <b>Uptime</b>    : <code>${uptime}</code>`,
        marketStatusLine,
        scannerStatusLine,
        `📡 <b>Interval</b>  : <code>${interval}s price tick | ${interval * 5}s full analysis</code>`,
        `🎯 <b>Min Conf</b>  : <code>${process.env.MIN_CONFIDENCE || '65'}%</code>${keyLine}`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `📌 <b>OPEN SIGNALS (${openSignals.length})</b>`,
        openLines,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🕐 <b>Sinyal Terakhir</b>:`,
        `  ${lastSignalWIB}`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        wib.line,
        ``,
        `🪙 <b>Pair</b>   : XAUUSD`,
        `📊 <b>Data</b>   : Twelve Data (realtime)`,
        `💾 <b>DB</b>     : JSON Storage`,
        `🔒 <b>BE Protection</b>  : +28 pips → SL pindah ke entry`,
        ``,
        `⚡ <i>AZZAVISION AI v3.0 — Auto Gold Signals</i>`,
      ].join('\n');

      try {
        const buffer = await renderBanner('dashboard', {
          sections: [
            {
              heading: 'System',
              rows: [
                { label: 'Status', value: 'ONLINE', color: '#2ECC71' },
                { label: 'Uptime', value: uptime },
                { label: 'Market', value: mkt.open ? `OPEN (${mkt.session})` : `CLOSED (${mkt.session})`, color: mkt.open ? '#2ECC71' : '#F14158' },
                { label: 'Scanner', value: mkt.open ? 'AKTIF' : 'PAUSED' },
                { label: 'Min Confidence', value: `${process.env.MIN_CONFIDENCE || '65'}%` },
              ],
            },
            {
              heading: `Open Signals (${openSignals.length})`,
              rows: openSignals.slice(0, 4).map((s) => ({
                label: `${s.direction} @ ${s.entry}`,
                value: `${s.confidence}%`,
              })),
            },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[STATUS-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('[STATUS] Error:', err);
      await ctx.replyWithHTML(
        `❌ <b>Gagal mengambil status.</b>\n<code>${err.message}</code>`
      );
    }
  });
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

module.exports = { registerStatus, setStartTime };
