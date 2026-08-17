const { createCanvas } = require('@napi-rs/canvas');

const WIDTH  = 1200;
const HEIGHT = 720;

const COLORS = {
  bg:         '#0d1117',
  bgCard:     '#161b22',
  bgPanel:    '#1c2128',
  border:     '#30363d',
  bull:       '#26a17b',
  bear:       '#ef4444',
  entry:      '#f59e0b',
  tp:         '#22c55e',
  sl:         '#ef4444',
  tp2:        '#10b981',
  text:       '#e6edf3',
  textMuted:  '#8b949e',
  textDim:    '#484f58',
  gold:       '#d4af37',
  accent:     '#58a6ff',
  gridLine:   '#21262d',
  watermark:  'rgba(212,175,55,0.06)',
};

const SESSION_COLORS = {
  Sydney:  '#58a6ff',
  Tokyo:   '#f79000',
  London:  '#26a17b',
  NewYork: '#ef4444',
  Overlap: '#a855f7',
};

function getCurrentSession() {
  const utcHour = new Date().getUTCHours();
  if (utcHour >= 22 || utcHour < 7)  return 'Sydney';
  if (utcHour >= 0  && utcHour < 9)  return 'Tokyo';
  if (utcHour >= 7  && utcHour < 16) return 'London';
  if (utcHour >= 13 && utcHour < 22) return 'NewYork';
  return 'Overlap';
}

function biasLabel(bias) {
  return bias.replace(/_/g, ' ');
}

function biasColor(bias) {
  if (bias.includes('BUY'))  return COLORS.bull;
  if (bias.includes('SELL')) return COLORS.bear;
  return '#e6a817';
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHeader(ctx, direction, confidence) {
  const grad = ctx.createLinearGradient(0, 0, WIDTH, 85);
  grad.addColorStop(0, '#0d1117');
  grad.addColorStop(1, direction === 'BUY' ? 'rgba(38,161,123,0.18)' : 'rgba(239,68,68,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, 85);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('⚡ AZZAVISION AI', 30, 46);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '14px sans-serif';
  ctx.fillText('XAUUSD • Premium Signal v2.5.0', 30, 68);

  // Session badge
  const session      = getCurrentSession();
  const sessionColor = SESSION_COLORS[session] || COLORS.accent;
  ctx.fillStyle = sessionColor + '22';
  drawRoundRect(ctx, WIDTH / 2 - 80, 20, 160, 30, 8);
  ctx.fill();
  ctx.strokeStyle = sessionColor;
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.fillStyle   = sessionColor;
  ctx.font        = 'bold 13px sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText(`🕐 ${session} Session`, WIDTH / 2, 41);
  ctx.textAlign   = 'left';

  ctx.fillStyle = direction === 'BUY' ? COLORS.bull : COLORS.bear;
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(direction === 'BUY' ? '▲ BUY' : '▼ SELL', WIDTH - 30, 52);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`Confidence: ${confidence}%`, WIDTH - 30, 72);
  ctx.textAlign = 'left';

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 85);
  ctx.lineTo(WIDTH, 85);
  ctx.stroke();
}

