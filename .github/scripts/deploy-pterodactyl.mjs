#!/usr/bin/env node
/**
 * Deploy to Pterodactyl Panel via Application API.
 *
 * Required environment variables:
 *   PTERO_PANEL_URL  - e.g. https://panel.example.com
 *   PTERO_API_KEY    - Application API key (starts with ptlc_)
 *   PTERO_SERVER_ID  - The server identifier (short UUID)
 *
 * Flow:
 *   1. Upload deploy.tar.gz to the server via the file upload endpoint
 *      exposed by the Pterodactyl Application API.
 *   2. Decompress the archive on the server.
 *   3. Install dependencies and (re)start the server.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PANEL_URL = (process.env.PTERO_PANEL_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.PTERO_API_KEY || "";
const SERVER_ID = process.env.PTERO_SERVER_ID || "";

const ARCHIVE_PATH = resolve(process.cwd(), "deploy.tar.gz");

const missing = [];
if (!PANEL_URL) missing.push("PTERO_PANEL_URL");
if (!API_KEY) missing.push("PTERO_API_KEY");
if (!SERVER_ID) missing.push("PTERO_SERVER_ID");
if (missing.length) {
  console.error(`Missing required secrets: ${missing.join(", ")}`);
  console.error(
    "Add them under Settings > Secrets and variables > Actions in your repository."
  );
  process.exit(1);
}

if (!existsSync(ARCHIVE_PATH)) {
  console.error(`Deployment archive not found at ${ARCHIVE_PATH}`);
  console.error("Make sure the build step produced deploy.tar.gz.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function apiRequest(path, options = {}) {
  const url = `${PANEL_URL}/api/application${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      body && body.errors
        ? JSON.stringify(body.errors)
        : typeof body === "string"
          ? body
          : JSON.stringify(body);
    throw new Error(`API ${res.status} ${res.statusText} for ${path}: ${msg}`);
  }
  return body;
}

async function uploadArchive() {
  const archive = readFileSync(ARCHIVE_PATH);
  const uploadPath = `/api/application/servers/${SERVER_ID}/files/upload`;
  const url = `${PANEL_URL}${uploadPath}`;

  console.log(`Uploading ${archive.length} bytes to ${uploadPath}...`);

  const formData = new FormData();
  const blob = new Blob([archive], { type: "application/gzip" });
  formData.append("files", blob, "deploy.tar.gz");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed ${res.status} ${res.statusText}: ${text}`);
  }

  console.log("Upload completed.");
}

async function sendCommand(command) {
  console.log(`Sending command: ${command}`);
  await apiRequest(`/servers/${SERVER_ID}/command`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

async function powerAction(action) {
  console.log(`Power action: ${action}`);
  await apiRequest(`/servers/${SERVER_ID}/power`, {
    method: "POST",
    body: JSON.stringify({ signal: action }),
  });
}

async function waitFor(seconds) {
  console.log(`Waiting ${seconds}s...`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
}

async function main() {
  console.log(`Deploying to Pterodactyl panel: ${PANEL_URL}`);
  console.log(`Server ID: ${SERVER_ID}`);

  // 1. Upload the archive to the server's file root.
  await uploadArchive();

  // 2. Stop the server before overwriting files.
  await waitFor(2);
  try {
    await powerAction("stop");
  } catch (err) {
    console.warn(`Stop signal may have failed (server may already be stopped): ${err.message}`);
  }
  await waitFor(5);

  // 3. Decompress the archive, clean old build, then reinstall deps.
  const commands = [
    `rm -rf /container/old_deploy && mkdir -p /container/old_deploy`,
    `mv /container/deploy.tar.gz /container/deploy.tar.gz 2>/dev/null || true`,
    `tar -xzf /container/deploy.tar.gz -C /container/`,
    `cd /container && pnpm install --prod --no-frozen-lockfile`,
  ];

  for (const cmd of commands) {
    try {
      await sendCommand(cmd);
      await waitFor(3);
    } catch (err) {
      console.warn(`Command failed (may be non-fatal): ${err.message}`);
    }
  }

  // 4. Start the server.
  await waitFor(2);
  try {
    await powerAction("start");
  } catch (err) {
    console.warn(`Start signal failed: ${err.message}`);
  }

  console.log("Deployment complete.");
}

main().catch((err) => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
