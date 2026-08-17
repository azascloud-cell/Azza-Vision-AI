const { getLearnStats } = require('../../analysis/learning');
const { getBackupInfo } = require('../../utils/backup');

function registerLearnStats(bot) {
  bot.command('learnstats', async (ctx) => {
    try {
      const s = await getLearnStats();

      const FULL_ADAPTIVE   = 100;
      const decidedTrades   = s.wins + s.losses;
      const winRate         = decidedTrades > 0
        ? ((s.wins / decidedTrades) * 100).toFixed(1)
        : '0.0';

      // Status label sesuai spec
      let statusEmoji, statusLabel;
      if (s.learningStatus === 'Not enough data') {
        statusEmoji = '🔴';
        statusLabel = 'Not enough data';
      } else if (s.learningStatus === 'PARTIAL') {
        statusEmoji = '🟡';
        statusLabel = `ACTIVE (${s.closed}/${FULL_ADAPTIVE} menuju Full Adaptive)`;
      } else {
        statusEmoji = '🟢';
        statusLabel = 'ACTIVE';
      }

      // Info backup (non-blocking)
      let backupLine = '';
      try {
        const bk = await getBackupInfo();
        backupLine = `\n💾 <b>Backups</b>    : <code>${bk.count}</code> file di backups/`;
      } catch { /* skip */ }

      // Progress bar dataset
      const barFull   = 10;
      const barFilled = Math.min(Math.round((s.closed / FULL_ADAPTIVE) * barFull), barFull);
      const progressBar = '█'.repeat(barFilled) + '░'.repeat(barFull - barFilled);
      const progressPct = Math.min(Math.round((s.closed / FULL_ADAPTIVE) * 100), 100);

      const neededLine = s.learningStatus === 'Not enough data'
        ? `\n⏳ <b>Butuh</b>      : <code>${s.needed}</code> trade lagi untuk aktifkan Learning`
        : s.learningStatus === 'PARTIAL'
          ? `\n⏳ <b>Butuh</b>      : <code>${s.neededFull}</code> trade lagi untuk Full Adaptive`
          : `\n🏆 <b>Full Adaptive</b> aktif — model belajar penuh!`;

      const avgSimLine = s.avgSimilarity != null
        ? `\n📊 <b>Avg Sim</b>    : <code>${s.avgSimilarity}%</code>`
        : '';

      const msg = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `🧠 <b>AZZAVISION AI — LEARNING STATUS</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📚 <b>Dataset</b>   : <code>${s.closed}</code> trades`,
        ``,
        `✅ <b>WIN</b>        : <code>${s.wins}</code>`,
        `❌ <b>LOSS</b>       : <code>${s.losses}</code>`,
        `🔒 <b>BREAKEVEN</b> : <code>${s.breakevens}</code>`,
        ``,
        `🎯 <b>Win Rate</b>  : <code>${winRate}%</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${statusEmoji} <b>Learning</b>  : ${statusLabel}${neededLine}${avgSimLine}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📈 <code>[${progressBar}]</code> <code>${progressPct}%</code>${backupLine}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `ℹ️ <i>Win Rate = WIN / (WIN+LOSS) — BREAKEVEN dikecualikan</i>`,
        `💡 <i>Bot auto-retrain setiap trade selesai & saat startup</i>`,
        `⚡ <i>AZZAVISION AI v2.1 | Self-Learning Engine</i>`,
      ].join('\n');

      await ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('[LEARNSTATS] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil data learning.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerLearnStats };
