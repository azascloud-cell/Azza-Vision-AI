export interface Signal {
  id: number;
  pair: string;
  direction: "BUY" | "SELL";
  status: "OPEN" | "STOP LOSS" | "TP1" | "TP2";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  h4trend: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  confidence: number;
  time: string;
  starred?: boolean;
}

export interface Stats {
  totalSignals: number;
  winRate: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalPips: number;
  avgPips: number;
  lastSignal: string;
  closed: number;
  open: number;
}

export interface PerfPoint {
  date: string;
  pips: number;
}

export interface BestPair {
  pair: string;
  pips: number;
  winRate: number;
}

export interface ServerResources {
  cpu: string;
  memory: string;
  disk: string;
  uptime: string;
  status: "running" | "stopped";
}

export interface JournalEntry {
  id: number;
  date: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry: number;
  exit: number;
  pips: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  status: string;
}

export interface BacktestResult {
  id: number;
  pair: string;
  setup: string;
  entry: number;
  sl: number;
  tp: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  pips: number;
  date: string;
  strategy: string;
}

export interface BacktestData {
  results: BacktestResult[];
  equityCurve: { trade: number; pips: number }[];
  summary: {
    total: number;
    wins: number;
    losses: number;
    winRate: string;
    totalPips: number;
    maxDrawdown: number;
    profitFactor: string;
  };
}

export interface Checklist {
  h4trend: string;
  h1trend: string;
  confidence: number;
  status: string;
  lydiaComment: string;
}

export interface DailyReport {
  date: string;
  totalSignals: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPips: number;
  bestPair: string;
  bestPips: number;
  details: { time: string; pair: string; direction: string; pips: number; result: string }[];
}

export interface WeeklyReport {
  week: string;
  totalSignals: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPips: number;
  bestPair: string;
  bestPips: number;
  days: { date: string; signals: number; wins: number; losses: number; pips: number }[];
}