function drawPriceLevels(ctx, entry, tp1, tp2, sl, direction) {
  const chartX = 30;
  const chartY = 105;
  const chartW = 700;
  const chartH = 480;

  ctx.fillStyle = COLORS.bgCard;
  drawRoundRect(ctx, chartX, chartY, chartW, chartH, 10);
  ctx.fill();

  const prices   = [entry, tp1, tp2, sl];
  const minPrice = Math.min(...prices) - 2;
  const maxPrice = Math.max(...prices) + 2;
  const priceRange = maxPrice - minPrice;

  function priceToY(price) {
    return chartY + chartH - ((price - minPrice) / priceRange) * chartH;
  }

  for (let i = 0; i <= 8; i++) {
    const y     = chartY + (chartH / 8) * i;
    const price = maxPrice - (priceRange / 8) * i;
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(chartX + 60, y);
    ctx.lineTo(chartX + chartW - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.textDim;
    ctx.font      = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(price.toFixed(2), chartX + 54, y + 4);
    ctx.textAlign = 'left';
  }

  const drawLevel = (price, color, label, dash = false) => {
    const y = priceToY(price);
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 2;
    ctx.globalAlpha  = 0.85;
    if (dash) ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 60, y);
    ctx.lineTo(chartX + chartW - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    drawRoundRect(ctx, chartX + chartW - 120, y - 12, 108, 24, 6);
    ctx.fillStyle   = color + '22';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.fillStyle   = color;
    ctx.font        = 'bold 12px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(`${label}: ${price.toFixed(2)}`, chartX + chartW - 66, y + 5);
    ctx.textAlign   = 'left';
  };

  // BE trigger line (dashed amber)
  const bePrice   = direction === 'BUY' ? entry + 2.8 : entry - 2.8; // 28 pips = 2.8 points
  const bePriceY  = priceToY(bePrice);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.4;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(chartX + 60, bePriceY);
  ctx.lineTo(chartX + chartW - 130, bePriceY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle   = '#f59e0b88';
  ctx.font        = '10px sans-serif';
  ctx.fillText('BE +28', chartX + 62, bePriceY - 3);

  if (direction === 'BUY') {
    const fillGradTP = ctx.createLinearGradient(chartX + 60, priceToY(tp2), chartX + 60, priceToY(entry));
    fillGradTP.addColorStop(0, 'rgba(34,197,94,0.18)');
    fillGradTP.addColorStop(1, 'rgba(34,197,94,0.02)');
    ctx.fillStyle = fillGradTP;
    ctx.fillRect(chartX + 60, priceToY(tp2), chartW - 70, priceToY(entry) - priceToY(tp2));

    const fillGradSL = ctx.createLinearGradient(chartX + 60, priceToY(entry), chartX + 60, priceToY(sl));
    fillGradSL.addColorStop(0, 'rgba(239,68,68,0.02)');
    fillGradSL.addColorStop(1, 'rgba(239,68,68,0.18)');
    ctx.fillStyle = fillGradSL;
    ctx.fillRect(chartX + 60, priceToY(entry), chartW - 70, priceToY(sl) - priceToY(entry));
  } else {
    const fillGradTP = ctx.createLinearGradient(chartX + 60, priceToY(entry), chartX + 60, priceToY(tp2));
    fillGradTP.addColorStop(0, 'rgba(34,197,94,0.02)');
    fillGradTP.addColorStop(1, 'rgba(34,197,94,0.18)');
    ctx.fillStyle = fillGradTP;
    ctx.fillRect(chartX + 60, priceToY(entry), chartW - 70, priceToY(tp2) - priceToY(entry));

    const fillGradSL = ctx.createLinearGradient(chartX + 60, priceToY(sl), chartX + 60, priceToY(entry));
    fillGradSL.addColorStop(0, 'rgba(239,68,68,0.18)');
    fillGradSL.addColorStop(1, 'rgba(239,68,68,0.02)');
    ctx.fillStyle = fillGradSL;
    ctx.fillRect(chartX + 60, priceToY(sl), chartW - 70, priceToY(entry) - priceToY(sl));
  }

  drawLevel(tp2, COLORS.tp2, 'TP2', true);
  drawLevel(tp1, COLORS.tp, 'TP1');
  drawLevel(entry, COLORS.entry, 'ENTRY');
  drawLevel(sl, COLORS.sl, 'SL');

  const entryY = priceToY(entry);
  ctx.fillStyle   = COLORS.entry;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(chartX + 60, entryY);
  ctx.lineTo(chartX + 90, entryY - 16);
  ctx.lineTo(chartX + 90, entryY + 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRRPanel(ctx, entry, tp1, tp2, sl) {
  const panelX = 760;
  const panelY = 450;
  const panelW = 410;
  const panelH = 135;

  ctx.fillStyle = COLORS.bgCard;
  drawRoundRect(ctx, panelX, panelY, panelW, panelH, 10);
  ctx.fill();

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText('📐 RISK : REWARD', panelX + 20, panelY + 28);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 20, panelY + 38);
  ctx.lineTo(panelX + panelW - 20, panelY + 38);
  ctx.stroke();

  const riskPips  = Math.round(Math.abs(entry - sl) / 0.1);
  const rrTp1     = (Math.abs(tp1 - entry) / Math.abs(entry - sl)).toFixed(2);
  const rrTp2     = (Math.abs(tp2 - entry) / Math.abs(entry - sl)).toFixed(2);
  const pipsTp1   = Math.round(Math.abs(tp1 - entry) / 0.1);
  const pipsTp2   = Math.round(Math.abs(tp2 - entry) / 0.1);

  const rrItems = [
    { label: 'SL   ', value: `${riskPips} pips`, color: COLORS.sl },
    { label: 'TP1  ', value: `+${pipsTp1} pips  |  1 : ${rrTp1}`, color: COLORS.tp },
    { label: 'TP2  ', value: `+${pipsTp2} pips  |  1 : ${rrTp2}`, color: COLORS.tp2 },
    { label: 'BE   ', value: `+28 pips trigger`, color: '#f59e0b' },
  ];

  rrItems.forEach(({ label, value, color }, i) => {
    const y = panelY + 58 + i * 20;
    ctx.fillStyle = color;
    ctx.font      = 'bold 12px monospace';
    ctx.fillText(label, panelX + 20, y);
    ctx.fillStyle = COLORS.text;
    ctx.font      = '12px monospace';
    ctx.fillText(value, panelX + 70, y);
  });
}

function drawAnalysisPanel(ctx, analysis) {
  const panelX = 760;
  const panelY = 105;
  const panelW = 410;
  const panelH = 335;

  ctx.fillStyle = COLORS.bgCard;
  drawRoundRect(ctx, panelX, panelY, panelW, panelH, 10);
  ctx.fill();

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 14px sans-serif';
  ctx.fillText('📊 TIMEFRAME ANALYSIS', panelX + 20, panelY + 28);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 20, panelY + 38);
  ctx.lineTo(panelX + panelW - 20, panelY + 38);
  ctx.stroke();

  const tfs = [
    { label: 'H4', data: analysis.h4 },
    { label: 'H1', data: analysis.h1 },
    { label: 'M15', data: analysis.m15 },
    { label: 'M5', data: analysis.m5 },
    { label: 'M1', data: analysis.m1 },
  ];

  tfs.forEach(({ label, data }, i) => {
    const y     = panelY + 60 + i * 54;
    const color = biasColor(data.bias);

    ctx.fillStyle   = color + '18';
    drawRoundRect(ctx, panelX + 15, y - 14, panelW - 30, 44, 8);
    ctx.fill();

    ctx.strokeStyle = color + '55';
    ctx.lineWidth   = 1;
    drawRoundRect(ctx, panelX + 15, y - 14, panelW - 30, 44, 8);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font      = 'bold 16px monospace';
    ctx.fillText(label, panelX + 30, y + 6);

    ctx.fillStyle = COLORS.text;
    ctx.font      = 'bold 13px sans-serif';
    ctx.fillText(biasLabel(data.bias), panelX + 80, y + 6);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = '11px monospace';
    ctx.fillText(`RSI: ${(data.rsi || 50).toFixed(1)}`, panelX + 80, y + 22);

    const barW    = 120;
    const barFill = (data.strength / 100) * barW;
    ctx.fillStyle = COLORS.bgPanel;
    drawRoundRect(ctx, panelX + 250, y - 2, barW, 10, 4);
    ctx.fill();
    ctx.fillStyle = color;
    drawRoundRect(ctx, panelX + 250, y - 2, barFill, 10, 4);
    ctx.fill();

    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${data.strength}%`, panelX + panelW - 20, y + 6);
    ctx.textAlign = 'left';
  });
}

function drawFooter(ctx) {
  ctx.fillStyle = COLORS.bgCard;
  ctx.fillRect(0, HEIGHT - 55, WIDTH, 55);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 55);
  ctx.lineTo(WIDTH, HEIGHT - 55);
  ctx.stroke();

  // Tampilkan waktu generate dalam WIB — bukan UTC
  const { toWIB } = require('../utils/wib_time');
  const wibNow = toWIB();
  const tsWIB  = `${wibNow.dateNum} ${wibNow.month.slice(0,3)} ${wibNow.year} ${wibNow.hours}:${wibNow.minutes} WIB`;

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText('⚡ AZZAVISION AI v3.0', 30, HEIGHT - 22);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font      = '12px monospace';
  ctx.fillText(`Generated: ${tsWIB}`, 30, HEIGHT - 8);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font      = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Risk: SL 40pts • TP1 60pts (1:1.5) • TP2 125pts (1:3.125) • BE +28pts', WIDTH - 30, HEIGHT - 22);
  ctx.fillText('⚠️ Trading involves risk. Manage your lot. DYOR.', WIDTH - 30, HEIGHT - 8);
  ctx.textAlign = 'left';
}

function drawWatermark(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle   = COLORS.gold;
  ctx.font        = 'bold 120px sans-serif';
  ctx.textAlign   = 'center';
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.rotate(-0.3);
  ctx.fillText('AZZAVISION AI', 0, 0);
  ctx.restore();
}

async function generateSignalChart({ direction, entry, tp1, tp2, sl, confidence, analysis }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawWatermark(ctx);
  drawHeader(ctx, direction, confidence);
  drawPriceLevels(ctx, entry, tp1, tp2, sl, direction);
  drawAnalysisPanel(ctx, analysis);
  drawRRPanel(ctx, entry, tp1, tp2, sl);
  drawFooter(ctx);

  return canvas.toBuffer('image/png');
}

module.exports = { generateSignalChart };
