/**
 * channel_store.js — Persistent Channel Management
 *
 * Menyimpan Channel ID secara permanen di data/channel_config.json.
 * Saat startup: baca file → override process.env.CHANNEL_ID.
 * Saat /setchannel: tulis file + update process.env.CHANNEL_ID (langsung aktif).
 *
 * Semua kode yang pakai process.env.CHANNEL_ID tetap bekerja tanpa perubahan.
 */

const fs   = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.resolve('./data/channel_config.json');
const DEFAULT_CHANNEL_ID = '-1003911611745';

// ─── LOAD AT STARTUP ──────────────────────────────────────────────────────────
/**
 * Dipanggil SEKALI saat startup. Baca channel_config.json dan
 * override process.env.CHANNEL_ID agar semua modul langsung pakai nilai baru.
 */
async function loadChannelId() {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    const config  = JSON.parse(content);
    process.env.CHANNEL_ID = DEFAULT_CHANNEL_ID;
    console.log(`[CHANNEL] Channel ID enforced: ${DEFAULT_CHANNEL_ID}`);
  } catch {
    process.env.CHANNEL_ID = DEFAULT_CHANNEL_ID;
    console.log(`[CHANNEL] Channel ID default: ${DEFAULT_CHANNEL_ID}`);
  }
}

// ─── SET CHANNEL ──────────────────────────────────────────────────────────────
/**
 * Simpan channel ID baru. Update process.env langsung (aktif tanpa restart)
 * dan tulis ke file (persisten setelah restart).
 */
async function setChannelId(channelId) {
  if (String(channelId) !== DEFAULT_CHANNEL_ID) {
    throw new Error(`Channel aktif harus ${DEFAULT_CHANNEL_ID}.`);
  }
  process.env.CHANNEL_ID = DEFAULT_CHANNEL_ID;

  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });

  const config = {
    channel_id: DEFAULT_CHANNEL_ID,
    updated_at: new Date().toISOString(),
    set_by: 'owner_command',
  };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log(`[CHANNEL] Channel ID disimpan: ${channelId}`);
}

// ─── GET CONFIG (untuk /channel command) ─────────────────────────────────────
async function getChannelConfig() {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    const config  = JSON.parse(content);
    return {
      channel_id: config.channel_id || null,
      updated_at: config.updated_at || null,
      source:     'config_file',
    };
  } catch {
    return {
      channel_id: process.env.CHANNEL_ID || null,
      updated_at: null,
      source:     'env',
    };
  }
}

module.exports = { loadChannelId, setChannelId, getChannelConfig, DEFAULT_CHANNEL_ID };
