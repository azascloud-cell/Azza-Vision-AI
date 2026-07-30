import { useState } from "react";
import { useSignals } from "../hooks/useSignals";
import {
  SignalCard, ReconnectingState, SkeletonCard, Card, FilterSelect, LydiaAvatar,
} from "../components/Shared";

const PAIRS       = ["All Pairs", "XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"];
const DIRECTIONS  = ["All", "BUY", "SELL"];
const STATUSES    = ["All", "OPEN", "STOP LOSS", "TP1", "TP2"];
const SORTS       = ["Latest", "Confidence ↓", "Pair A–Z"];

export default function SignalsPage() {
  const [pair, setPair]       = useState("All Pairs");
  const [dir, setDir]         = useState("All");
  const [status, setStatus]   = useState("All");
  const [sort, setSort]       = useState("Latest");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: signals, isLoading, isError } = useSignals(pair, dir, status);

  const sorted = [...(signals ?? [])].sort((a, b) => {
    if (sort === "Confidence ↓") return b.confidence - a.confidence;
    if (sort === "Pair A–Z") return a.pair.localeCompare(b.pair);
    return 0; // Latest — already sorted by API
  });

  const openCount = signals?.filter(s => s.status === "OPEN").length ?? 0;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white tracking-wide">⚡ Signal Feed</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {signals ? `${signals.length} signals` : "Loading…"}
            {openCount > 0 && <span className="ml-2 text-emerald-400">● {openCount} open</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LydiaAvatar size={32} />
          <div>
            <div className="text-[9px] text-[#D4AF37] font-bold">LYDIA ✦</div>
            <div className="text-[8px] text-gray-600">Monitoring</div>
          </div>
        </div>
      </div>

      {/* filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">PAIR</span>
            <FilterSelect value={pair} onChange={setPair} options={PAIRS} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">DIR</span>
            <FilterSelect value={dir} onChange={setDir} options={DIRECTIONS} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 tracking-widest">STATUS</span>
            <FilterSelect value={status} onChange={setStatus} options={STATUSES} />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] text-gray-600 tracking-widest">SORT</span>
            <FilterSelect value={sort} onChange={setSort} options={SORTS} />
          </div>
        </div>
      </Card>

      {/* status badges */}
      {signals && (
        <div className="flex flex-wrap gap-2">
          {[
            { l: "OPEN",      c: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", n: signals.filter(s => s.status === "OPEN").length      },
            { l: "STOP LOSS", c: "text-red-400 bg-red-500/10 border-red-500/25",             n: signals.filter(s => s.status === "STOP LOSS").length },
            { l: "TP1",       c: "text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/25",      n: signals.filter(s => s.status === "TP1").length       },
            { l: "TP2",       c: "text-[#F5C542] bg-[#F5C542]/10 border-[#F5C542]/25",      n: signals.filter(s => s.status === "TP2").length       },
          ].map(b => (
            <span key={b.l} className={`text-[10px] font-semibold px-3 py-1 rounded-full border ${b.c}`}>
              {b.l}: {b.n}
            </span>
          ))}
        </div>
      )}

      {/* signal list */}
      <div className="space-y-3">
        {isLoading ? [0,1,2,3,4].map(i => <SkeletonCard key={i} h={140} />) :
         isError   ? <ReconnectingState /> :
         sorted.length === 0 ? (
           <div className="text-center py-16 text-gray-600">
             <div className="text-3xl mb-3">📭</div>
             <p className="text-[13px]">No signals match the current filters.</p>
           </div>
         ) :
         sorted.map(s => (
           <div key={s.id}>
             <SignalCard s={s} onExpand={id => setExpanded(expanded === id ? null : id)} />
             {expanded === s.id && (
               <div className="mt-1 px-5 py-4 rounded-b-2xl bg-[#0A0A0A] border border-[#D4AF37]/10 border-t-0 -mt-2 pt-5">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
                   <div>
                     <div className="text-gray-600 mb-0.5">Signal ID</div>
                     <div className="text-white font-bold">#{s.id}</div>
                   </div>
                   <div>
                     <div className="text-gray-600 mb-0.5">Risk / Reward</div>
                     <div className="text-white font-bold">
                       {s.direction === "BUY"
                         ? `1 : ${((s.tp1 - s.entry) / Math.abs(s.entry - s.sl)).toFixed(1)}`
                         : `1 : ${((s.entry - s.tp1) / Math.abs(s.sl - s.entry)).toFixed(1)}`}
                     </div>
                   </div>
                   <div>
                     <div className="text-gray-600 mb-0.5">H4 Trend</div>
                     <div className="text-[#D4AF37] font-bold">{s.h4trend}</div>
                   </div>
                   <div>
                     <div className="text-gray-600 mb-0.5">Starred</div>
                     <div className="text-white font-bold">{s.starred ? "★ Yes" : "No"}</div>
                   </div>
                 </div>
                 <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                   <LydiaAvatar size={24} />
                   <p className="text-[10px] text-gray-500 italic">
                     Confidence {s.confidence}% — {s.h4trend} setup on {s.pair}. Always manage risk with proper position sizing.
                   </p>
                 </div>
               </div>
             )}
           </div>
         ))}
      </div>
    </div>
  );
}
