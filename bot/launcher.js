const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ override: false });

const ROOT  = __dirname;
const PORT  = Number(process.env.PORT || process.env.DASHBOARD_PORT || 2389);
const CF_LOG = path.join(ROOT, 'cloudflared.log');
const TUN_FILE = path.join(ROOT, 'tunnel-url.txt');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(CF_LOG, line + '\n'); } catch {}
}

function findCloudflared() {
  const candidates = ['/usr/local/bin/cloudflared', '/usr/bin/cloudflared', path.join(ROOT, 'cloudflared')];
  for (const p of candidates) {
    try { execSync('test -f ' + p + ' && test -x ' + p, { timeout: 2000 }); return p; } catch {}
  }
  return null;
}

function downloadCloudflared(dest) {
  return new Promise((resolve, reject) => {
    log('Downloading cloudflared binary...');
    const file = fs.createWriteStream(dest);
    const url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
    function get(u) {
      https.get(u, { headers: { 'User-Agent': 'curl/7.68.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        res.pipe(file);
        file.on('finish', () => { execSync('chmod +x ' + dest); resolve(dest); });
        file.on('error', reject);
      }).on('error', reject);
    }
    get(url);
  });
}

async function startTunnel() {
  let cfBin = findCloudflared();
  if (!cfBin) {
    const dest = path.join(ROOT, 'cloudflared');
    try { cfBin = await downloadCloudflared(dest); }
    catch(e) { log('Failed to get cloudflared: ' + e.message); return; }
  }
  log('Tunnel: using ' + cfBin + ' on port ' + PORT);
  const cf = spawn(cfBin, ['tunnel', '--url', 'http://localhost:' + PORT], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  log('cloudflared pid=' + cf.pid);
  function onData(chunk) {
    const str = chunk.toString();
    try { fs.appendFileSync(CF_LOG, str); } catch {}
    const m = str.match(/https?:\/\/[\w\-\.]+trycloudflare\.com/i);
    if (m) {
      const url = m[0].trim();
      log('🌐 Tunnel URL: ' + url);
      try { fs.writeFileSync(TUN_FILE, url, 'utf8'); } catch {}
    }
  }
  cf.stdout.on('data', onData);
  cf.stderr.on('data', onData);
  cf.on('exit', code => { log('cloudflared exit=' + code + ', retry 5s'); setTimeout(startTunnel, 5000); });
  cf.on('error', e => { log('spawn error: ' + e.message); setTimeout(startTunnel, 10000); });
}

// ── Start Dashboard Server ────────────────────────────────────────────────────
function startDashboard() {
  const dsFile = path.join(ROOT, 'pterodactyl-dashboard-server.js');
  if (!fs.existsSync(dsFile)) { log('No dashboard server found, skipping.'); return; }
  log('Starting dashboard server...');
  const ds = spawn(process.execPath, [dsFile], {
    stdio: 'inherit', env: { ...process.env, PORT: String(PORT) }
  });
  ds.on('exit', code => { log('Dashboard exit=' + code + ', restart 3s'); setTimeout(startDashboard, 3000); });
  ds.on('error', e => log('Dashboard error: ' + e.message));
}

// ── Start Telegram Bot ────────────────────────────────────────────────────────
function startBot() {
  log('Starting AZZAVISION AI bot...');
  const bot = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/index.js'], {
    stdio: 'inherit', env: process.env, cwd: ROOT
  });
  bot.on('exit', code => {
    log('Bot exit=' + code);
    if (code !== 0) { log('Bot crashed, restart in 5s'); setTimeout(startBot, 5000); }
    else process.exit(0);
  });
  bot.on('error', e => { log('Bot error: ' + e.message); setTimeout(startBot, 5000); });
}

// ── Main ──────────────────────────────────────────────────────────────────────
log('Launcher started, PORT=' + PORT);
log('Direct access: http://<IP>:' + PORT + '  or  http://<domain>:' + PORT);
startDashboard();
startTunnel(); // mulai cloudflared agar dashboard punya URL trycloudflare (tunnel-url.txt)
setTimeout(startBot, 2000);
