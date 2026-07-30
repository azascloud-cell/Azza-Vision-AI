import { useQuery } from "@tanstack/react-query";
import { API_BASE, POLL_INTERVAL, STALE_TIME } from "../config/api";
import type { PerfPoint, BestPair } from "../types";

export function usePerformance(range: "7d" | "30d" | "3m" = "7d") {
  return useQuery<PerfPoint[]>({
    queryKey: ["performance", range],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/performance?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch performance");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}

export function useBestPairs() {
  return useQuery<BestPair[]>({
    queryKey: ["performance", "best"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/performance/best`);
      if (!res.ok) throw new Error("Failed to fetch best pairs");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}
