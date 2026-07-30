import { Router } from "express";

const router = Router();

let uptimeSeconds = 360; // start at 6 min
setInterval(() => { uptimeSeconds += 5; }, 5000);

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

router.get("/server/resources", (_req, res) => {
  const cpu = (Math.random() * 4).toFixed(1);
  const memMb = Math.round(52 + Math.random() * 12);
  res.json({
    cpu: `${cpu}%`,
    memory: `${memMb} MB`,
    disk: "2.1 GB",
    uptime: fmtUptime(uptimeSeconds),
    status: "running",
  });
});

export default router;
