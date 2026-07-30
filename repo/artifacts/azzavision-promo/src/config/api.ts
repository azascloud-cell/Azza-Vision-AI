// Base URL for the AZZAVISION AI backend.
// Empty string = relative calls → handled by Replit's path router (/api → API server port).
// Override with VITE_API_URL for a custom Pterodactyl deployment.
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export const POLL_INTERVAL = 30_000; // 30 s auto-refresh
export const STALE_TIME = 10_000;
