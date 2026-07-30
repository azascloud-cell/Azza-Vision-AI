import { useState } from "react";
import { useJournal } from "../hooks/useJournal";
import { ReconnectingState, SkeletonCard, Card, FilterSelect, LydiaAvatar } from "../components/Shared";

const PAIRS      = ["All", "XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"];
const DIRECTIONS = ["All", "BUY", "SELL"];
const RESULTS    = ["All", "WIN", "LOSS", "BREAKEVEN"];

export default function JournalPage() {
  const [pair, setPair]     = useState("All");
  const [dir, setDir]       = useState("All");
  const [result, setResult] = useState("All");

  const { data: entries, isLoading, isError } = useJournal(pair, dir, result);

  const wins  = entries?.filter(e => e.result === "WIN").length    ?? 0;
  const losses= entries?.filter(e => e.result === "LOSS").length   ?? 0;
  const total = entries?.length ?? 0;
  const totalPips = entries?.reduce((s, e) => s + e.pips, 0) ?? 0;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  const best = entries?.reduce((b, e) => e.pips > (b?.pips ?? -Infinity) ? e : b, entries?.[0]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">📒 Trading Journal</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Personal trade record & review</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      {/* summary */}
      {entries && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Win Rate",   v: `${winRate}%`,                  c: parseFloat(winRate) >= 50 ? "text-emerald-400" : "text-red-400" },
            { l: "Total Pips", v: `${totalPips >= 0 ? "+" : ""}${totalPips.toFixed(1)}`, c: totalPips >= 0 ? "text-emerald-400" : "text-red-400" },
            { l: "Best Trade", v: best ? `+${best.pips.toFixed(1)} (${best.pair})` : "—", c: "text-[#D4AF37]" },
            { l: "Trades",     v: `${wins}W / ${losses}L`,        c: "text-white" },
          ].map(s => (
            <div key={s.l} className="rounded-2xl bg-[#111] border border-[#D4AF37]/18 p-4">
              <div className="text-[9px] text-gray-600 tracking-widest mb-1">{s.l}</div>
              <div className={`text-[20px] font-black ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">PAIR</span>
            <FilterSelect value={pair} onChange={setPair} options={PAIRS} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">DIRECTION</span>
            <FilterSelect value={dir} onChange={setDir} options={DIRECTIONS} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">RESULT</span>
            <FilterSelect value={result} onChange={setResult} options={RESULTS} />
          </div>
        </div>
      </Card>

      {/* table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#D4AF37]/10">
                {["Date", "Pair", "Dir", "Entry", "Exit", "Pips", "Result", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] text-gray-500 font-semibold tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8}><SkeletonCard h={200} /></td></tr>
              ) : isError ? (
                <tr><td colSpan={8}><ReconnectingState /></td></tr>
              ) : entries?.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-600">No journal entries match filters.</td></tr>
              ) : entries?.map(e => {
                const rowClass = e.result === "WIN"
                  ? "bg-emerald-500/3 hover:bg-emerald-500/6"
                  : e.result === "LOSS"
                    ? "bg-red-500/3 hover:bg-red-500/6"
                    : "hover:bg-white/2";
                return (
                  <tr key={e.id} className={`border-b border-white/3 transition-colors ${rowClass}`}>
                    <td className="px-4 py-3 text-gray-400">{e.date}</td>
                    <td className="px-4 py-3 font-bold text-white">{e.pair}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${e.direction === "BUY" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                        {e.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-blue-400 font-mono">{e.entry.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono">{e.exit.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-black ${e.pips > 0 ? "text-emerald-400" : e.pips < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {e.pips > 0 ? "+" : ""}{e.pips.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        e.result === "WIN" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                        e.result === "LOSS" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                        "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                      }`}>{e.result}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-gray-500">{e.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
