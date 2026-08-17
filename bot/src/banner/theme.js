'use strict';

// ─── AzzaVision AI — Shared Visual Theme ────────────────────────────────────
// Single source of truth for colors, fonts and layout constants so every
// banner in the system stays visually consistent (Premium Black + Gold).

const COLORS = {
  bgBlack: '#05070D',
  panelFill: 'rgba(255,255,255,0.035)',
  panelFillStrong: 'rgba(255,255,255,0.06)',
  panelBorder: 'rgba(212,175,55,0.35)',
  panelBorderSoft: 'rgba(212,175,55,0.18)',
  divider: 'rgba(212,175,55,0.25)',

  gold: '#D4AF37',
  goldBright: '#F4D57A',
  goldDeep: '#9C7A20',

  textPrimary: '#F5EFE0',
  textSecondary: '#C9C2AE',
  textMuted: '#8A8F9E',

  green: '#2ECC71',
  greenSoft: 'rgba(46,204,113,0.16)',
  red: '#F14158',
  redSoft: 'rgba(241,65,88,0.16)',
  blue: '#3FB6F0',
  blueSoft: 'rgba(63,182,240,0.16)',
};

// Accent variant -> background asset + accent color mapping.
const ACCENTS = {
  gold: { bg: 'bg_gold', color: COLORS.gold, soft: 'rgba(212,175,55,0.16)' },
  green: { bg: 'bg_green', color: COLORS.green, soft: COLORS.greenSoft },
  red: { bg: 'bg_red', color: COLORS.red, soft: COLORS.redSoft },
  blue: { bg: 'bg_blue', color: COLORS.blue, soft: COLORS.blueSoft },
};

const FONT = {
  display: 'AV Rajdhani',
  body: 'AV Poppins',
};

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const BRAND_NAME = 'AZZAVISION AI';
const BRAND_TAGLINE = 'AI GOLD TRADING ASSISTANT';
const FOOTER_QUOTE = 'TRADE WITH DISCIPLINE — NOT EMOTION';

module.exports = { COLORS, ACCENTS, FONT, CANVAS_W, CANVAS_H, BRAND_NAME, BRAND_TAGLINE, FOOTER_QUOTE };
