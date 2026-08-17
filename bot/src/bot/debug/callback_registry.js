const CALLBACK_REGISTRY = new Map([
  ['menu_market',    'Market Analysis'],
  ['menu_stats',     'Statistik'],
  ['menu_daily',     'Laporan Harian'],
  ['menu_daily7',    'Ringkasan 7 Hari'],
  ['menu_status',    'Bot Status'],
  ['menu_journal',   'Signal Journal'],
  ['menu_help',      'Panduan'],
  ['menu_bt7',       'Backtest 7 Hari'],
  ['menu_bt30',      'Backtest 30 Hari'],
  ['menu_forcebuy',  'Force BUY (owner)'],
  ['menu_forcesell', 'Force SELL (owner)'],
  ['menu_refresh',   'Refresh Harga'],
  ['menu_back',      'Kembali ke Menu'],
  ['menu_mm',        'Money Management'],
  ['scan_refresh',   'Scan Refresh'],
  ['force_buy',      'Force BUY (scan)'],
  ['force_sell',     'Force SELL (scan)'],
  ['scan_market',    'Scan Market'],
  ['scan_stats',     'Scan Stats'],
  ['scan_status',    'Scan Status'],
  ['exp_xls_today',  'Export Excel - Hari Ini'],
  ['exp_xls_7d',     'Export Excel - 7 Hari'],
  ['exp_xls_30d',    'Export Excel - 30 Hari'],
  ['exp_xls_all',    'Export Excel - Semua'],
  ['exp_pdf_today',  'Export PDF - Hari Ini'],
  ['exp_pdf_7d',     'Export PDF - 7 Hari'],
  ['exp_pdf_30d',    'Export PDF - 30 Hari'],
  ['exp_pdf_all',    'Export PDF - Semua'],
]);

const COMMAND_REGISTRY = new Set([
  'start', 'help', 'market', 'stats', 'status',
  'forcebuy', 'forcesell', 'forcetp1', 'forcetp2', 'forcebe', 'forceloss', 'reload',
  'backtest', 'daily', 'daily7', 'journal',
  'signaltest', 'scan', 'learnstats', 'similarity', 'retrain',
  'apikeys', 'ebook', 'ebookstrats',
  'why', 'watchlist', 'stratstats', 'learning',
  'ai', 'setchannel', 'channel', 'channelstats',
  'news', 'apikey', 'provider',
  'balance', 'risk', 'broker', 'lot', 'profile',
  'callbackcheck', 'callbacklog', 'buttonhealth',
  // ── v4.0 Backup Engine ────────────────────────────────────────────────────
  'backup', 'backupstatus', 'backuphistory', 'restorelist', 'selftest',
  // ── v4.0 Debug Mode ───────────────────────────────────────────────────────
  'debug',
]);

module.exports = { CALLBACK_REGISTRY, COMMAND_REGISTRY };
