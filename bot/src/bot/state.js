/**
 * state.js — Shared in-memory state untuk bot
 *
 * dashboardMessages: Map<chatId, messageId>
 * Digunakan oleh start.js untuk edit dashboard yang sudah ada (hemat pesan).
 */

const dashboardMessages = new Map();

module.exports = { dashboardMessages };
