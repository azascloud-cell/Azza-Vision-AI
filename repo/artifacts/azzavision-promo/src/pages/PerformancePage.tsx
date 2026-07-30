import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { usePerformance, useBestPairs } from "../hooks/usePerformance";
import { useStats } from "../hooks/useStats";
import { GoldTooltip, ReconnectingState, SkeletonCard, Card, LydiaAvatar } from "../components/Shared";

type Range = "7d" | "30d" | "3m";

const DIST_COLORS = ["#22c55e", "#ef4444", "#eab308"];

export default function PerformancePage() {
  const [range, setRange] = useState<Range>("7d");

  const { data: perf, isLoading: perfLoading, isError: perfError } = usePerformance(range);
  const { data: best } = useBestPairs();
  const { data: stats } = useStats();

  const pairData = best?.map(b => ({ pair: b.pair, pips: b.pips })) ?? [];

  const distData = stats ? [
    { name: "Win",       value: stats.wins,      color: DIST_COLORS[0] },
    { name: "Loss",      value: stats.losses,    color: DIST_COLORS[1] },
    { name: "Breakeven", value: stats.breakeven, color: DIST_COLORS[2] },
  ] : [];

  const totalPips = perf?.reduce((s, p) => s + p.pips, 0) ?? 0;
  const maxPip = perf ? Math.max(...perf.map(p => p.pips)) : 0;
  const minPip = perf ? Math.min(...perf.map(p => p.pips)) : 0;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">📊 Performance</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Deep analytics on your trading results</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      {/* range toggle */}
      <div className="flex gap-2">
        {(["7d", "30d", "3m"] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
              range === r
                ? "bg-[#D4AF37] text-black"
                : "bg-[#111] text-gray-400 border border-[#D4AF37]/15 hover:border-[#D4AF37]/35"
            }`}>
            {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "3 Months"}
          </button>
        ))}
      </div>

      {/* quick stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Period Pips",   v: `${totalPips >= 0 ? "+" : ""}${totalPips.toLocaleString()}`, c: totalPips >= 0 ? "text-emerald-400" : "text-red-400" },
            { l: "Best Day",      v: `+${maxPip.toLocaleString()}`,  c: "text-emerald-400" },
            { l: "Worst Day",     v: String(minPip),                 c: "text-red-400"     },
            { l: "Win Rate",      v: `${stats.winRate}%`,            c: "text-white"       },
          ].map(s => (
            <div key={s.l} className="rounded-2xl bg-[#111] border border-[#D4AF37]/18 p-4">
              <div className="text-[9px] text-gray-600 tracking-widest mb-1">{s.l}</div>
              <div className={`text-[20px] font-black ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* main chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[9px] text-gray-500 font-semibold tracking-widest">CUMULATIVE PIPS — {range.toUpperCase()}</span>
          {perfError && <span className="text-[10px] text-red-400">Connection error</span>}
        </div>
        {perfLoading ? <SkeletonCard h={200} /> :
         perfError   ? <ReconnectingState /> :
         perf && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={perf} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="perf-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
              <Tooltip content={<GoldTooltip />} />
              <Area type="monotone" dataKey="pips" stroke="#D4AF37" strokeWidth={2.5}
                fill="url(#perf-area)" dot={false}
                activeDot={{ r: 5, fill: "#F5C542", stroke: "#D4AF37", strokeWidth: 1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* pair breakdown + distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* pair bar chart */}
        <Card className="p-5">
          <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">PIPS BY PAIR</div>
          {pairData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pairData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis dataKey="pair" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                <Tooltip content={<GoldTooltip />} />
                <Bar dataKey="pips" fill="#D4AF37" opacity={0.9} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <SkeletonCard h={160} />}
        </Card>

        {/* win/loss distribution */}
        <Card className="p-5">
          <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">WIN / LOSS DISTRIBUTION</div>
          {stats ? (
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <PieChart width={140} height={140}>
                  <Pie data={distData} cx={65} cy={65} innerRadius={40} outerRadius={60}
                    dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                    {distData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[18px] font-black text-white leading-none">{stats.totalSignals}</span>
                  <span className="text-[8px] text-gray-500 mt-0.5">TOTAL</span>
                </div>
              </div>
              <div className="space-y-3">
                {distData.map(d => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <div>
                      <div className="text-[9px] text-gray-500">{d.name}</div>
                      <div className="text-[13px] text-white font-black">
                        {d.value}
                        <span className="text-[10px] text-gray-500 font-normal ml-1">
                          ({((d.value / stats.totalSignals) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <SkeletonCard h={140} />}
        </Card>
      </div>

      {/* best pairs table */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#D4AF37]">🏆</span>
          <span className="text-[9px] text-gray-500 font-semibold tracking-widest">BEST PERFORMING PAIRS</span>
        </div>
        <div className="space-y-3">
          {best ? best.map((b, i) => (
            <div key={b.pair} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                  i === 0 ? "bg-[#D4AF37] text-black" : i === 1 ? "bg-gray-600 text-white" : i === 2 ? "bg-[#7C3B10]/60 text-orange-300" : "bg-gray-800 text-gray-400"
                }`}>{i + 1}</span>
                <div>
                  <div className="text-[14px] font-bold text-white">{b.pair}</div>
                  <div className="text-[9px] text-gray-500">Win Rate: {b.winRate}%</div>
                </div>
              </div>
              <span className="text-[16px] font-black text-emerald-400">+{b.pips.toLocaleString()} pips</span>
            </div>
          )) : [0,1,2,3].map(i => <SkeletonCard key={i} h={40} />)}
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
          <LydiaAvatar size={26} />
          <span className="text-[9px] text-gray-600 italic">Analysed by Lydia AI · Updated every 30s</span>
        </div>
      </Card>
    </div>
  );
}
