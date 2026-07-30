import { Router } from "express";

const router = Router();

const SIGNALS = [
  { id: 1,  pair: "XAUUSD", direction: "BUY",  status: "OPEN",      entry: 4103.21, sl: 4099.21, tp1: 4109.21, tp2: 4123.00, h4trend: "STRONG_BUY", confidence: 81, time: "31 Jul 2026, 00.59", starred: false },
  { id: 2,  pair: "XAUUSD", direction: "BUY",  status: "STOP LOSS", entry: 4104.74, sl: 4100.74, tp1: 4110.74, tp2: 4125.74, h4trend: "STRONG_BUY", confidence: 76, time: "31 Jul 2026, 01.10", starred: true  },
  { id: 3,  pair: "XAUUSD", direction: "BUY",  status: "STOP LOSS", entry: 4098.32, sl: 4094.32, tp1: 4104.32, tp2: 4118.32, h4trend: "BUY",        confidence: 72, time: "31 Jul 2026, 00.45", starred: true  },
  { id: 4,  pair: "XAUUSD", direction: "SELL", status: "TP1",       entry: 4115.50, sl: 4120.00, tp1: 4109.00, tp2: 4100.00, h4trend: "SELL",       confidence: 68, time: "30 Jul 2026, 22.30", starred: false },
  { id: 5,  pair: "XAUUSD", direction: "BUY",  status: "TP2",       entry: 4088.40, sl: 4084.40, tp1: 4094.40, tp2: 4108.00, h4trend: "STRONG_BUY", confidence: 84, time: "30 Jul 2026, 19.15", starred: true  },
  { id: 6,  pair: "EURUSD", direction: "BUY",  status: "TP1",       entry: 1.08820, sl: 1.08620, tp1: 1.09020, tp2: 1.09320, h4trend: "BUY",        confidence: 70, time: "30 Jul 2026, 17.00", starred: false },
  { id: 7,  pair: "EURUSD", direction: "SELL", status: "TP2",       entry: 1.09150, sl: 1.09350, tp1: 1.08950, tp2: 1.08650, h4trend: "SELL",       confidence: 74, time: "30 Jul 2026, 14.30", starred: false },
  { id: 8,  pair: "GBPUSD", direction: "BUY",  status: "STOP LOSS", entry: 1.28450, sl: 1.28150, tp1: 1.28750, tp2: 1.29250, h4trend: "BUY",        confidence: 65, time: "30 Jul 2026, 12.00", starred: false },
  { id: 9,  pair: "XAUUSD", direction: "BUY",  status: "TP1",       entry: 4072.50, sl: 4068.50, tp1: 4078.50, tp2: 4092.00, h4trend: "STRONG_BUY", confidence: 79, time: "30 Jul 2026, 09.45", starred: true  },
  { id: 10, pair: "EURUSD", direction: "BUY",  status: "TP2",       entry: 1.08550, sl: 1.08350, tp1: 1.08750, tp2: 1.09050, h4trend: "STRONG_BUY", confidence: 82, time: "29 Jul 2026, 22.00", starred: false },
  { id: 11, pair: "XAUUSD", direction: "SELL", status: "STOP LOSS", entry: 4125.00, sl: 4129.00, tp1: 4119.00, tp2: 4108.00, h4trend: "SELL",       confidence: 63, time: "29 Jul 2026, 18.30", starred: false },
  { id: 12, pair: "GBPJPY", direction: "BUY",  status: "TP1",       entry: 196.250, sl: 195.750, tp1: 196.850, tp2: 197.750, h4trend: "BUY",        confidence: 71, time: "29 Jul 2026, 15.00", starred: false },
  { id: 13, pair: "GBPUSD", direction: "SELL", status: "TP2",       entry: 1.29120, sl: 1.29420, tp1: 1.28820, tp2: 1.28320, h4trend: "SELL",       confidence: 77, time: "29 Jul 2026, 12.45", starred: true  },
  { id: 14, pair: "XAUUSD", direction: "BUY",  status: "TP2",       entry: 4055.30, sl: 4051.30, tp1: 4061.30, tp2: 4075.00, h4trend: "STRONG_BUY", confidence: 88, time: "29 Jul 2026, 09.00", starred: true  },
  { id: 15, pair: "EURUSD", direction: "SELL", status: "STOP LOSS", entry: 1.08920, sl: 1.09120, tp1: 1.08720, tp2: 1.08420, h4trend: "NEUTRAL",    confidence: 58, time: "28 Jul 2026, 21.00", starred: false },
  { id: 16, pair: "XAUUSD", direction: "BUY",  status: "TP1",       entry: 4040.75, sl: 4036.75, tp1: 4046.75, tp2: 4060.00, h4trend: "BUY",        confidence: 73, time: "28 Jul 2026, 16.30", starred: false },
  { id: 17, pair: "GBPJPY", direction: "SELL", status: "TP2",       entry: 197.800, sl: 198.300, tp1: 197.200, tp2: 196.200, h4trend: "STRONG_SELL", confidence: 80, time: "28 Jul 2026, 13.00", starred: true  },
  { id: 18, pair: "XAUUSD", direction: "SELL", status: "TP1",       entry: 4068.20, sl: 4072.20, tp1: 4062.20, tp2: 4052.00, h4trend: "SELL",       confidence: 69, time: "28 Jul 2026, 09.15", starred: false },
  { id: 19, pair: "EURUSD", direction: "BUY",  status: "TP2",       entry: 1.08180, sl: 1.07980, tp1: 1.08380, tp2: 1.08680, h4trend: "STRONG_BUY", confidence: 85, time: "27 Jul 2026, 22.00", starred: true  },
  { id: 20, pair: "GBPUSD", direction: "BUY",  status: "TP2",       entry: 1.27850, sl: 1.27550, tp1: 1.28150, tp2: 1.28650, h4trend: "BUY",        confidence: 76, time: "27 Jul 2026, 18.00", starred: false },
];

router.get("/signals", (req, res) => {
  let result = [...SIGNALS];
  const { pair, direction, status, limit } = req.query as Record<string, string>;
  if (pair && pair.toLowerCase() !== "all") result = result.filter(s => s.pair === pair);
  if (direction) result = result.filter(s => s.direction === direction.toUpperCase());
  if (status) result = result.filter(s => s.status === status.toUpperCase());
  if (limit) result = result.slice(0, parseInt(limit, 10));
  res.json(result);
});

router.get("/signals/latest", (_req, res) => {
  res.json(SIGNALS[0]);
});

export default router;
export { SIGNALS };
