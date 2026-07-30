import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "../config/api";
import type { ServerResources } from "../types";

export function useServer() {
  return useQuery<ServerResources>({
    queryKey: ["server", "resources"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/server/resources`);
      if (!res.ok) throw new Error("Failed to fetch server resources");
      return res.json();
    },
    refetchInterval: 10_000, // every 10s for server metrics
    staleTime: 5_000,
  });
}
