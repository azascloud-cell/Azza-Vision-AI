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

// ─── LOAD AT STARTUP ──────────────────────────────────────────────────────────
/**
 * Dipanggil SEKALI saat startup. Baca channel_config.json dan
 * override process.env.CHANNEL_ID agar semua modul langsung pakai nilai baru.
 */
async function loadChannelId() {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    const config  = JSON.parse(content);
    if (config && config.channel_id) {
      process.env.CHANNEL_ID = config.channel_id;
      console.log(`[CHANNEL] Channel ID loaded from config: ${config.channel_id}`);
    }
  } catch {
    // File tidak ada → pakai CHANNEL_ID dari .env (sudah ada di process.env)
  }
}

// ─── SET CHANNEL ──────────────────────────────────────────────────────────────
/**
 * Simpan channel ID baru. Update process.env langsung (aktif tanpa restart)
 * dan tulis ke file (persisten setelah restart).
 */
async function setChannelId(channelId) {
  process.env.CHANNEL_ID = channelId;

  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });

  const config = {
    channel_id: channelId,
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

module.exports = { loadChannelId, setChannelId, getChannelConfig };
