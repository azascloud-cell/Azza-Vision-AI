import { useQuery } from "@tanstack/react-query";
import { API_BASE, POLL_INTERVAL, STALE_TIME } from "../config/api";
import type { JournalEntry } from "../types";

export function useJournal(pair?: string, direction?: string, result?: string) {
  return useQuery<JournalEntry[]>({
    queryKey: ["journal", pair, direction, result],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pair && pair !== "All") params.set("pair", pair);
      if (direction && direction !== "All") params.set("direction", direction);
      if (result && result !== "All") params.set("result", result);
      const url = `${API_BASE}/api/journal${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch journal");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}
