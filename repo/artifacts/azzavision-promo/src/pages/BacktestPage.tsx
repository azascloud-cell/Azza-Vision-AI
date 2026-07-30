import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useBacktest } from "../hooks/useBacktest";
import { GoldTooltip, ReconnectingState, SkeletonCard, Card, FilterSelect, LydiaAvatar } from "../components/Shared";

const PAIRS      = ["All", "XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"];
const STRATEGIES = ["v2.1", "v2.0", "v1.9"];

export default function BacktestPage() {
  const [pair, setPair]         = useState("All");
  const [strategy, setStrategy] = useState("v2.1");

  const { data, isLoading, isError } = useBacktest(pair, strategy);

  const s = data?.summary;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">🔄 Backtest</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Historical strategy results</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      {/* filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">PAIR</span>
            <FilterSelect value={pair} onChange={setPair} options={PAIRS} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">STRATEGY</span>
            <FilterSelect value={strategy} onChange={setStrategy} options={STRATEGIES} />
          </div>
        </div>
      </Card>

      {/* summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} h={80} />)}
        </div>
      ) : s && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { l: "Total Trades",   v: s.total,          c: "text-white"       },
            { l: "Win Rate",       v: `${s.winRate}%`,  c: parseFloat(s.winRate) >= 50 ? "text-emerald-400" : "text-red-400" },
            { l: "Total Pips",     v: `+${s.totalPips}`, c: "text-emerald-400" },
            { l: "Max Drawdown",   v: `${s.maxDrawdown}`, c: "text-red-400"   },
            { l: "Profit Factor",  v: s.profitFactor,   c: "text-[#D4AF37]"   },
            { l: "Wins / Losses",  v: `${s.wins}W / ${s.losses}L`, c: "text-white" },
          ].map(st => (
            <div key={st.l} className="rounded-2xl bg-[#111] border border-[#D4AF37]/18 p-4">
              <div className="text-[8px] text-gray-600 tracking-widest mb-1">{st.l}</div>
              <div className={`text-[18px] font-black ${st.c}`}>{st.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* equity curve */}
      {data?.equityCurve && data.equityCurve.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] text-gray-500 font-semibold tracking-widest">EQUITY CURVE</span>
            <span className="text-[11px] text-emerald-400 font-black">{s ? `+${s.totalPips} pips` : ""}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="bt-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
              <XAxis dataKey="trade" tick={{ fontSize: 8, fill: "#444" }} tickLine={false} axisLine={false} label={{ value: "Trade #", position: "insideBottom", fill: "#555", fontSize: 9 }} />
              <YAxis tick={{ fontSize: 8, fill: "#444" }} tickLine={false} axisLine={false} />
              <Tooltip content={<GoldTooltip />} />
              <Area type="monotone" dataKey="pips" stroke="#D4AF37" strokeWidth={2}
                fill="url(#bt-area)" dot={false}
                activeDot={{ r: 4, fill: "#F5C542", stroke: "#D4AF37", strokeWidth: 1 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* results table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/10">
          <span className="text-[12px] font-black tracking-[0.18em]">TRADE RESULTS</span>
          <span className="text-[10px] text-gray-500">{data?.results.length ?? 0} trades</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#D4AF37]/10">
                {["#", "Date", "Pair", "Setup", "Pips", "Result", "Strategy"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] text-gray-500 font-semibold tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><SkeletonCard h={300} /></td></tr>
              ) : isError ? (
                <tr><td colSpan={7}><ReconnectingState /></td></tr>
              ) : data?.results.map(r => (
                <tr key={r.id} className={`border-b border-white/3 hover:bg-white/2 transition-colors ${
                  r.result === "WIN" ? "bg-emerald-500/2" : r.result === "LOSS" ? "bg-red-500/2" : ""
                }`}>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-[11px]">#{r.id}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-[11px]">{r.date}</td>
                  <td className="px-4 py-2.5 font-bold text-white">{r.pair}</td>
                  <td className="px-4 py-2.5 text-[#D4AF37] text-[10px]">{r.setup}</td>
                  <td className={`px-4 py-2.5 font-black ${r.pips > 0 ? "text-emerald-400" : r.pips < 0 ? "text-red-400" : "text-gray-400"}`}>
                    {r.pips > 0 ? "+" : ""}{r.pips}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      r.result === "WIN" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                      r.result === "LOSS" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                      "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                    }`}>{r.result}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-gray-600">{r.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
