import { useState } from "react";
import { useDailyReport, useWeeklyReport } from "../hooks/useReports";
import { ReconnectingState, SkeletonCard, Card, LydiaAvatar } from "../components/Shared";

type Period = "daily" | "weekly";

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");

  const { data: daily, isLoading: dailyLoading, isError: dailyError } = useDailyReport();
  const { data: weekly, isLoading: weeklyLoading, isError: weeklyError } = useWeeklyReport();

  const isLoading = period === "daily" ? dailyLoading : weeklyLoading;
  const isError   = period === "daily" ? dailyError   : weeklyError;

  function copyReport() {
    const el = document.getElementById("report-main");
    if (el) navigator.clipboard?.writeText(el.innerText);
    alert("Report copied to clipboard!");
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">📋 Reports</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Automated trading summaries</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      {/* period toggle */}
      <div className="flex gap-2">
        {(["daily", "weekly"] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-5 py-2 rounded-xl text-[11px] font-bold capitalize transition-all ${
              period === p
                ? "bg-[#D4AF37] text-black"
                : "bg-[#111] text-gray-400 border border-[#D4AF37]/15 hover:border-[#D4AF37]/35"
            }`}>
            {p === "daily" ? "Daily Report" : "Weekly Report"}
          </button>
        ))}
        <button onClick={copyReport}
          className="ml-auto px-4 py-2 rounded-xl text-[11px] font-semibold border border-[#D4AF37]/25 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/12 transition-all">
          ↗ Share
        </button>
      </div>

      {isLoading ? <SkeletonCard h={300} /> :
       isError   ? <ReconnectingState /> :

       period === "daily" && daily ? (
        <div id="report-main" className="space-y-4">
          {/* report card */}
          <div className="rounded-2xl overflow-hidden p-6"
            style={{
              background: "linear-gradient(135deg,#0A0800,#0D0D0D)",
              border: "2px solid rgba(212,175,55,0.25)",
              boxShadow: "0 0 30px rgba(212,175,55,0.06)",
            }}>
            {/* lydia header */}
            <div className="flex items-center gap-3 mb-5">
              <LydiaAvatar size={44} />
              <div>
                <div className="text-[10px] text-[#D4AF37] font-bold tracking-widest">AZZAVISION AI · DAILY REPORT</div>
                <div className="text-[16px] font-black text-white">{daily.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { l: "Total Signals",  v: daily.totalSignals, c: "text-white"       },
                { l: "Win Rate",       v: `${daily.winRate}%`, c: daily.winRate >= 50 ? "text-emerald-400" : "text-red-400" },
                { l: "Total Pips",     v: `${daily.totalPips >= 0 ? "+" : ""}${daily.totalPips}`, c: daily.totalPips >= 0 ? "text-emerald-400" : "text-red-400" },
                { l: "Best Pair",      v: daily.bestPair,     c: "text-[#D4AF37]"   },
              ].map(s => (
                <div key={s.l} className="rounded-xl bg-[#111] p-3 border border-[#D4AF37]/10">
                  <div className="text-[8px] text-gray-600 tracking-widest mb-1">{s.l}</div>
                  <div className={`text-[20px] font-black ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* detail table */}
            <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-2">SIGNAL BREAKDOWN</div>
            <div className="rounded-xl overflow-hidden border border-[#D4AF37]/10">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#D4AF37]/10 bg-[#111]">
                    {["Time", "Pair", "Direction", "Pips", "Result"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[9px] text-gray-500 font-semibold tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daily.details.map((d, i) => (
                    <tr key={i} className="border-b border-white/3 last:border-0">
                      <td className="px-4 py-2.5 text-gray-500">{d.time}</td>
                      <td className="px-4 py-2.5 font-bold text-white">{d.pair}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold ${d.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{d.direction}</span>
                      </td>
                      <td className={`px-4 py-2.5 font-black ${d.pips > 0 ? "text-emerald-400" : d.pips < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {d.pips > 0 ? "+" : ""}{d.pips}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          d.result === "WIN"  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                          d.result === "LOSS" || d.result === "STOP LOSS" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                          d.result === "OPEN" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                          "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                        }`}>{d.result}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* lydia footer */}
            <div className="mt-5 flex items-center gap-2">
              <LydiaAvatar size={24} />
              <p className="text-[10px] text-gray-500 italic">
                Report generated by Lydia AI · AZZAVISION AI System
              </p>
            </div>
          </div>
        </div>
       ) :

       period === "weekly" && weekly ? (
        <div id="report-main" className="space-y-4">
          <div className="rounded-2xl overflow-hidden p-6"
            style={{
              background: "linear-gradient(135deg,#0A0800,#0D0D0D)",
              border: "2px solid rgba(212,175,55,0.25)",
              boxShadow: "0 0 30px rgba(212,175,55,0.06)",
            }}>
            <div className="flex items-center gap-3 mb-5">
              <LydiaAvatar size={44} />
              <div>
                <div className="text-[10px] text-[#D4AF37] font-bold tracking-widest">AZZAVISION AI · WEEKLY REPORT</div>
                <div className="text-[16px] font-black text-white">{weekly.week}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { l: "Total Signals", v: weekly.totalSignals, c: "text-white" },
                { l: "Win Rate",      v: `${weekly.winRate}%`, c: weekly.winRate >= 50 ? "text-emerald-400" : "text-red-400" },
                { l: "Total Pips",    v: `${weekly.totalPips >= 0 ? "+" : ""}${weekly.totalPips}`, c: weekly.totalPips >= 0 ? "text-emerald-400" : "text-red-400" },
                { l: "Best Pair",     v: weekly.bestPair, c: "text-[#D4AF37]" },
              ].map(s => (
                <div key={s.l} className="rounded-xl bg-[#111] p-3 border border-[#D4AF37]/10">
                  <div className="text-[8px] text-gray-600 tracking-widest mb-1">{s.l}</div>
                  <div className={`text-[20px] font-black ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-2">DAILY BREAKDOWN</div>
            <div className="space-y-2">
              {weekly.days.map(d => {
                const wr = d.signals > 0 ? ((d.wins / d.signals) * 100).toFixed(0) : "0";
                return (
                  <div key={d.date} className="flex items-center gap-4 py-2.5 px-4 rounded-xl bg-[#111] border border-[#D4AF37]/8">
                    <span className="text-[11px] font-semibold text-gray-400 w-16">{d.date}</span>
                    <span className="text-[10px] text-gray-600">{d.signals} signals</span>
                    <span className="text-[10px] text-emerald-400">{d.wins}W</span>
                    <span className="text-[10px] text-red-400">{d.losses}L</span>
                    <span className="text-[10px] text-gray-500">{wr}% WR</span>
                    <span className={`ml-auto text-[13px] font-black ${d.pips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {d.pips >= 0 ? "+" : ""}{d.pips}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <LydiaAvatar size={24} />
              <p className="text-[10px] text-gray-500 italic">Report generated by Lydia AI · AZZAVISION AI System</p>
            </div>
          </div>
        </div>
       ) : null}
    </div>
  );
}
