import { useQuery } from "@tanstack/react-query";
import { API_BASE, STALE_TIME } from "../config/api";
import type { BacktestData } from "../types";

export function useBacktest(pair?: string, strategy?: string) {
  return useQuery<BacktestData>({
    queryKey: ["backtest", pair, strategy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pair && pair !== "All") params.set("pair", pair);
      if (strategy) params.set("strategy", strategy);
      const url = `${API_BASE}/api/backtest${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch backtest");
      return res.json();
    },
    staleTime: STALE_TIME,
  });
}
