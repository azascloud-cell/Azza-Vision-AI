#!/usr/bin/env node
/**
 * Keep-alive loop for the private panel running inside a GitHub Actions runner.
 *
 * Runs for 5 hours 50 minutes (21000 seconds), printing a heartbeat every
 * 60 seconds so the job is not marked idle. Combined with the cron schedule
 * (every 6 hours), this gives ~24h/day of continuous uptime.
 *
 * The tunnel URL (if found) is printed in every heartbeat so you can
 * always find it by checking the workflow logs.
 *
 * Optional: if the KEEPALIVE_PING_URL secret is set, each heartbeat also
 * sends a GET request to that URL (e.g. UptimeRobot) so you can monitor
 * the panel from outside.
 */

import fs from "node:fs";

const KEEPALIVE_SECONDS = 5 * 3600 + 50 * 60; // 5h 50m
const HEARTBEAT_INTERVAL = 60; // seconds
const PING_URL = process.env.KEEPALIVE_PING_URL || "";

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
}

function getTunnelUrl() {
  try {
    const url = fs.readFileSync("/tmp/tunnel-url.txt", "utf8").trim();
    return url || null;
  } catch {
    return null;
  }
}

async function ping() {
  if (!PING_URL) return;
  try {
    const res = await fetch(PING_URL, { method: "GET", signal: AbortSignal.timeout(10000) });
    log(`Ping ${PING_URL} → ${res.status}`);
  } catch (err) {
    log(`Ping failed: ${err.message}`);
  }
}

async function checkLocal() {
  try {
    const res = await fetch("http://localhost:8090/api/healthz", {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    log(`Proxy health → ${JSON.stringify(body)}`);
  } catch {
    log("Proxy health check failed (server may be starting)");
  }
}

async function checkCloudflared() {
  try {
    if (!fs.existsSync("/tmp/cloudflared.pid")) {
      log("Cloudflare Tunnel: not running");
      return;
    }
    log("Cloudflare Tunnel: active");
  } catch {
    // ignore
  }
}

async function main() {
  log("=== Private Panel Keep-Alive ===");
  log(`Duration: ${KEEPALIVE_SECONDS}s (${(KEEPALIVE_SECONDS / 3600).toFixed(2)}h)`);
  log(`Heartbeat every ${HEARTBEAT_INTERVAL}s`);
  if (PING_URL) log(`External ping URL: ${PING_URL}`);
  log("");

  const tunnelUrl = getTunnelUrl();
  if (tunnelUrl && tunnelUrl.startsWith("http")) {
    log("========================================================");
    log(`  PANEL URL:  ${tunnelUrl}`);
    log("========================================================");
  } else if (tunnelUrl === "named-tunnel") {
    log("Named tunnel active — check Cloudflare Zero Trust dashboard for URL");
    log("  https://one.dash.cloudflare.com/ → Networks → Tunnels → Public Hostnames");
  } else {
    log("No tunnel URL found");
  }
  log("");

  const start = Date.now();
  let elapsed = 0;

  while (elapsed < KEEPALIVE_SECONDS) {
    elapsed = Math.floor((Date.now() - start) / 1000);
    const remaining = KEEPALIVE_SECONDS - elapsed;
    const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
    const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");

    const urlInfo = tunnelUrl && tunnelUrl.startsWith("http")
      ? ` | URL: ${tunnelUrl}`
      : "";
    log(`Heartbeat ${elapsed}s elapsed | ${hh}:${mm}:${ss} remaining${urlInfo}`);

    await checkLocal();
    await checkCloudflared();
    await ping();

    await new Promise((r) => setTimeout(r, HEARTBEAT_INTERVAL * 1000));
  }

  log("Keep-alive period finished. The next scheduled run will continue.");
}

main().catch((err) => {
  console.error("Keep-alive failed:", err.message);
  process.exit(1);
});
