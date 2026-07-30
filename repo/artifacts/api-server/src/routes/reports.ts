import { Router } from "express";

const router = Router();

router.get("/reports/daily", (_req, res) => {
  res.json({
    date: "31 Jul 2026",
    totalSignals: 3,
    wins: 0,
    losses: 3,
    breakeven: 0,
    winRate: 0,
    totalPips: -12,
    bestPair: "XAUUSD",
    bestPips: -4,
    details: [
      { time: "01.10", pair: "XAUUSD", direction: "BUY", pips: -4,   result: "LOSS" },
      { time: "00.59", pair: "XAUUSD", direction: "BUY", pips: -4,   result: "OPEN" },
      { time: "00.45", pair: "XAUUSD", direction: "BUY", pips: -4,   result: "LOSS" },
    ],
  });
});

router.get("/reports/weekly", (_req, res) => {
  res.json({
    week: "28 Jul – 31 Jul 2026",
    totalSignals: 20,
    wins: 14,
    losses: 5,
    breakeven: 1,
    winRate: 70.0,
    totalPips: 380,
    bestPair: "XAUUSD",
    bestPips: 220,
    days: [
      { date: "28 Jul", signals: 4, wins: 3, losses: 1, pips: 168 },
      { date: "29 Jul", signals: 5, wins: 4, losses: 1, pips: 178 },
      { date: "30 Jul", signals: 6, wins: 4, losses: 2, pips: 46  },
      { date: "31 Jul", signals: 5, wins: 3, losses: 2, pips: -12 },
    ],
  });
});

export default router;
