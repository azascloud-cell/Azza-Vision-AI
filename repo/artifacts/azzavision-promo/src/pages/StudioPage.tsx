import { useState } from "react";
import { useStats } from "../hooks/useStats";
import { LydiaAvatar } from "../components/Shared";

const QUOTES = [
  "Trade with Discipline, Not Emotion.",
  "Discipline Over Emotion. Consistent Today. Freedom Tomorrow.",
  "Cut your losses short, let your profits run.",
  "The market rewards patience and punishes greed.",
  "One bad trade is never a reason to break your rules.",
  "Your edge means nothing without consistency.",
  "Risk management is the only thing you can control.",
  "Be patient. Be disciplined. Be Azza.",
];

type Template = "quote" | "signal" | "performance";

export default function StudioPage() {
  const [template, setTemplate] = useState<Template>("quote");
  const [quoteText, setQuoteText] = useState(QUOTES[0]);
  const [author, setAuthor] = useState("Azza");

  const { data: stats } = useStats();

  function handleCopy() {
    const el = document.getElementById("preview-card");
    if (!el) return;
    // Copy as text fallback
    const text = el.innerText;
    navigator.clipboard?.writeText(text);
    alert("Preview text copied to clipboard! Use a screenshot tool to save as image.");
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">🎨 Studio</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Generate shareable content cards</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* editor */}
        <div className="space-y-4">
          {/* template selector */}
          <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-4">
            <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-3">TEMPLATE</div>
            <div className="flex gap-2">
              {(["quote", "signal", "performance"] as Template[]).map(t => (
                <button key={t} onClick={() => setTemplate(t)}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold capitalize transition-all ${
                    template === t
                      ? "bg-[#D4AF37] text-black"
                      : "bg-[#111] text-gray-400 border border-[#D4AF37]/15 hover:border-[#D4AF37]/35"
                  }`}>
                  {t === "quote" ? "Quote Card" : t === "signal" ? "Signal Card" : "Perf Card"}
                </button>
              ))}
            </div>
          </div>

          {/* quote editor */}
          {template === "quote" && (
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-4 space-y-3">
              <div className="text-[9px] text-gray-600 font-semibold tracking-widest">QUICK QUOTES</div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {QUOTES.map((q, i) => (
                  <button key={i} onClick={() => setQuoteText(q)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-all ${
                      quoteText === q ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30" : "text-gray-400 hover:bg-white/4"
                    }`}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="text-[9px] text-gray-600 font-semibold tracking-widest pt-1">CUSTOM QUOTE</div>
              <textarea
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                rows={3}
                className="w-full bg-[#111] border border-[#D4AF37]/20 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#D4AF37]/50 resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-600 tracking-widest">AUTHOR</span>
                <input
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  className="flex-1 bg-[#111] border border-[#D4AF37]/20 rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#D4AF37]/50"
                />
              </div>
            </div>
          )}

          {(template === "signal" || template === "performance") && (
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-4">
              <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-2">DATA SOURCE</div>
              <p className="text-[11px] text-gray-500">
                {template === "signal"
                  ? "Pulling latest signal data from live feed."
                  : "Pulling performance summary from API."}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">Live data</span>
              </div>
            </div>
          )}

          <button onClick={handleCopy}
            className="w-full py-3 rounded-xl font-bold text-[13px] text-black transition-all hover:scale-[1.01]"
            style={{ background: "linear-gradient(90deg,#D4AF37,#F5C542)", boxShadow: "0 0 20px rgba(212,175,55,0.25)" }}>
            ⬇ Download / Copy Card
          </button>
        </div>

        {/* preview */}
        <div>
          <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-3">LIVE PREVIEW</div>
          {template === "quote" && (
            <div id="preview-card" className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#0A0800,#0D0D0D,#111)",
                border: "2px solid rgba(212,175,55,0.35)",
                boxShadow: "0 0 40px rgba(212,175,55,0.1), 0 0 80px rgba(0,0,0,0.8)",
                padding: "32px",
                minHeight: 280,
              }}>
              <div className="flex items-start gap-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 blur-sm bg-[#D4AF37]/30 rounded-full" />
                  <svg viewBox="0 0 40 36" width={32} height={32}>
                    <polygon points="20,2 38,34 2,34" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
                    <circle cx="20" cy="20" r="5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
                    <circle cx="20" cy="20" r="2.2" fill="#D4AF37" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#D4AF37] tracking-[0.2em]">AZZAVISION AI</div>
                  <div className="text-[8px] text-gray-600 tracking-widest">PROFESSIONAL TRADING MONITOR</div>
                </div>
              </div>
              <div className="text-[11px] text-[#D4AF37]/60 mb-3 tracking-widest">" "</div>
              <p className="text-[18px] font-black text-white leading-snug mb-4" style={{ textShadow: "0 0 20px rgba(212,175,55,0.15)" }}>
                {quoteText || "Enter your quote…"}
              </p>
              <div className="flex items-center justify-between mt-6 pt-4"
                style={{ borderTop: "1px solid rgba(212,175,55,0.15)" }}>
                <p className="text-[14px] text-[#D4AF37]" style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>
                  — {author}
                </p>
                <div className="flex items-center gap-2">
                  <LydiaAvatar size={24} />
                  <span className="text-[9px] text-gray-600">t.me/azzavisionai</span>
                </div>
              </div>
            </div>
          )}

          {template === "signal" && (
            <div id="preview-card" className="rounded-2xl overflow-hidden p-6"
              style={{
                background: "linear-gradient(135deg,#0A0800,#0D0D0D)",
                border: "2px solid rgba(212,175,55,0.35)",
                boxShadow: "0 0 40px rgba(212,175,55,0.1)",
              }}>
              <div className="text-[9px] text-[#D4AF37] tracking-widest font-semibold mb-3">AZZAVISION AI · SIGNAL ALERT</div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[28px] font-black text-white">XAUUSD</span>
                <span className="text-[14px] font-bold px-3 py-1 rounded-lg text-emerald-400 bg-emerald-500/15">BUY</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/25">OPEN</span>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {[["ENTRY","4103.21","text-blue-400"],["SL","4099.21","text-red-400"],["TP1","4109.21","text-emerald-400"],["TP2","4123.00","text-emerald-300"]].map(([l,v,c]) => (
                  <div key={l}>
                    <div className="text-[8px] text-gray-600 tracking-widest mb-1">{l}</div>
                    <div className={`text-[15px] font-black ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="h-[4px] bg-[#181818] rounded-full mb-1">
                <div className="h-full rounded-full" style={{ width: "81%", background: "linear-gradient(90deg,#D4AF37,#F5C542)", boxShadow: "0 0 8px rgba(212,175,55,0.5)" }} />
              </div>
              <div className="flex justify-between items-center text-[9px] text-gray-600 mb-3">
                <span>Confidence</span><span>81%</span>
              </div>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(212,175,55,0.12)" }}>
                <span className="text-[9px] text-gray-600">t.me/azzavisionai</span>
                <LydiaAvatar size={22} />
              </div>
            </div>
          )}

          {template === "performance" && stats && (
            <div id="preview-card" className="rounded-2xl overflow-hidden p-6"
              style={{
                background: "linear-gradient(135deg,#0A0800,#0D0D0D)",
                border: "2px solid rgba(212,175,55,0.35)",
                boxShadow: "0 0 40px rgba(212,175,55,0.1)",
              }}>
              <div className="text-[9px] text-[#D4AF37] tracking-widest font-semibold mb-4">AZZAVISION AI · PERFORMANCE REPORT</div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  ["TOTAL SIGNALS", stats.totalSignals, "text-white"],
                  ["WIN RATE", `${stats.winRate}%`, "text-red-400"],
                  ["TOTAL PIPS", `+${stats.totalPips.toLocaleString()}`, "text-emerald-400"],
                  ["AVG PIPS/TRADE", `+${stats.avgPips}`, "text-[#D4AF37]"],
                ].map(([l, v, c]) => (
                  <div key={String(l)} className="rounded-xl bg-[#111] p-3 border border-[#D4AF37]/10">
                    <div className="text-[8px] text-gray-600 tracking-widest mb-1">{l}</div>
                    <div className={`text-[22px] font-black ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(212,175,55,0.12)" }}>
                <p className="text-[13px] text-[#D4AF37]" style={{ fontFamily: "Georgia, serif", fontWeight: 700 }}>Azza</p>
                <div className="flex items-center gap-2">
                  <LydiaAvatar size={22} />
                  <span className="text-[9px] text-gray-600">t.me/azzavisionai</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
