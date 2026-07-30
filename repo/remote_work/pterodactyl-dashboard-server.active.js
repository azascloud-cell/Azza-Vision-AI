const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT        = Number(process.env.DASHBOARD_PORT || process.env.PORT || 2053);
const ROOT        = path.resolve(__dirname);
const PUBLIC_DIR  = path.join(ROOT, "dashboard");
const SIGNALS_FILE = path.resolve(process.env.DB_PATH || path.join(ROOT, "data", "signals.json"));
const JOURNAL_FILE = path.resolve(process.env.JOURNAL_PATH || path.join(ROOT, "data", "journal.json"));
const LOG_FILE    = process.env.DASHBOARD_LOG_FILE ? path.resolve(process.env.DASHBOARD_LOG_FILE) : null;
const QUOTES_FILE = path.resolve(process.env.QUOTES_PATH || path.join(ROOT, "data", "quotes.json"));
const QUOTE_CHANNEL_ID = "-1003911611745";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type":  "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}

function readQuotes() {
    try {
      const raw = JSON.parse(fs.readFileSync(QUOTES_FILE, "utf8"));
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
    }
    function writeQuotes(arr) {
    fs.mkdirSync(path.dirname(QUOTES_FILE), { recursive: true });
    fs.writeFileSync(QUOTES_FILE, JSON.stringify(arr, null, 2), "utf8");
    }
    function escapeTelegramHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function clip(value, max) {
      const text = String(value ?? "").trim();
      return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
    }
    function getGeminiCredential() {
      try {
        const keyManager = require("./analysis/ai_key_manager");
        const ready = keyManager.getReadyKeys("gemini");
        if (ready[0]?.key) return { key: ready[0].key, keyManager, managed: true };
      } catch {}
      const envKey = String(process.env.GEMINI_API_KEY || "").trim();
      return /^AQ\.[A-Za-z0-9_-]+$/.test(envKey) ? { key: envKey, managed: false } : null;
    }
    function quoteCaption(entry) {
      const hashtags = (Array.isArray(entry.tiktok_hashtags) ? entry.tiktok_hashtags : [])
        .map(tag => "#" + String(tag).replace(/^#/, "").replace(/[^A-Za-z0-9_]/g, ""))
        .filter(tag => tag.length > 1)
        .join(" ");
      return [
        "<b>AZZAVISION AI</b>",
        "",
        escapeTelegramHtml(clip(entry.quote, 560)),
        "",
        escapeTelegramHtml(clip(entry.tiktok_description, 220)),
        hashtags ? `\n${escapeTelegramHtml(clip(hashtags, 180))}` : "",
      ].join("\n").trim().slice(0, 1024);
    }
    async function publishQuoteToTelegram(entry, imageDataUrl) {
      const token = String(process.env.BOT_TOKEN || "").trim();
      if (!token) throw new Error("BOT_TOKEN belum tersedia di server.");
      const caption = quoteCaption(entry);
      const endpoint = `https://api.telegram.org/bot${token}`;
      let response;
      if (imageDataUrl) {
        const match = String(imageDataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
        if (!match) throw new Error("Format gambar quote tidak valid.");
        const bytes = Buffer.from(match[2], "base64");
        if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Ukuran gambar harus 1–8 MB.");
        const form = new FormData();
        form.append("chat_id", QUOTE_CHANNEL_ID);
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
        form.append("photo", new Blob([bytes], { type: match[1] }), "azzavision-quote.png");
        response = await fetch(`${endpoint}/sendPhoto`, { method: "POST", body: form });
      } else {
        response = await fetch(`${endpoint}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: QUOTE_CHANNEL_ID, text: caption, parse_mode: "HTML" }),
        });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}`);
      return { messageId: result.result?.message_id || null, channelId: QUOTE_CHANNEL_ID };
    }
    async function callAI(prompt) {
    const gemini = getGeminiCredential();
    const GK = gemini?.key;
    const OK = process.env.OPENROUTER_API_KEY;
    const QK = process.env.GROQ_API_KEY;
    function stripMd(t){return (t||"").replace(/```json[\r\n]?|[\r\n]?```/g,"").trim();}
    if (QK) {
      try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${QK}`},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:"You are a JSON-only API. Respond ONLY with valid JSON, no markdown, no explanation."},{role:"user",content:prompt}],response_format:{type:"json_object"},temperature:0.9})});
        if (r.ok){const d=await r.json();const t=stripMd(d?.choices?.[0]?.message?.content);if(t&&t.startsWith("{")){return JSON.parse(t);}}
      } catch(e){console.error("[AI Groq]",e.message);}
    }
    if (OK) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${OK}`,"HTTP-Referer":"https://azzavision.ai","X-Title":"AZZAVISION AI"},body:JSON.stringify({model:"nvidia/nemotron-3-super-120b-a12b:free",messages:[{role:"system",content:"You are a JSON-only API. Respond ONLY with valid JSON, no markdown, no explanation."},{role:"user",content:prompt}],response_format:{type:"json_object"},temperature:0.9})});
        if (r.ok){const d=await r.json();const t=stripMd(d?.choices?.[0]?.message?.content);if(t&&t.startsWith("{")){return JSON.parse(t);}}
      } catch(e){console.error("[AI OpenRouter]",e.message);}
    }
    if (GK) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GK}`,
          {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
        if (r.ok){const d=await r.json();if(gemini?.managed)gemini.keyManager.markKeyUsed("gemini",GK);const t=stripMd(d?.candidates?.[0]?.content?.parts?.[0]?.text);if(t&&t.startsWith("{")){return JSON.parse(t);}}
        else if (gemini?.managed && r.status === 429) gemini.keyManager.markKeyLimit("gemini", GK);
        else if (gemini?.managed && [401,403].includes(r.status)) gemini.keyManager.markKeyInvalid("gemini", GK);
      } catch(e){console.error("[AI Gemini]",e.message);}
    }
        const fbs=[
      {quote:"kamu tau ga?\nloss hari ini ga sesakit itu.\n\nyang lebih sakit itu nunggu\nnotif dari kamu yang ga pernah datang.\n\nchart masih bisa retrace.\ntapi hubungan yang udah dingin\nbelum tentu bisa balik lagi.",sender:"AZZAVISION AI",tiktok_title:"Loss Trading Ga Sesakit Nunggu Notif yang Ga Pernah Datang",tiktok_description:"Kalau chart bisa retrace, kenapa hati enggak? Follow AZZAVISION AI untuk kata-kata trading + sinyal harian. Join @azzavisionai!",tiktok_hashtags:["azzavisionai","tradingquotes","xauusd","forex","katakatanasabah","motivasitrading","galautrading","tradinglife","katakatacinta","investasi"]},
      {quote:"entry salah masih bisa di-close.\n\ntapi kata-kata yang udah kamu ucapkan\nwaktu itu...\n\ngimana cara close-nya?\n\nmasih floating di hati.\nnegative pips terus.",sender:"AZZAVISION AI",tiktok_title:"Entry Salah Bisa di-Close, Tapi Kenangan Gimana?",tiktok_description:"SL untuk trading mudah. SL untuk perasaan susah banget. AZZAVISION AI hadir untuk kamu. Join @azzavisionai",tiktok_hashtags:["azzavisionai","tradingquotes","katakatamalam","galau","forex","xauusd","motivasi","tradinglife","katakatahati","nasabah"]},
      {quote:"SL itu bukan kalah.\nSL itu batas.\n\nyang bikin rugi itu\nnunggu terlalu lama\npada sesuatu yang jelas\nudah lama hit SL dari dulu.",sender:"AZZAVISION AI",tiktok_title:"SL Bukan Kekalahan — Ini yang Trader Sering Lupa",tiktok_description:"Dalam trading, SL melindungimu. Dalam hidup pun sama. Join channel AZZAVISION AI @azzavisionai",tiktok_hashtags:["azzavisionai","tradingmindset","xauusd","forex","stoploss","motivasitrading","katakatainspirasi","tradinglife","belajartrading","investasicerdas"]}
    ];
    return fbs[Math.floor(Math.random()*fbs.length)];
    }
    function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 15e6) req.destroy(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function asNumber(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").replace(/[^\d.+\-eE]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function asString(v) { return v == null ? null : String(v); }
function nKey(v) { return String(v).toLowerCase().replace(/[^a-z0-9]/g, ""); }

function firstNested(record, keys) {
  const wanted = new Set(keys.map(nKey));
  const queue = [record];
  const visited = new Set();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object" || Array.isArray(cur) || visited.has(cur)) continue;
    visited.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (wanted.has(nKey(k)) && v != null) return v;
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

// ─── Signal parsing ───────────────────────────────────────────────────────────
function recordsFrom(value) {
  if (Array.isArray(value)) return value.filter(x => x && typeof x === "object" && !Array.isArray(x));
  if (!value || typeof value !== "object") return [];
  for (const key of ["signals", "trades", "records", "data", "history"]) {
    const v = value[key];
    if (Array.isArray(v)) return v.filter(x => x && typeof x === "object" && !Array.isArray(x));
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.values(v).filter(x => x && typeof x === "object" && !Array.isArray(x));
    }
  }
  return [];
}

function normalizeSide(v) {
  const s = asString(v)?.trim().toUpperCase();
  if (!s) return "—";
  if (s.includes("BUY") || s === "LONG") return "BUY";
  if (s.includes("SELL") || s === "SHORT") return "SELL";
  return s;
}
function normalizeStatus(v, closedAt, pnl, pips) {
  const s = asString(v)?.trim().toUpperCase();
  if (s && !["UNKNOWN","UNDEFINED","NULL","N/A","NA","-"].includes(s)) return s;
  if (!closedAt) return "OPEN";
  if ((pnl ?? pips ?? 0) > 0) return "WIN";
  if ((pnl ?? pips ?? 0) < 0) return "LOSS";
  return "BREAKEVEN";
}
function normalizeSymbol(v) {
  const s = asString(v)?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s || "XAUUSD";
}
function deriveExit(entry, exit, pips, side, closedAt) {
  if (exit != null || entry == null || pips == null || !closedAt || !["BUY","SELL"].includes(side)) return exit;
  return Number((entry + (side === "BUY" ? 1 : -1) * pips * 0.01).toFixed(2));
}

function normalizeSignals(raw) {
  return recordsFrom(raw).map((r, i) => {
    const createdAt = asString(firstNested(r, ["createdAt","created_at","timestamp","time","date","created","openTime","open_time","entryTime","entry_time","signalTime"]));
    const closedAt  = asString(firstNested(r, ["closedAt","closed_at","exitTime","exit_time","closed","closeTime","close_time","completedAt","completed_at"]));
    const side      = normalizeSide(firstNested(r, ["side","direction","signal","action","tradeType","trade_type"]));
    const pnl       = asNumber(firstNested(r, ["pnl","profit","profitLoss","profit_loss","result","netProfit"]));
    const pips      = asNumber(firstNested(r, ["pips","pip","points","profitPips","profit_pips","resultPips","result_pips"]));
    const entry     = asNumber(firstNested(r, ["entry","entryPrice","entry_price","openPrice","open_price","priceIn","price_in","entryLevel"]));
    const explicitExit = asNumber(firstNested(r, ["exit","exitPrice","exit_price","closePrice","close_price","priceOut","price_out","resultPrice"]));
    const id        = asString(firstNested(r, ["id","signalId","signal_id"])) ?? String(i + 1);
    return {
      id,
      symbol:     normalizeSymbol(firstNested(r, ["symbol","pair","asset","instrument","ticker"])),
      side,
      status:     normalizeStatus(firstNested(r, ["status","state","resultStatus","result_status"]), closedAt, pnl, pips),
      entry,
      exit:       deriveExit(entry, explicitExit, pips, side, closedAt),
      sl:         asNumber(firstNested(r, ["sl","stopLoss","stop_loss","stoploss"])),
      tp1:        asNumber(firstNested(r, ["tp1","takeProfit1","take_profit_1","target1","tp_1"])),
      tp2:        asNumber(firstNested(r, ["tp2","takeProfit2","take_profit_2","target2","tp_2"])),
      pnl, pnlPercent: asNumber(firstNested(r, ["pnlPercent","pnl_percent","profitPercent"])),
      pips,
      confidence: asNumber(firstNested(r, ["confidence","score","accuracy"])),
      h4Bias:     asString(firstNested(r, ["h4Bias","h4_bias","h4Trend","h4_trend"])),
      h1Bias:     asString(firstNested(r, ["h1Bias","h1_bias","h1Trend","h1_trend"])),
      m15Bias:    asString(firstNested(r, ["m15Bias","m15_bias","m15Trend","m15_trend"])),
      m5Signal:   asString(firstNested(r, ["m5Signal","m5_signal","m5_bias","m5Bias","m5Confirmation"])),
      newsFilter: asString(firstNested(r, ["newsFilter","news_filter","news","newsImpact"])),
      breakeven:  Boolean(firstNested(r, ["breakevenTriggered","breakeven_triggered","breakeven"])),
      tp1Hit:     Boolean(firstNested(r, ["tp1Hit","tp1_hit","tp1Reached"])),
      timeframe:  asString(firstNested(r, ["timeframe","interval","tf"])),
      createdAt,
      closedAt,
      _raw: r,
    };
  }).sort((a, b) => {
    const la = a.createdAt ? Date.parse(a.createdAt) : 0;
    const lb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return lb - la;
  });
}

// ─── Overview builder ─────────────────────────────────────────────────────────
function overview() {
  const raw     = readJson(SIGNALS_FILE) ?? [];
  const signals = normalizeSignals(raw);
  const closed  = signals.filter(s => {
    const v = (s.status || "").toLowerCase();
    return Boolean(s.closedAt) || ["closed","completed","complete","win","loss"].includes(v);
  });
  const winSig  = closed.filter(s => ["win","won","profit","take_profit","tp","tp1","tp2","tp1_hit","tp1_breakeven"].includes((s.status||"").toLowerCase()));
  const losSig  = closed.filter(s => ["loss","lost","sl","stop_loss","stopped","stoploss"].includes((s.status||"").toLowerCase()));
  const pips    = closed.map(s => s.pips).filter(v => v != null);
  const pnlVals = closed.map(s => s.pnl).filter(v => v != null);
  const totalPips = pips.reduce((a, b) => a + b, 0);
  const totalPnl  = pnlVals.reduce((a, b) => a + b, 0);
  return {
    fetchedAt: new Date().toISOString(),
    server:    getResources(),
    stats: {
      totalSignals:   signals.length,
      openSignals:    Math.max(0, signals.length - closed.length),
      closedSignals:  closed.length,
      winningSignals: winSig.length || closed.filter(s => (s.pnl ?? 0) > 0).length,
      losingSignals:  losSig.length || closed.filter(s => (s.pnl ?? 0) < 0).length,
      winRate:        closed.length ? (winSig.length / closed.length) * 100 : 0,
      totalPnl,  averagePnl:  pnlVals.length ? totalPnl / pnlVals.length : 0,
      totalPips, averagePips: pips.length    ? totalPips / pips.length    : 0,
      lastSignalAt: signals.find(s => s.createdAt)?.createdAt ?? null,
    },
    signals: signals.slice(0, 100),
  };
}

// ─── Resources ────────────────────────────────────────────────────────────────
function getResources() {
  try {
    const uptime = process.uptime() * 1000;
    const mem    = process.memoryUsage();
    return {
      currentState:    "running",
      isSuspended:     false,
      cpuPercent:      0,
      memoryBytes:     mem.rss,
      memoryLimitBytes: 0,
      diskBytes:       0,
      diskLimitBytes:  0,
      networkRxBytes:  0,
      networkTxBytes:  0,
      uptimeMs:        uptime,
    };
  } catch { return null; }
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
function getLogs() {
  if (!LOG_FILE) return { lines: [] };
  try {
    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines   = content.split("\n").filter(Boolean).slice(-200);
    return { lines };
  } catch { return { lines: [] }; }
}

// ─── Journal helpers ──────────────────────────────────────────────────────────
function readJournal() {
  try {
    const raw    = fs.readFileSync(JOURNAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : []);
  } catch { return []; }
}

function writeJournal(entries) {
  const dir = path.dirname(JOURNAL_FILE);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2), "utf8");
}

// ─── MIME ─────────────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

function sendFile(res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file     = path.resolve(PUBLIC_DIR, relative);
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== path.join(PUBLIC_DIR, "index.html")) {
    json(res, 403, { error: "Forbidden" }); return;
  }
  const target = fs.existsSync(file) ? file : path.join(PUBLIC_DIR, "index.html");
  const ext    = path.extname(target).toLowerCase();
  const mime   = MIME[ext] || "application/octet-stream";
  const cc     = ext === ".html" ? "no-cache" : "public,max-age=31536000";
  res.writeHead(200, {
    "Content-Type":  mime,
    "Cache-Control": cc,
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(target).pipe(res);
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
function startDashboard() {
  const server = http.createServer(async (req, res) => {
    const url    = new URL(req.url || "/", "http://127.0.0.1");
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    const pathname = url.pathname;

    try {
      // ── GET routes ─────────────────────────────────────────────────────────
      if (method === "GET") {
        if (pathname === "/api/trading/overview") { json(res, 200, overview()); return; }
        if (pathname === "/api/trading/resources") { json(res, 200, getResources()); return; }
        if (pathname === "/api/trading/logs")      { json(res, 200, getLogs()); return; }
        if (pathname === "/api/healthz")            { json(res, 200, { ok: true, version: "2.0.0" }); return; }

        if (pathname === "/api/trading/signals") {
          const raw     = readJson(SIGNALS_FILE) ?? [];
          const signals = normalizeSignals(raw);
          json(res, 200, { fetchedAt: new Date().toISOString(), signals: signals.slice(0, 200) });
          return;
        }

        // GET /api/trading/signal/:id
        const sigMatch = pathname.match(/^\/api\/trading\/signal\/(.+)$/);
        if (sigMatch) {
          const id      = decodeURIComponent(sigMatch[1]);
          const raw     = readJson(SIGNALS_FILE) ?? [];
          const signals = normalizeSignals(raw);
          const signal  = signals.find(s => String(s.id) === String(id));
          if (!signal) { json(res, 404, { error: "Signal not found" }); return; }
          json(res, 200, { signal });
          return;
        }

        // GET /api/journal
        if (pathname === "/api/journal") {
          json(res, 200, { entries: readJournal() });
          return;
        }

        // GET /api/journal/:signalId
        const jMatch = pathname.match(/^\/api\/journal\/(.+)$/);
        if (jMatch) {
          const sid   = decodeURIComponent(jMatch[1]);
          const entry = readJournal().find(e => String(e.signalId) === String(sid));
          json(res, entry ? 200 : 404, entry ? { entry } : { error: "Not found" });
          return;
        }

        if (pathname === "/api/ai/quotes") { json(res, 200, readQuotes().slice(-30).reverse()); return; }
        if (pathname === "/api/ai/channel") {
          json(res, 200, { channelId: QUOTE_CHANNEL_ID, handle: "@azzavisionai" });
          return;
        }
          if (pathname === "/api/ai/quote/today") {
            const today = new Date().toISOString().slice(0,10);
            const found = [...readQuotes()].reverse().find(q=>q.date===today);
            json(res, 200, found||null); return;
          }
          // Static files
          sendFile(res, pathname);
          return;
        }

      // ── PUT / POST / PATCH journal ──────────────────────────────────────────
      const jWriteMatch = pathname.match(/^\/api\/journal\/(.+)$/);
      if (jWriteMatch && (method === "PUT" || method === "POST" || method === "PATCH")) {
        const sid   = decodeURIComponent(jWriteMatch[1]);
        const body  = await readBody(req);
        const data  = JSON.parse(body);
        const entries = readJournal();
        const idx   = entries.findIndex(e => String(e.signalId) === String(sid));
        const entry = {
          ...(idx >= 0 ? entries[idx] : {}),
          ...data,
          signalId:  sid,
          updatedAt: new Date().toISOString(),
        };
        if (!entry.createdAt) entry.createdAt = new Date().toISOString();
        if (idx >= 0) entries[idx] = entry; else entries.push(entry);
        writeJournal(entries);
        json(res, 200, { ok: true, entry });
        return;
      }

      if (pathname === "/api/ai/quote/generate" && method === "POST") {
          const rb = await readBody(req);
          const rd = rb ? JSON.parse(rb) : {};
          const theme = rd.theme || "galau";
          const tm = {galau:"perasaan rindu, kehilangan, menunggu tak pasti",motivasi:"semangat, bangkit dari loss, pantang menyerah",trading:"disiplin, risk management, mindset trader",nostalgia:"kenangan indah, masa lalu, sepi malam"};
          const p = `Kamu AZZAVISION AI, asisten trading yang puitis.\nBuat pesan WhatsApp 4-7 baris menyentuh, gabungkan trading/xauusd/forex dengan tema: ${tm[theme]||tm.galau}.\nAturan: campur istilah trading (chart,loss,pips,entry,retrace,signal,SL,TP,floating) dgn perasaan. Puitis, natural, bahasa Indonesia santai. Max 1 emoji di akhir. UNIK setiap generate.\nOutput HANYA JSON tanpa teks lain: {"quote":"teks\\nbaris2","sender":"AZZAVISION AI","tiktok_title":"max 80 karakter","tiktok_description":"max 250 kar + ajak join @azzavisionai","tiktok_hashtags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]}`;
          const result = await callAI(p);
          const entry = {id:Date.now().toString(),date:new Date().toISOString().slice(0,10),theme,quote:result.quote||"",sender:result.sender||"AZZAVISION AI",tiktok_title:result.tiktok_title||"",tiktok_description:result.tiktok_description||"",tiktok_hashtags:result.tiktok_hashtags||[],createdAt:new Date().toISOString()};
          const all=readQuotes();all.push(entry);writeQuotes(all.slice(-100));
          json(res, 200, entry);return;
        }
      if (pathname === "/api/ai/quote/publish" && method === "POST") {
          const rb = await readBody(req);
          const rd = rb ? JSON.parse(rb) : {};
          const id = String(rd.id || "");
          const entries = readQuotes();
          const entry = entries.find(q => String(q.id) === id);
          if (!entry) { json(res, 404, { error: "Quote tidak ditemukan." }); return; }
          const published = await publishQuoteToTelegram(entry, rd.imageDataUrl);
          entry.publishedAt = new Date().toISOString();
          entry.telegramMessageId = published.messageId;
          entry.telegramChannelId = published.channelId;
          writeQuotes(entries);
          json(res, 200, { ok: true, ...published, entry });
          return;
        }
        json(res, 405, { error: "Method not allowed" });

    } catch (err) {
      console.error("[DASHBOARD] Error:", err.message);
      json(res, 500, { error: String(err.message) });
    }
  });

  server.on("error", err => console.error("[DASHBOARD] Server error:", err.message));
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[DASHBOARD] AZZAVISION AI v2.0 listening on port ${PORT}`);
    console.log(`[DASHBOARD] Signals : ${SIGNALS_FILE}`);
    console.log(`[DASHBOARD] Journal : ${JOURNAL_FILE}`);
    console.log(`[DASHBOARD] Public  : ${PUBLIC_DIR}`);
  });
  return server;
}

module.exports = { startDashboard };

// Auto-start when run directly (spawned by launcher.js)
if (require.main === module) {
  startDashboard();
}
