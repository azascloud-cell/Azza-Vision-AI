import { useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell } from "recharts";
import { useSignals } from "../hooks/useSignals";
import { useStats } from "../hooks/useStats";
import { usePerformance, useBestPairs } from "../hooks/usePerformance";
import { useServer } from "../hooks/useServer";
import { useChecklist } from "../hooks/useChecklist";
import {
  SignalCard, StatCard, CandleBg, AzzaChar, LydiaAvatar,
  ReconnectingState, SkeletonCard, MiniPerfChart, Card, FilterSelect,
} from "../components/Shared";
import { useState } from "react";

// ─── icons ────────────────────────────────────────────────────────────────────
function IcoGrid() {
  return <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><rect x="1" y="1" width="5" height="5" rx="1" /><rect x="8" y="1" width="5" height="5" rx="1" /><rect x="1" y="8" width="5" height="5" rx="1" /><rect x="8" y="8" width="5" height="5" rx="1" /></svg>;
}
function IcoTgt() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5"><circle cx="7" cy="7" r="5.5" /><circle cx="7" cy="7" r="3" /><circle cx="7" cy="7" r="0.8" fill="currentColor" stroke="none" /></svg>;
}
function IcoTrnd() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M1 11l4-4.5L8 8.5l3-5 2.5 1.5" /><path d="M10 4l3 1.5V2" /></svg>;
}
function IcoClk() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 2" /></svg>;
}
function IcoFlt() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M1 3h12M3 7h8M5 11h4" /></svg>;
}

const DIST_COLORS = { Win: "#22c55e", Loss: "#ef4444", Breakeven: "#eab308" };
const PAIRS = ["All Pairs", "XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"];

