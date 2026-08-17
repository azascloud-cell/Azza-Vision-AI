const { CALLBACK_REGISTRY } = require('./callback_registry');
const { getRecentLogs, getUnusedCallbacks, getCallbackStats } = require('./callback_logger');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

function registerDebugCommands(bot, registeredActions) {
  bot.command('callbackcheck', async (ctx) => {
    if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Owner only.</b>');
    const total = CALLBACK_REGISTRY.size;
    const connected = [], missing = [];
    for (const [key, label] of CALLBACK_REGISTRY) {
      if (registeredActions.has(key)) connected.push(`✅ ${label}`);
      else missing.push(`❌ ${label} (<code>${key}</code>)`);
    }
    await ctx.replyWithHTML([
      `━━━━━━━━━━━━━━━━━━`,
      `🔍 <b>CALLBACK CHECK</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      ...connected,
      ...(missing.length > 0 ? ['', ...missing] : []),
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `Total     : <code>${total}</code>`,
      `Connected : <code>${connected.length}</code>`,
      `Missing   : <code>${missing.length}</code>`,
      `━━━━━━━━━━━━━━━━━━`,
    ].join('\n'));
  });

  bot.command('callbacklog', async (ctx) => {
    if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Owner only.</b>');
    const logs = getRecentLogs(20);
    if (logs.length === 0) {
      return ctx.replyWithHTML(`━━━━━━━━━━━━━━━━━━\n📋 <b>CALLBACK LOG</b>\n━━━━━━━━━━━━━━━━━━\n\n⏳ <i>Belum ada callback tercatat.</i>`);
    }
    const rows = logs.map(l => {
      const hh   = String(l.time.getHours()).padStart(2, '0');
      const mm   = String(l.time.getMinutes()).padStart(2, '0');
      const icon = l.status === 'SUCCESS' ? '✅' : l.status === 'TIMEOUT' ? '⏱' : '❌';
      return `${icon} <code>${hh}:${mm}</code>  <b>${l.callback}</b>  <i>${l.status}</i>  <code>${l.durationMs}ms</code>`;
    });
    await ctx.replyWithHTML([
      `━━━━━━━━━━━━━━━━━━`,
      `📋 <b>CALLBACK LOG (20 terakhir)</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      ...rows,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
    ].join('\n'));
  });

  bot.command('buttonhealth', async (ctx) => {
    if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Owner only.</b>');
    const total   = CALLBACK_REGISTRY.size;
    const allKeys = [...CALLBACK_REGISTRY.keys()];
    const connected = allKeys.filter(k => registeredActions.has(k)).length;
    const broken    = total - connected;
    const unused    = getUnusedCallbacks(allKeys);
    const stats     = getCallbackStats();
    const health    = total > 0 ? Math.round((connected / total) * 100) : 100;
    const emoji     = health >= 90 ? '🟢' : health >= 70 ? '🟡' : '🔴';
    const unusedLines = unused.length > 0
      ? [``, `📦 <b>Unused (belum pernah dipanggil):</b>`, ...unused.map(k => `• <code>${k}</code>`)]
      : [``, `✅ <i>Semua callback sudah pernah digunakan.</i>`];
    await ctx.replyWithHTML([
      `━━━━━━━━━━━━━━━━━━`,
      `${emoji} <b>BUTTON HEALTH</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `🔘 Inline Button : <code>${total}</code>`,
      `🔗 Connected     : <code>${connected}</code>`,
      `❌ Broken        : <code>${broken}</code>`,
      `📦 Unused        : <code>${unused.length}</code>`,
      ``,
      `📊 Eksekusi: <code>${stats.total}</code> total | <code>${stats.success}</code> ok | <code>${stats.failed}</code> fail`,
      ``,
      `💯 Health Score  : <code>${health}%</code>`,
      ...unusedLines,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
    ].join('\n'));
  });
}

module.exports = { registerDebugCommands };
