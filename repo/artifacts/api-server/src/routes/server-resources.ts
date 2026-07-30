import { Router } from "express";

const router = Router();

const PANEL_URL = "https://serverku.lynzzofficial.com";
const SERVER_ID = "11b9ea11-cc5e-4af6-b901-0086cca1c590";

interface PteroResources {
  object: string;
  attributes: {
    current_state: string;
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      uptime: number;
    };
  };
}

function fmtUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBytes(bytes: number, unit: "MB" | "GB" = "MB") {
  if (unit === "GB") return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_048_576)} MB`;
}

router.get("/server/resources", async (_req, res) => {
  const apiKey = process.env.PTERODACTYL_API;

  if (!apiKey) {
    return res.status(500).json({ error: "PTERODACTYL_API secret not set" });
  }

  try {
    const response = await fetch(
      `${PANEL_URL}/api/client/servers/${SERVER_ID}/resources`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      throw new Error(`Pterodactyl returned ${response.status}`);
    }

    const data = (await response.json()) as PteroResources;
    const r = data.attributes.resources;

    return res.json({
      cpu: `${r.cpu_absolute.toFixed(1)}%`,
      memory: fmtBytes(r.memory_bytes, "MB"),
      disk: fmtBytes(r.disk_bytes, "GB"),
      uptime: fmtUptime(r.uptime),
      status: data.attributes.current_state,
    });
  } catch (err) {
    console.error("[server-resources] Pterodactyl fetch error:", err);
    // Graceful fallback so the UI stays functional
    return res.json({
      cpu: "N/A",
      memory: "N/A",
      disk: "N/A",
      uptime: "N/A",
      status: "unreachable",
    });
  }
});

export default router;
