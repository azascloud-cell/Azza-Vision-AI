const { CALLBACK_REGISTRY, COMMAND_REGISTRY } = require('./callback_registry');

async function runCallbackValidation(bot, registeredActions, registeredCommands) {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId) return;

  const missingCallbacks = [];
  for (const [key] of CALLBACK_REGISTRY) {
    if (!registeredActions.has(key)) missingCallbacks.push(key);
  }

  const missingCommands = [];
  for (const cmd of COMMAND_REGISTRY) {
    if (!registeredCommands.has(cmd)) missingCommands.push(cmd);
  }

  if (missingCallbacks.length > 0) {
    console.warn('[VALIDATOR] ⚠️  Callback tanpa handler:', missingCallbacks.join(', '));
  } else {
    console.log('[VALIDATOR] ✅ Semua callback terhubung.');
  }

  if (missingCommands.length > 0) {
    console.warn('[VALIDATOR] ⚠️  Command tanpa handler:', missingCommands.join(', '));
  } else {
    console.log('[VALIDATOR] ✅ Semua command terdaftar.');
  }

  try {
    if (missingCallbacks.length > 0) {
      await bot.telegram.sendMessage(ownerId, [
        `━━━━━━━━━━━━━━━━━━`,
        `⚠️ <b>CALLBACK VALIDATION</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `Callback <b>tanpa handler</b>:`,
        ...missingCallbacks.map(c => `• <code>${c}</code>`),
        ``,
        `Cek via: /callbackcheck`,
        `━━━━━━━━━━━━━━━━━━`,
      ].join('\n'), { parse_mode: 'HTML' });
    }
    if (missingCommands.length > 0) {
      await bot.telegram.sendMessage(ownerId, [
        `━━━━━━━━━━━━━━━━━━`,
        `⚠️ <b>COMMAND VALIDATION</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        ...missingCommands.map(c => `• <code>/${c}</code>`),
        `━━━━━━━━━━━━━━━━━━`,
      ].join('\n'), { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.warn('[VALIDATOR] Gagal kirim notifikasi:', err.message);
  }
}

module.exports = { runCallbackValidation };
