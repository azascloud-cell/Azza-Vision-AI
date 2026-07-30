import { Router } from "express";

const router = Router();

const PERF_30D = [
  { date: "02 Jul", pips: -120 }, { date: "03 Jul", pips: 80   }, { date: "04 Jul", pips: 220  },
  { date: "05 Jul", pips: 150  }, { date: "06 Jul", pips: 390  }, { date: "07 Jul", pips: 310  },
  { date: "08 Jul", pips: -80  }, { date: "09 Jul", pips: 180  }, { date: "10 Jul", pips: 420  },
  { date: "11 Jul", pips: 350  }, { date: "12 Jul", pips: 600  }, { date: "13 Jul", pips: 520  },
  { date: "14 Jul", pips: 440  }, { date: "15 Jul", pips: 380  }, { date: "16 Jul", pips: 650  },
  { date: "17 Jul", pips: -150 }, { date: "18 Jul", pips: 280  }, { date: "19 Jul", pips: 720  },
  { date: "20 Jul", pips: 680  }, { date: "21 Jul", pips: 920  }, { date: "22 Jul", pips: 840  },
  { date: "23 Jul", pips: 1050 }, { date: "24 Jul", pips: 980  }, { date: "25 Jul", pips: -200 },
  { date: "26 Jul", pips: 180  }, { date: "27 Jul", pips: 820  }, { date: "28 Jul", pips: 1450 },
  { date: "29 Jul", pips: 2100 }, { date: "30 Jul", pips: 3200 }, { date: "31 Jul", pips: 4380 },
];

const PERF_3M = Array.from({ length: 13 }, (_, i) => {
  const d = new Date(2026, 3 + Math.floor(i / 4.3), 1 + (i * 7));
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    pips: Math.round(200 + i * 350 + (Math.random() > 0.7 ? -300 : 0)),
  };
});

router.get("/performance", (req, res) => {
  const range = (req.query.range as string) || "7d";
  if (range === "7d")  return void res.json(PERF_30D.slice(-7));
  if (range === "30d") return void res.json(PERF_30D);
  res.json(PERF_3M);
});

router.get("/performance/best", (_req, res) => {
  res.json([
    { pair: "XAUUSD", pips: 2850, winRate: 48.2 },
    { pair: "EURUSD", pips: 720,  winRate: 52.1 },
    { pair: "GBPUSD", pips: 510,  winRate: 44.0 },
    { pair: "GBPJPY", pips: 300,  winRate: 41.7 },
  ]);
});

export default router;
