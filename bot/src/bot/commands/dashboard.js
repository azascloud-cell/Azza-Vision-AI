/**
 * dashboard.js — Dashboard URL Command
 *
 * /dashboard           — Tampilkan tombol link ke dashboard web (semua user)
 * /setdashboard <url>  — Owner only. Simpan URL dashboard baru (persisten).
 *
 * URL disimpan di data/dashboard_config.json agar tetap ada setelah restart.
 * Cocok untuk Cloudflare tunnel yang URLnya berubah setiap restart:
 *   → setelah restart, cukup jalankan /setdashboard <url_baru> sekali saja.
 */

'use strict';

const fs   = require('fs').promises;
const path = require('path');
const { Markup } = require('telegraf');

const CONFIG_PATH  = path.resolve('./data/dashboard_config.json');
const TUNNEL_FILE  = path.resolve('./tunnel-url.txt');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── Baca tunnel URL otomatis dari tunnel-url.txt ────────────────────────────
async function getTunnelUrl() {
  try {
    const raw = await fs.readFile(TUNNEL_FILE, 'utf8');
    const url = raw.trim();
    return url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

// ─── Baca URL: config manual → tunnel-url.txt → env ─────────────────────────
async function getDashboardConfig() {
  // 1. Cek config manual (/setdashboard)
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(content);
    if (cfg?.url) return { ...cfg, source: 'manual' };
  } catch {}

  // 2. Baca tunnel-url.txt otomatis (ditulis launcher setiap start)
  const tunnelUrl = await getTunnelUrl();
  if (tunnelUrl) {
    return { url: tunnelUrl, updated_at: null, source: 'auto' };
  }

  // 3. Env var fallback
  const envUrl = process.env.DASHBOARD_URL || '';
  if (envUrl) return { url: envUrl, updated_at: null, source: 'env' };

  return null;
}

// ─── Simpan URL ke file config ────────────────────────────────────────────────
async function saveDashboardUrl(url) {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  const config = {
    url,
    updated_at: new Date().toISOString(),
    set_by: 'owner_command',
  };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

// ─── Register Commands ────────────────────────────────────────────────────────
function registerDashboardCommands(bot) {

  // ─── /dashboard ─────────────────────────────────────────────────────────────
  bot.command('dashboard', async (ctx) => {
    try {
      const config = await getDashboardConfig();
      const url    = config?.url || process.env.DASHBOARD_URL || '';

      if (!url) {
        const ownerHint = isOwner(ctx)
          ? `\n\n💡 <b>Set URL dashboard:</b>\n<code>/setdashboard https://xxxxx.trycloudflare.com</code>`
          : `\n\n⚠️ <i>Hubungi owner untuk mengaktifkan link dashboard.</i>`;

        return ctx.replyWithHTML(
          `🌐 <b>AZZAVISION AI — Dashboard</b>\n\n` +
          `❌ <i>URL dashboard belum diset.</i>${ownerHint}`
        );
      }

      const sourceLabel = config.source === 'auto'
        ? '🤖 <i>Otomatis dari tunnel aktif</i>'
        : config.source === 'manual' && config.updated_at
          ? `📌 <i>Set manual: ${new Date(config.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Kuala_Lumpur' })}</i>`
          : '';

      if (isOwner(ctx)) {
        // Owner: tampilkan URL langsung (bisa di-copy) + tombol
        await ctx.replyWithHTML(
          `🌐 <b>AZZAVISION AI — Dashboard</b>\n\n` +
          `🔗 <b>URL Dashboard:</b>\n<code>${url}</code>\n` +
          (sourceLabel ? `${sourceLabel}\n` : '') +
          `\nKlik tombol atau copy URL di atas:`,
          Markup.inlineKeyboard([
            [Markup.button.url('🚀 Buka Dashboard', url)],
          ])
        );
      } else {
        // User biasa: tombol saja
        await ctx.replyWithHTML(
          `🌐 <b>AZZAVISION AI — Dashboard</b>\n\n` +
          `Klik tombol di bawah untuk buka dashboard web:${sourceLabel ? "\n\n" + sourceLabel : ""}`,
          Markup.inlineKeyboard([
            [Markup.button.url('🚀 Buka Dashboard', url)],
          ])
        );
      }

    } catch (err) {
      await ctx.replyWithHTML(`❌ <b>Error:</b> <code>${err.message}</code>`);
    }
  });

  // ─── /setdashboard <url> ─────────────────────────────────────────────────────
  bot.command('setdashboard', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    const text  = ctx.message?.text?.trim() || '';
    const parts = text.split(/\s+/);
    const url   = parts[1]?.trim();

    if (!url) {
      const config = await getDashboardConfig();
      const currentUrl = config?.url || process.env.DASHBOARD_URL || '(belum diset)';
      return ctx.replyWithHTML(
        `⚙️ <b>Set URL Dashboard</b>\n\n` +
        `📌 <b>URL sekarang:</b>\n<code>${currentUrl}</code>\n\n` +
        `💡 <b>Cara ganti:</b>\n` +
        `<code>/setdashboard https://xxxxx.trycloudflare.com</code>\n\n` +
        `<i>Jalankan ini setelah setiap restart Cloudflare tunnel.</i>`
      );
    }

    // Validasi format URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return ctx.replyWithHTML(
        `❌ <b>URL tidak valid.</b>\n\n` +
        `URL harus dimulai dengan <code>http://</code> atau <code>https://</code>\n\n` +
        `Contoh:\n<code>/setdashboard https://xxxxx.trycloudflare.com</code>`
      );
    }

    try {
      const oldConfig = await getDashboardConfig();
      const oldUrl    = oldConfig?.url || '(belum diset)';
      const saved     = await saveDashboardUrl(url);

      await ctx.replyWithHTML(
        `✅ <b>URL Dashboard berhasil disimpan!</b>\n\n` +
        `📌 <b>Sebelumnya</b> : <code>${oldUrl}</code>\n` +
        `📌 <b>Sekarang</b>   : <code>${url}</code>\n\n` +
        `🔄 Aktif langsung — tombol /dashboard sekarang pakai URL baru.\n` +
        `💾 Tersimpan permanen di <code>data/dashboard_config.json</code>.`,
        Markup.inlineKeyboard([
          [Markup.button.url('🚀 Test Dashboard', url)],
        ])
      );
    } catch (err) {
      await ctx.replyWithHTML(`❌ <b>Gagal menyimpan:</b> <code>${err.message}</code>`);
    }
  });
}

module.exports = { registerDashboardCommands };
