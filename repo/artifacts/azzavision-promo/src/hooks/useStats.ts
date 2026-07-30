import { useQuery } from "@tanstack/react-query";
import { API_BASE, POLL_INTERVAL, STALE_TIME } from "../config/api";
import type { Stats } from "../types";

export function useStats() {
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}
