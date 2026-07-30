import { Router } from "express";

const router = Router();

const JOURNAL = [
  { id: 1,  date: "31 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4103.21, exit: 4099.21, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 2,  date: "31 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4104.74, exit: 4100.74, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 3,  date: "31 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4098.32, exit: 4100.74, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 4,  date: "30 Jul 2026", pair: "XAUUSD", direction: "SELL", entry: 4115.50, exit: 4109.00, pips: 6.5,  result: "WIN",       status: "TP1"       },
  { id: 5,  date: "30 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4088.40, exit: 4108.00, pips: 19.6, result: "WIN",       status: "TP2"       },
  { id: 6,  date: "30 Jul 2026", pair: "EURUSD", direction: "BUY",  entry: 1.08820, exit: 1.09020, pips: 20,   result: "WIN",       status: "TP1"       },
  { id: 7,  date: "30 Jul 2026", pair: "EURUSD", direction: "SELL", entry: 1.09150, exit: 1.08650, pips: 50,   result: "WIN",       status: "TP2"       },
  { id: 8,  date: "30 Jul 2026", pair: "GBPUSD", direction: "BUY",  entry: 1.28450, exit: 1.28150, pips: -30,  result: "LOSS",      status: "STOP LOSS" },
  { id: 9,  date: "30 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4072.50, exit: 4078.50, pips: 6,    result: "WIN",       status: "TP1"       },
  { id: 10, date: "29 Jul 2026", pair: "EURUSD", direction: "BUY",  entry: 1.08550, exit: 1.09050, pips: 50,   result: "WIN",       status: "TP2"       },
  { id: 11, date: "29 Jul 2026", pair: "XAUUSD", direction: "SELL", entry: 4125.00, exit: 4129.00, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 12, date: "29 Jul 2026", pair: "GBPJPY", direction: "BUY",  entry: 196.250, exit: 196.850, pips: 60,   result: "WIN",       status: "TP1"       },
  { id: 13, date: "29 Jul 2026", pair: "GBPUSD", direction: "SELL", entry: 1.29120, exit: 1.28320, pips: 80,   result: "WIN",       status: "TP2"       },
  { id: 14, date: "29 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4055.30, exit: 4075.00, pips: 19.7, result: "WIN",       status: "TP2"       },
  { id: 15, date: "28 Jul 2026", pair: "EURUSD", direction: "SELL", entry: 1.08920, exit: 1.09120, pips: -20,  result: "LOSS",      status: "STOP LOSS" },
  { id: 16, date: "28 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4040.75, exit: 4046.75, pips: 6,    result: "WIN",       status: "TP1"       },
  { id: 17, date: "28 Jul 2026", pair: "GBPJPY", direction: "SELL", entry: 197.800, exit: 196.200, pips: 160,  result: "WIN",       status: "TP2"       },
  { id: 18, date: "28 Jul 2026", pair: "XAUUSD", direction: "SELL", entry: 4068.20, exit: 4062.20, pips: 6,    result: "WIN",       status: "TP1"       },
  { id: 19, date: "27 Jul 2026", pair: "EURUSD", direction: "BUY",  entry: 1.08180, exit: 1.08680, pips: 50,   result: "WIN",       status: "TP2"       },
  { id: 20, date: "27 Jul 2026", pair: "GBPUSD", direction: "BUY",  entry: 1.27850, exit: 1.28650, pips: 80,   result: "WIN",       status: "TP2"       },
  { id: 21, date: "26 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4022.00, exit: 4018.00, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 22, date: "26 Jul 2026", pair: "EURUSD", direction: "SELL", entry: 1.09300, exit: 1.09300, pips: 0,    result: "BREAKEVEN", status: "BREAKEVEN" },
  { id: 23, date: "25 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4010.50, exit: 4006.50, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 24, date: "25 Jul 2026", pair: "GBPJPY", direction: "BUY",  entry: 195.000, exit: 196.000, pips: 100,  result: "WIN",       status: "TP2"       },
  { id: 25, date: "24 Jul 2026", pair: "XAUUSD", direction: "SELL", entry: 4035.00, exit: 4028.00, pips: 7,    result: "WIN",       status: "TP1"       },
  { id: 26, date: "24 Jul 2026", pair: "EURUSD", direction: "BUY",  entry: 1.07900, exit: 1.08200, pips: 30,   result: "WIN",       status: "TP1"       },
  { id: 27, date: "23 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4018.20, exit: 4035.00, pips: 16.8, result: "WIN",       status: "TP2"       },
  { id: 28, date: "23 Jul 2026", pair: "GBPUSD", direction: "SELL", entry: 1.29500, exit: 1.29500, pips: 0,    result: "BREAKEVEN", status: "BREAKEVEN" },
  { id: 29, date: "22 Jul 2026", pair: "XAUUSD", direction: "BUY",  entry: 4005.00, exit: 4001.00, pips: -4,   result: "LOSS",      status: "STOP LOSS" },
  { id: 30, date: "22 Jul 2026", pair: "EURUSD", direction: "BUY",  entry: 1.07600, exit: 1.08100, pips: 50,   result: "WIN",       status: "TP2"       },
];

router.get("/journal", (req, res) => {
  let result = [...JOURNAL];
  const { pair, direction, result: r } = req.query as Record<string, string>;
  if (pair && pair.toLowerCase() !== "all") result = result.filter(j => j.pair === pair);
  if (direction) result = result.filter(j => j.direction === direction.toUpperCase());
  if (r) result = result.filter(j => j.result === r.toUpperCase());
  res.json(result);
});

export default router;
