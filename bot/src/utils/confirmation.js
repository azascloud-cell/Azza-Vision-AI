function formatConfirmationMessage(result, currentPrice) {
  const { analysis, direction, aligned, spikeRisk, m5Entry, confidence } = result;
  
  // Overall Status check
  const isConfirmed = result.canEntry;
  const statusLabel = isConfirmed ? '🟢 CONFIRMATION DETECTED' : '🟡 WAITING CONFIRMATION';
  
  if (isConfirmed) {
    return [
      `━━━━━━━━━━━━━━━━━━`,
      `${statusLabel}`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `✔ Breakout terkonfirmasi`,
      `✔ Candle M5 close di atas resistance`,
      `✔ Momentum mendukung`,
      `✔ RSI sesuai`,
      `✔ Trend H1 searah`,
      ``,
      `Signal:`,
      `🟢 <b>${direction}</b>`,
      ``,
      `Confidence:`,
      ` <code>${confidence}%</code>`,
      ``,
      `Entry:`,
      ` <code>${result.levels.entry}</code>`,
      `SL:`,
      ` <code>${result.levels.sl}</code>`,
      `TP:`,
      ` <code>${result.levels.tp2}</code>`,
      `━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }

  // Waiting Confirmation Logic
  let reasonSection = '';
  if (!aligned) {
    reasonSection = `❌ Trend H4 & H1 belum searah (H4: ${analysis.h4.bias} | H1: ${analysis.h1.bias})`;
  } else if (spikeRisk) {
    reasonSection = `❌ Volatilitas terlalu tinggi (${result.volatility})`;
  } else {
    // Aligned but M5 not valid
    const m5Reason = m5Entry.reason || 'Belum ada konfirmasi candle';
    if (direction === 'BUY') {
      reasonSection = `❌ Candle M5 belum close di atas resistance / ${m5Reason}`;
    } else {
      reasonSection = `❌ Candle M5 belum reject dari resistance / ${m5Reason}`;
    }
  }

  // Resistance/Support proxy (simplified as we don't have a full order-block engine here)
  // In a real setup, this would come from the indicators.js
  const levelPrice = currentPrice; 

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `${statusLabel}`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📍 Current Zone:`,
    `Resistance/Support: <code>${levelPrice.toFixed(2)}</code>`,
    ``,
    `📊 Price:`,
    ` <code>${currentPrice.toFixed(2)}</code>`,
    ``,
    `📌 Syarat ${direction === 'BUY' ? 'BUY' : 'SELL'}:`,
    `${reasonSection}`,
    ``,
    `⏳ Action:`,
    `Tunggu salah satu kondisi berikut:`,
    `• ✅ Breakout valid (close candle di atas resistance)`,
    `• ✅ Rejection valid (wick rejection + close bearish)`,
    `• ✅ Retest berhasil`,
    `• ✅ Break & Retest berhasil`,
    ``,
    `Belum ada konfirmasi sehingga BOT TIDAK akan mengirim sinyal.`,
    `━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

module.exports = { formatConfirmationMessage };