export default function DashboardPage() {
  const [pair, setPair] = useState("All Pairs");
  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useStats();
  const { data: signals, isLoading: sigsLoading, isError: sigsError } = useSignals(pair);
  const { data: perf, isLoading: perfLoading } = usePerformance("7d");
  const { data: best } = useBestPairs();
  const { data: server } = useServer();
  const { data: checklist } = useChecklist();

  const distData = stats
    ? [
        { name: "Win",       value: stats.wins,      color: DIST_COLORS.Win       },
        { name: "Loss",      value: stats.losses,    color: DIST_COLORS.Loss      },
        { name: "Breakeven", value: stats.breakeven, color: DIST_COLORS.Breakeven },
      ]
    : [];

  const cpuNum = server ? parseFloat(server.cpu) : 0;
  const memNum = server ? parseInt(server.memory) : 0;

  return (
    <div className="space-y-4">

      {/* ── HERO ── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0D0D0D] border border-[#D4AF37]/18" style={{ minHeight: 210, boxShadow: "0 0 18px rgba(212,175,55,0.04)" }}>
        <div className="absolute inset-0 pointer-events-none"><CandleBg /></div>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 75% 50%, rgba(212,175,55,0.1) 0%, transparent 65%)" }} />

        <div className="relative z-10 flex items-center gap-4 p-5">
          <div className="flex-1 min-w-0 max-w-[280px]">
            <div className="inline-block px-3.5 py-3 rounded-xl mb-4"
              style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.22)" }}>
              <p className="text-[13px] text-white font-semibold italic leading-snug">
                "Trade with Discipline,<br />Not Emotion."
              </p>
              <p className="text-[10px] text-[#D4AF37] mt-1.5" style={{ fontFamily: "Georgia, serif" }}>— Azza</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-gray-500">System running · All signals live</span>
            </div>
          </div>

          <div className="flex items-end justify-center gap-3 flex-shrink-0">
            <div className="float-b relative">
              <div className="absolute -inset-3 rounded-2xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)" }} />
              <AzzaChar w={118} h={168} />
            </div>
            <div className="float-a relative">
              <div className="absolute -inset-3 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)" }} />
              <img src={`${import.meta.env.BASE_URL}lydia-char.png`} alt="Lydia"
                draggable={false}
                style={{ width: 148, height: 200, objectFit: "contain", objectPosition: "bottom" }} />
              <div className="absolute bottom-4 right-0 px-2 py-1 rounded-lg text-center"
                style={{ background: "rgba(11,11,11,0.88)", border: "1px solid rgba(212,175,55,0.25)" }}>
                <div className="text-[8px] text-[#D4AF37] font-bold">LYDIA ✦</div>
                <div className="text-[7px] text-gray-500">AI Assistant</div>
                <div className="flex items-center gap-1 justify-center mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[7px] text-emerald-400">Always here!</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block flex-shrink-0">
            <div className="px-4 py-3 rounded-xl text-right"
              style={{ background: "rgba(17,17,17,0.8)", border: "1px solid rgba(212,175,55,0.2)" }}>
              <div className="text-[9px] text-gray-500 mb-1">Welcome Back,</div>
              <div className="text-[17px] font-black text-white leading-tight">Azza 👑</div>
              <div className="text-[9px] text-[#D4AF37] mt-0.5">Focus · Plan · Execute</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {statsLoading || statsError ? (
          [0,1,2,3].map(i => <SkeletonCard key={i} h={100} />)
        ) : stats ? (
          <>
            <StatCard icon={<IcoGrid />} label="Total Signals" value={String(stats.totalSignals)} sub={`${stats.open} open`} />
            <StatCard icon={<IcoTgt  />} label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.wins}W / ${stats.losses}L`}
              color={stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
            <StatCard icon={<IcoTrnd />} label="Total Pips" value={`+${stats.totalPips.toLocaleString()}`} sub={`avg +${stats.avgPips}/trade`} color="text-emerald-400" />
            <StatCard icon={<IcoClk  />} label="Last Signal" value={stats.lastSignal.split(",")[1]?.trim() ?? stats.lastSignal} sub={`${stats.lastSignal.split(",")[0]} · ${stats.closed} closed`} />
          </>
        ) : null}
      </div>

      {/* ── SIGNAL STREAM + SIDE PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-4">

        {/* signals */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/10">
            <div className="flex items-center gap-2.5">
              <span className="text-[#D4AF37] text-sm">⚡</span>
              <span className="text-[12px] font-black tracking-[0.18em]">SIGNAL STREAM</span>
            </div>
            <div className="flex items-center gap-2">
              <FilterSelect value={pair} onChange={setPair} options={PAIRS} />
              <button className="p-1.5 rounded-lg border border-white/6 text-gray-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/25 transition-all"
                onClick={() => qc.invalidateQueries({ queryKey: ["signals"] })}>
                <IcoFlt />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {sigsLoading ? [0,1,2].map(i => <SkeletonCard key={i} h={120} />) :
             sigsError   ? <ReconnectingState /> :
             signals?.slice(0, 6).map(s => <SignalCard key={s.id} s={s} />)}
          </div>
        </Card>

        {/* side panel */}
        <div className="flex flex-col gap-3">

          {/* server resources */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[9px] text-gray-500 font-semibold tracking-widest">SERVER RESOURCES</span>
              <span className="flex items-center gap-1.5 text-[9px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {server?.status?.toUpperCase() ?? "RUNNING"}
              </span>
            </div>
            {[
              { l: "CPU",    v: server?.cpu ?? "—",    bar: cpuNum  },
              { l: "MEMORY", v: server?.memory ?? "—", bar: Math.min(memNum / 200 * 100, 100) },
              { l: "DISK",   v: server?.disk ?? "—",   bar: null    },
              { l: "UPTIME", v: server?.uptime ?? "—", bar: null    },
            ].map(r => (
              <div key={r.l} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                <span className="text-[11px] text-gray-500 w-16">{r.l}</span>
                {r.bar !== null
                  ? <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-[3px] bg-[#1A1A1A] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#D4AF37]"
                          style={{ width: `${Math.max(r.bar, 1.5)}%`, transition: "width 1s ease" }} />
                      </div>
                      <span className="text-[11px] text-white font-semibold w-14 text-right">{r.v}</span>
                    </div>
                  : <span className="text-[11px] text-white font-semibold">{r.v}</span>
                }
              </div>
            ))}
          </Card>

          {/* signal checklist */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[9px] text-gray-500 font-semibold tracking-widest">SIGNAL CHECKLIST</span>
              <LydiaAvatar size={30} />
            </div>
            {checklist ? [
              { l: "H4 Trend",   badge: checklist.h4trend, ok: checklist.h4trend.includes("BUY") },
              { l: "H1 Trend",   badge: checklist.h1trend, ok: checklist.h1trend.includes("BUY") },
              { l: "Confidence", badge: `${checklist.confidence}%`, ok: checklist.confidence >= 75 },
            ].map(c => (
              <div key={c.l} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${c.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {c.ok ? "✓" : "✕"}
                  </span>
                  <span className="text-[11px] text-gray-300">{c.l}</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/12 text-[#D4AF37] border border-[#D4AF37]/20">
                  {c.badge}
                </span>
              </div>
            )) : <SkeletonCard h={80} />}
          </Card>

          {/* lydia assist */}
          <div className="rounded-2xl p-4 flex items-center gap-3 flex-1"
            style={{ background: "linear-gradient(135deg,#130F00,#0D0D0D)", border: "1px solid rgba(212,175,55,0.18)" }}>
            <img src={`${import.meta.env.BASE_URL}lydia-char.png`} alt="Lydia"
              draggable={false}
              style={{ width: 50, height: 58, objectFit: "contain", objectPosition: "bottom", flexShrink: 0, borderRadius: 10 }} />
            <div>
              <div className="text-[9px] text-[#D4AF37] font-bold mb-1">LYDIA says:</div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {checklist?.lydiaComment ?? "Loading market analysis..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE SECTION ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* area chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] text-gray-500 font-semibold tracking-widest">PERFORMANCE CHART</span>
            <span className="text-[11px] text-emerald-400 font-black">
              {stats ? `+${stats.totalPips.toLocaleString()} pips` : "—"}
            </span>
          </div>
          {perfLoading ? <SkeletonCard h={120} /> : perf ? <MiniPerfChart data={perf} /> : null}
        </Card>

        {/* pie chart */}
        <Card className="p-5">
          <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">TRADE DISTRIBUTION</div>
          {stats ? (
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <PieChart width={120} height={120}>
                  <Pie data={distData} cx={55} cy={55} innerRadius={34} outerRadius={52}
                    dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                    {distData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[15px] font-black text-white leading-none">{stats.totalSignals}</span>
                  <span className="text-[8px] text-gray-500 mt-0.5">TOTAL</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {distData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <div>
                      <div className="text-[9px] text-gray-500">{d.name}</div>
                      <div className="text-[10px] text-white font-semibold">
                        {d.value} ({((d.value / stats.totalSignals) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <SkeletonCard h={120} />}
        </Card>

        {/* best performing */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#D4AF37]">🏆</span>
            <span className="text-[9px] text-gray-500 font-semibold tracking-widest">BEST PERFORMING</span>
          </div>
          <div className="space-y-3.5">
            {best ? best.slice(0, 4).map((b, i) => (
              <div key={b.pair} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                    i === 0 ? "bg-[#D4AF37] text-black" : i === 1 ? "bg-gray-600 text-white" : i === 2 ? "bg-[#7C3B10]/60 text-orange-300" : "bg-gray-800 text-gray-400"
                  }`}>{i + 1}</span>
                  <span className="text-[13px] font-bold text-white">{b.pair}</span>
                </div>
                <span className="text-[13px] font-black text-emerald-400">+{b.pips.toLocaleString()} pips</span>
              </div>
            )) : [0,1,2].map(i => <SkeletonCard key={i} h={24} />)}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
            <LydiaAvatar size={28} />
            <span className="text-[9px] text-gray-600 italic">Analysed by Lydia AI</span>
          </div>
        </Card>
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="rounded-2xl overflow-hidden border border-[#D4AF37]/18"
        style={{ background: "linear-gradient(135deg,#0E0D00,#0D0D0D,#0B0B0B)" }}>
        <div className="flex flex-col md:flex-row items-center justify-between px-6 py-5 gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 blur-md bg-[#D4AF37]/20 rounded-full" />
              <svg viewBox="0 0 40 36" width={38} height={38}>
                <polygon points="20,2 38,34 2,34" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
                <circle cx="20" cy="20" r="5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
                <circle cx="20" cy="20" r="2.2" fill="#D4AF37" />
              </svg>
            </div>
            <div>
              <div className="text-[12px] font-black text-[#D4AF37] tracking-widest">AZZAVISION AI</div>
              <div className="text-[8px] text-gray-600 tracking-widest">PROFESSIONAL TRADING MONITOR</div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-black text-white tracking-wide">Discipline Over Emotion.</p>
            <p className="text-[12px] text-gray-400 font-medium mt-0.5">
              Consistent Today.&nbsp;
              <span className="text-[#D4AF37] font-semibold">Freedom Tomorrow.</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-[22px] text-[#D4AF37] leading-none" style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>
                Azza
              </div>
              <div className="text-[8px] text-gray-600">Founder & Trader</div>
            </div>
            <div className="float-a">
              <img src={`${import.meta.env.BASE_URL}lydia-char.png`} alt="Lydia"
                draggable={false}
                style={{ width: 55, height: 68, objectFit: "contain", objectPosition: "bottom", borderRadius: 10 }} />
            </div>
          </div>
        </div>
      </div>

      <div className="h-3" />
    </div>
  );
}
