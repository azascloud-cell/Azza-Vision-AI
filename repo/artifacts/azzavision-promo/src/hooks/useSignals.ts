import { useQuery } from "@tanstack/react-query";
import { API_BASE, POLL_INTERVAL, STALE_TIME } from "../config/api";
import type { Signal } from "../types";

async function fetchSignals(pair?: string, direction?: string, status?: string, limit?: number): Promise<Signal[]> {
  const params = new URLSearchParams();
  if (pair && pair !== "All Pairs") params.set("pair", pair);
  if (direction && direction !== "All") params.set("direction", direction);
  if (status && status !== "All") params.set("status", status);
  if (limit) params.set("limit", String(limit));
  const url = `${API_BASE}/api/signals${params.toString() ? "?" + params : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch signals");
  return res.json();
}

export function useSignals(pair?: string, direction?: string, status?: string, limit?: number) {
  return useQuery<Signal[]>({
    queryKey: ["signals", pair, direction, status, limit],
    queryFn: () => fetchSignals(pair, direction, status, limit),
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}

export function useLatestSignal() {
  return useQuery<Signal>({
    queryKey: ["signals", "latest"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/signals/latest`);
      if (!res.ok) throw new Error("Failed to fetch latest signal");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}
