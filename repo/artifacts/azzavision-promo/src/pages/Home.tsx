import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo, LiveClock, MusicPlayer } from "../components/Shared";
import DashboardPage  from "./DashboardPage";
import SignalsPage    from "./SignalsPage";
import JournalPage    from "./JournalPage";
import StudioPage     from "./StudioPage";
import BacktestPage   from "./BacktestPage";
import PerformancePage from "./PerformancePage";
import ReportsPage    from "./ReportsPage";
import SettingsPage   from "./SettingsPage";

type Page = "dashboard" | "journal" | "studio" | "signals" | "backtest" | "performance" | "reports" | "settings";

// ─── Nav icons ────────────────────────────────────────────────────────────────
const ic = (d: string) => () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d={d} />
  </svg>
);

function IcoDash() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <rect x="1" y="1" width="6" height="6" rx="1.2" /><rect x="9" y="1" width="6" height="6" rx="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" /><rect x="9" y="9" width="6" height="6" rx="1.2" />
    </svg>
  );
}
const IcoJrnl = ic("M3 1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm2 4h6m-6 3h6m-6 3h4");
const IcoStud = ic("M8 1l7 7-7 7V1z");
const IcoSig  = ic("M1 12 5 7 8 9 11 4 15 4M11 4h4v4");
const IcoBkt  = ic("M3 8A5 5 0 118 13M3 5v3h3");
const IcoPerf = ic("M1 12l4-5 3 2 3-5 4 2M11 4l4 4");
const IcoRpt  = ic("M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 8h2v3H5zm3-3h2v6H8zm3-3h2v9h-2");
const IcoSet  = ic("M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M12.78 3.22l-1.42 1.42M4.64 11.36l-1.42 1.42M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z");
function IcoClk() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 2" />
    </svg>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [mob,  setMob]  = useState(false);
  const qc = useQueryClient();

  // close sidebar on page resize to desktop
  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setMob(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const nav: { id: Page; Icon: () => JSX.Element; label: string }[] = [
    { id: "dashboard",   Icon: IcoDash,  label: "Dashboard"   },
    { id: "journal",     Icon: IcoJrnl,  label: "Journal"     },
    { id: "studio",      Icon: IcoStud,  label: "Studio"      },
    { id: "signals",     Icon: IcoSig,   label: "Signals"     },
    { id: "backtest",    Icon: IcoBkt,   label: "Backtest"    },
    { id: "performance", Icon: IcoPerf,  label: "Performance" },
    { id: "reports",     Icon: IcoRpt,   label: "Reports"     },
    { id: "settings",    Icon: IcoSet,   label: "Settings"    },
  ];

  function navigate(id: Page) {
    setPage(id);
    setMob(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="flex h-screen bg-[#0B0B0B] text-white overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }

        @keyframes floatY {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes floatY2 {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }
        @keyframes goldShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
          50%      { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .float-a  { animation: floatY  4s ease-in-out infinite; }
        .float-b  { animation: floatY2 5s 0.8s ease-in-out infinite; }
        .shimmer-gold {
          background: linear-gradient(90deg,#D4AF37,#F5C542,#fffacd,#F5C542,#D4AF37);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: goldShimmer 3s linear infinite;
        }
        .live-btn { animation: livePulse 2.2s infinite; }
        ::-webkit-scrollbar        { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track  { background: #111; }
        ::-webkit-scrollbar-thumb  { background: #D4AF37; border-radius: 2px; }
        .nav-active {
          background: linear-gradient(135deg,rgba(212,175,55,0.20),rgba(212,175,55,0.06));
          border: 1px solid rgba(212,175,55,0.38);
          box-shadow: 0 0 14px rgba(212,175,55,0.10), inset 0 1px 0 rgba(212,175,55,0.12);
        }
        .nav-active span { filter: drop-shadow(0 0 4px rgba(212,175,55,0.55)); }
        .page-fade { animation: fadeInUp 0.38s cubic-bezier(0.22,1,0.36,1) both; }
        .card-fade { animation: fadeInCard 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        @media (max-width: 639px) {
          .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .hero-chars { display: none !important; }
        }
      `}</style>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed lg:static z-40 flex-shrink-0 w-[215px] h-full flex flex-col
        bg-[#0D0D0D] border-r border-[#D4AF37]/10
        transition-transform duration-300 lg:translate-x-0
        ${mob ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#D4AF37]/10 flex-shrink-0">
          <div className="relative">
            <div className="absolute inset-0 blur-md bg-[#D4AF37]/25 rounded-full" />
            <Logo size={32} />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-[0.2em] text-[#D4AF37]">AZZAVISION</div>
            <div className="text-[8px] text-gray-600 tracking-widest">AI</div>
          </div>
        </div>

        {/* lydia chip */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#D4AF37]/8 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}lydia-char.png`} alt="Lydia" draggable={false}
              style={{ width: 38, height: 38, objectFit: "cover", objectPosition: "top", borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)" }}
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0D0D0D]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Lydia ✦</div>
            <div className="text-[9px] text-gray-500">AI Assistant</div>
            <div className="text-[9px] text-emerald-400">● Always here!</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map(({ id, Icon, label }) => (
            <button key={id} onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 text-left
                ${page === id ? "nav-active text-[#D4AF37]" : "text-gray-400 hover:text-gray-100 hover:bg-white/4"}`}>
              <span className="w-4 h-4 flex-shrink-0 opacity-80"><Icon /></span>
              {label}
            </button>
          ))}
        </nav>

        {/* music player */}
        <MusicPlayer />

        {/* market time */}
        <div className="mx-3 mb-2 p-3.5 rounded-xl bg-[#111] border border-[#D4AF37]/22 flex-shrink-0"
          style={{ boxShadow: "0 0 18px rgba(212,175,55,0.04), inset 0 1px 0 rgba(212,175,55,0.08)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[#D4AF37]/70"><IcoClk /></span>
            <span className="text-[9px] text-[#D4AF37] font-semibold tracking-[0.18em]">MARKET TIME</span>
          </div>
          <LiveClock />
        </div>

        {/* community */}
        <div className="mx-3 mb-2 p-3.5 rounded-xl bg-[#111] border border-[#D4AF37]/8 flex-shrink-0">
          <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-2.5">JOIN COMMUNITY</div>
          <div className="flex items-center gap-1.5">
            {[
              { l: "TG", c: "#229ED9", h: "https://t.me/azzavisionai" },
              { l: "YT", c: "#FF0000", h: "#" },
              { l: "IG", c: "#E1306C", h: "#" },
              { l: "TK", c: "#69C9D0", h: "#" },
            ].map(s => (
              <a key={s.l} href={s.h} target="_blank" rel="noreferrer"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white hover:scale-110 transition-transform"
                style={{ background: s.c + "28", border: `1px solid ${s.c}44` }}>
                {s.l}
              </a>
            ))}
          </div>
          <div className="text-[8px] text-gray-700 mt-1.5">t.me/azzavisionai</div>
        </div>

        <div className="px-5 pb-4 flex-shrink-0">
          <div className="text-[8px] text-gray-700">© 2026 AZZAVISION AI</div>
          <div className="text-[8px] text-gray-700">All Rights Reserved.</div>
        </div>
      </aside>

      {/* mobile overlay */}
      {mob && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMob(false)} />
      )}

      {/* ══ MAIN ═════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#D4AF37]/10 bg-[#0B0B0B]/95 backdrop-blur-md">
          <button className="lg:hidden mr-2 text-gray-400 hover:text-white text-lg" onClick={() => setMob(true)}>☰</button>

          <div>
            <h1 className="text-[22px] font-black shimmer-gold tracking-wide leading-none">AZZAVISION AI</h1>
            <p className="text-[9px] text-gray-600 tracking-[0.22em] mt-0.5">PROFESSIONAL TRADING MONITOR</p>
          </div>

          <div className="hidden xl:flex items-center px-4 py-2 rounded-xl border border-[#D4AF37]/15 bg-[#111]/70">
            <div>
              <p className="text-[11px] text-gray-300 italic">"Trade with Discipline, Not Emotion."</p>
              <p className="text-[9px] text-[#D4AF37] mt-0.5 text-right">— Azza</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[9px] text-gray-500">Welcome Back,</div>
              <div className="text-[13px] font-black text-white leading-tight">Azza 👑</div>
              <div className="text-[8px] text-[#D4AF37]">Focus · Plan · Execute</div>
            </div>
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 live-btn">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
            </button>
            <button
              onClick={() => qc.invalidateQueries()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold border border-[#D4AF37]/25 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/12 transition-all">
              ↺ REFRESH
            </button>
          </div>
        </header>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4">
          <div key={page} className="page-fade">
            {page === "dashboard"   && <DashboardPage />}
            {page === "signals"     && <SignalsPage />}
            {page === "journal"     && <JournalPage />}
            {page === "studio"      && <StudioPage />}
            {page === "backtest"    && <BacktestPage />}
            {page === "performance" && <PerformancePage />}
            {page === "reports"     && <ReportsPage />}
            {page === "settings"    && <SettingsPage />}
          </div>
        </div>
      </main>
    </div>
  );
}
