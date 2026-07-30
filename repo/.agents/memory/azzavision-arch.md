---
name: AZZAVISION AI Architecture
description: Port routing, API proxy, and frontend/backend split for this project
---

## Key constraint
Frontend (Vite, port 22357) and API server (Express, port 8080) are separate artifacts.
The Replit path-router handles `/api → port 8080` for deployed/preview traffic, but the Vite dev server
does NOT see the Replit router — it serves on its own port directly. Therefore the Vite config MUST have:

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true }
  }
}
```

Without this proxy, all `fetch('/api/...')` calls from the browser (via dev server) get a 404.

**Why:** Vite dev server runs at 127.0.0.1:22357; browser JS making relative `/api` calls goes to that same port. Only the Replit outer router (which users see through the preview iframe) routes `/api` to 8080 — not Vite itself.

**How to apply:** Any time you add or change the frontend artifact config, ensure this proxy block is present in vite.config.ts under `server:`.

## Project layout
- `repo/artifacts/azzavision-promo` — React/Vite frontend, all 8 pages
- `repo/artifacts/api-server` — Express API, mock data routes
- `repo/artifacts/azzavision-promo/src/config/api.ts` — API_BASE (empty = relative URLs)
- All hooks in `src/hooks/` use TanStack Query with 30s polling

## Pages implemented
Dashboard, Signals, Journal, Studio, Backtest, Performance, Reports, Settings
All fetch from `/api/*` with loading skeletons and "Reconnecting..." error states.
