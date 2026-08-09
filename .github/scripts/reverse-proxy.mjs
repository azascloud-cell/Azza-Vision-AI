#!/usr/bin/env node
/**
 * Simple reverse proxy that combines the API server (port 8080) and the
 * static frontend server (port 3000) onto a single port (8090 by default).
 *
 *   /api/*  → http://localhost:8080   (Express API server)
 *   /*      → http://localhost:3000   (serve -s dist)
 *
 * This lets a single Cloudflare Tunnel expose both the frontend and the
 * API through one public URL, so the browser's relative "/api/..." calls
 * work correctly from outside.
 *
 * Uses only Node.js built-in modules — no npm install needed.
 */

import http from "node:http";

const PROXY_PORT = Number(process.env.PROXY_PORT || 8090);
const API_PORT = Number(process.env.API_PORT || 8080);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);

function forward(req, res, targetPort) {
  const options = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[proxy] error for ${req.url} → :${targetPort}: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway");
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const targetPort = req.url.startsWith("/api") ? API_PORT : WEB_PORT;
  forward(req, res, targetPort);
});

server.on("upgrade", (req, socket, head) => {
  const targetPort = req.url.startsWith("/api") ? API_PORT : WEB_PORT;
  const options = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${targetPort}` },
  };

  const proxyReq = http.request(options);
  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const headerLines = [
      "HTTP/1.1 101 Switching Protocols",
      "upgrade: websocket",
      "connection: upgrade",
      ...Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ];
    socket.write(headerLines.join("\r\n"));
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket).on("error", () => {});
    socket.pipe(proxySocket).on("error", () => {});
  });
  proxyReq.on("error", () => { try { socket.destroy(); } catch {} });
  proxyReq.end();
});

server.listen(PROXY_PORT, () => {
  console.log(`[proxy] listening on :${PROXY_PORT}`);
  console.log(`[proxy]   /api/* → http://localhost:${API_PORT}`);
  console.log(`[proxy]   /*     → http://localhost:${WEB_PORT}`);
});
