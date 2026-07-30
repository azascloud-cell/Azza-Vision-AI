import { Router } from "express";

const router = Router();

router.get("/stats", (_req, res) => {
  res.json({
    totalSignals: 192,
    winRate: 42.4,
    wins: 81,
    losses: 81,
    breakeven: 30,
    totalPips: 4380,
    avgPips: 23,
    lastSignal: "31 Jul 2026, 01.10",
    closed: 191,
    open: 1,
  });
});

export default router;
