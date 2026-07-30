import { useQuery } from "@tanstack/react-query";
import { API_BASE, STALE_TIME } from "../config/api";
import type { DailyReport, WeeklyReport } from "../types";

export function useDailyReport() {
  return useQuery<DailyReport>({
    queryKey: ["reports", "daily"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/reports/daily`);
      if (!res.ok) throw new Error("Failed to fetch daily report");
      return res.json();
    },
    staleTime: STALE_TIME,
  });
}

export function useWeeklyReport() {
  return useQuery<WeeklyReport>({
    queryKey: ["reports", "weekly"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/reports/weekly`);
      if (!res.ok) throw new Error("Failed to fetch weekly report");
      return res.json();
    },
    staleTime: STALE_TIME,
  });
}
