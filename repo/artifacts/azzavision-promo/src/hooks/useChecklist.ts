import { useQuery } from "@tanstack/react-query";
import { API_BASE, POLL_INTERVAL, STALE_TIME } from "../config/api";
import type { Checklist } from "../types";

export function useChecklist() {
  return useQuery<Checklist>({
    queryKey: ["checklist"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/checklist/latest`);
      if (!res.ok) throw new Error("Failed to fetch checklist");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: STALE_TIME,
  });
}
