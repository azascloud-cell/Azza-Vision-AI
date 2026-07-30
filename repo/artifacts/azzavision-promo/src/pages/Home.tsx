import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Signal {
  id: number; pair: string; direction: 'BUY' | 'SELL';
  status: 'OPEN' | 'STOP LOSS' | 'TP1' | 'TP2';
  entry: number; sl: number; tp1: number; tp2: number;
  h4trend: string; confidence: number; time: string; starred?: boolean;
}
type Page = 'dashboard' | 'journal' | 'studio' | 'signals' | 'backtest' | 'performance' | 'reports' | 'settings';

// ─── Static data ──────────────────────────────────────────────────────────────
const SIGNALS: Signal[] = [
  { id: 1, pair: 'XAUUSD', direction: 'BUY',  status: 'STOP LOSS', entry: 4104.74, sl: 4100.74, tp1: 4110.74, tp2: 4125.74, h4trend: 'STRONG_BUY', confidence: 76, time: '31 Jul 2026, 01.10', starred: true },
  { id: 2, pair: 'XAUUSD', direction: 'BUY',  status: 'STOP LOSS', entry: 4098.32, sl: 4094.32, tp1: 4104.32, tp2: 4118.32, h4trend: 'BUY',        confidence: 72, time: '31 Jul 2026, 00.45', starred: true },
  { id: 3, pair: 'XAUUSD', direction: 'BUY',  status: 'OPEN',      entry: 4103.21, sl: 4099.21, tp1: 4109.21, tp2: 4123.00, h4trend: 'STRONG_BUY', confidence: 81, time: '31 Jul 2026, 00.59' },
  { id: 4, pair: 'XAUUSD', direction: 'SELL', status: 'TP1',       entry: 4115.50, sl: 4120.00, tp1: 4109.00, tp2: 4100.00, h4trend: 'SELL',       confidence: 68, time: '30 Jul 2026, 22.30' },
];

const PERF_DATA = [
  { date: '25 Jul', pips: -200 },
  { date: '26 Jul', pips: 180  },
  { date: '27 Jul', pips: 820  },
  { date: '28 Jul', pips: 1450 },
  { date: '29 Jul', pips: 2100 },
  { date: '30 Jul', pips: 3200 },
  { date: '31 Jul', pips: 4380 },
];

const DIST_DATA = [
  { name: 'Win',       value: 81,  color: '#22c55e' },
  { name: 'Loss',      value: 81,  color: '#ef4444' },
  { name: 'Breakeven', value: 30,  color: '#eab308' },
];

const BEST = [
  { rank: 1, pair: 'XAUUSD', pips: '+2,850' },
  { rank: 2, pair: 'EURUSD', pips: '+720'   },
  { rank: 3, pair: 'GBPUSD', pips: '+510'   },
];

// ─── Mascot crop (CSS background-image for pixel-perfect clipping) ─────────────
function Mascot({
  xPct, yPct, wPct, hPct, w, h,
  className = '', style = {} as React.CSSProperties,
}: {
  xPct: number; yPct: number; wPct: number; hPct: number;
  w: number; h: number; className?: string; style?: React.CSSProperties;
}) {
  // bgSize = natural sprite sheet rendered at (w / wPct * 100) × (h / hPct * 100)
  const bgW = (w / wPct) * 100;
  const bgH = (h / hPct) * 100;
  const bgX = -(xPct / wPct) * w;
  const bgY = -(yPct / hPct) * h;
  return (
    <div
      className={className}
      style={{
        width: w, height: h, flexShrink: 0,
        backgroundImage: `url(${import.meta.env.BASE_URL}mascot.png)`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${bgX}px ${bgY}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'auto',
        ...style,
      }}
    />
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 36" width={size} height={size}>
      <polygon points="20,2 38,34 2,34" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2.2" fill="#D4AF37" />
    </svg>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const date = t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return (
    <>
      <div className="text-[10px] text-gray-500 mb-0.5">{date}</div>
      <div className="text-[22px] font-black text-[#D4AF37] tracking-wider leading-none">{time}</div>
      <div className="text-[9px] text-gray-600 mt-1">(WIB)</div>
    </>
  );
}

// ─── Azza SVG character ───────────────────────────────────────────────────────
function AzzaChar({ w = 120, h = 170 }: { w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, position: 'relative', flexShrink: 0 }}>
      <svg viewBox="0 0 80 120" width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="ag" cx="50%" cy="60%" r="55%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="80" height="120" fill="url(#ag)" />
        {/* body / hoodie */}
        <rect x="18" y="62" width="44" height="46" rx="6" fill="#141410" />
        <rect x="18" y="62" width="44" height="10" rx="3" fill="#1C1C14" />
        {/* hoodie logo */}
        <text x="40" y="86" textAnchor="middle" fill="#D4AF37" fontSize="9" fontWeight="900">▲</text>
        <text x="40" y="96" textAnchor="middle" fill="#D4AF37" fontSize="5" letterSpacing="1">AZZA</text>
        {/* neck */}
        <rect x="33" y="54" width="14" height="12" rx="3" fill="#C8906A" />
        {/* head */}
        <ellipse cx="40" cy="41" rx="17" ry="19" fill="#C8906A" />
        {/* hair base */}
        <ellipse cx="40" cy="24" rx="18" ry="11" fill="#111008" />
        <rect x="22" y="24" width="36" height="14" rx="2" fill="#111008" />
        {/* spiky hair strands */}
        <path d="M22 28 Q18 15 24 10 Q26 20 22 28Z" fill="#111008" />
        <path d="M58 28 Q62 14 55 9 Q54 21 58 28Z" fill="#111008" />
        <path d="M40 22 Q38 10 40 6 Q42 10 40 22Z" fill="#111008" />
        <path d="M32 24 Q28 12 33 7 Q34 18 32 24Z" fill="#111008" />
        <path d="M50 24 Q54 11 49 7 Q48 18 50 24Z" fill="#111008" />
        {/* ears */}
        <ellipse cx="23" cy="41" rx="3.5" ry="4.5" fill="#C8906A" />
        <ellipse cx="57" cy="41" rx="3.5" ry="4.5" fill="#C8906A" />
        {/* eyebrows */}
        <path d="M31 34 Q34 31 37 33" stroke="#111008" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M43 33 Q46 31 49 34" stroke="#111008" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <ellipse cx="34" cy="40" rx="3.5" ry="4" fill="#111008" />
        <ellipse cx="46" cy="40" rx="3.5" ry="4" fill="#111008" />
        <ellipse cx="34" cy="40" rx="2.5" ry="3" fill="#3B2A10" />
        <ellipse cx="46" cy="40" rx="2.5" ry="3" fill="#3B2A10" />
        <circle cx="35.2" cy="38.5" r="1" fill="white" opacity="0.85" />
        <circle cx="47.2" cy="38.5" r="1" fill="white" opacity="0.85" />
        {/* nose */}
        <path d="M39 46 Q40 48 41 46" stroke="#A0704A" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* slight smile */}
        <path d="M36 50 Q40 53 44 50" stroke="#A0704A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* arms */}
        <rect x="8"  y="65" width="12" height="36" rx="6" fill="#141410" />
        <rect x="60" y="65" width="12" height="36" rx="6" fill="#141410" />
        {/* hands */}
        <ellipse cx="14"  cy="102" rx="6" ry="5" fill="#C8906A" />
        <ellipse cx="66"  cy="102" rx="6" ry="5" fill="#C8906A" />
        {/* laptop base */}
        <rect x="10" y="103" width="60" height="14" rx="3" fill="#222" />
        <rect x="12" y="105" width="56" height="10" rx="2" fill="#0A0A0A" />
        {/* screen glow */}
        <rect x="13" y="106" width="54" height="8" rx="1" fill="#D4AF37" opacity="0.08" />
        {/* mini chart on screen */}
        <polyline points="15,112 21,110 27,113 33,108 39,111 45,106 51,109 57,104 63,107" fill="none" stroke="#D4AF37" strokeWidth="0.9" opacity="0.75" />
        {/* gold sparkles */}
        <text x="8"  y="58" fill="#F5C542" fontSize="7" opacity="0.7">✦</text>
        <text x="68" y="55" fill="#F5C542" fontSize="5" opacity="0.5">✦</text>
        <text x="2"  y="85" fill="#D4AF37" fontSize="4" opacity="0.4">✦</text>
      </svg>
      {/* name badge */}
      <div style={{
        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
        padding: '2px 8px', borderRadius: 6,
        background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 8, color: '#D4AF37', fontWeight: 900, letterSpacing: 1 }}>AZZA</span>
      </div>
    </div>
  );
}

// ─── Decorative candle background ─────────────────────────────────────────────
function CandleBg() {
  const candles = [
    { x: 8,  o: 62, c: 42, h: 30, l: 72, bull: true  },
    { x: 20, o: 57, c: 37, h: 26, l: 68, bull: true  },
    { x: 32, o: 52, c: 66, h: 22, l: 80, bull: false },
    { x: 44, o: 64, c: 50, h: 36, l: 76, bull: true  },
    { x: 56, o: 47, c: 32, h: 22, l: 57, bull: true  },
    { x: 68, o: 37, c: 52, h: 18, l: 66, bull: false },
    { x: 80, o: 50, c: 40, h: 27, l: 62, bull: true  },
    { x: 92, o: 42, c: 27, h: 17, l: 52, bull: true  },
  ];
  return (
    <svg viewBox="0 0 112 100" className="w-full h-full" preserveAspectRatio="none">
      {candles.map((c, i) => (
        <g key={i} opacity={0.18}>
          <line x1={c.x} y1={c.h} x2={c.x} y2={c.l} stroke={c.bull ? '#D4AF37' : '#ef4444'} strokeWidth="0.7" />
          <rect x={c.x - 3.5} y={Math.min(c.o, c.c)} width={7} height={Math.max(Math.abs(c.o - c.c), 1.5)}
            fill={c.bull ? '#D4AF37' : '#ef4444'} rx="0.4" />
        </g>
      ))}
      <polyline
        points="8,68 20,62 32,52 44,56 56,43 68,38 80,28 92,20"
        fill="none" stroke="#F5C542" strokeWidth="1.2" strokeDasharray="4,3" opacity={0.22}
      />
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-white' }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="relative group flex flex-col gap-2 p-5 rounded-2xl bg-[#111] border border-[#D4AF37]/18 hover:border-[#D4AF37]/45 transition-all duration-300 overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.45)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(212,175,55,0.06) 0%, transparent 70%)' }} />
      {/* top accent line */}
      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-2">
        <span className="text-[#D4AF37]/60 flex-shrink-0">{icon}</span>
        <span className="text-[9px] text-gray-600 font-semibold tracking-[0.2em] uppercase">{label}</span>
      </div>
      <div className={`text-[28px] font-black leading-none tracking-tight ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 leading-tight">{sub}</div>
    </div>
  );
}

// ─── Signal card ──────────────────────────────────────────────────────────────
function SignalCard({ s }: { s: Signal }) {
  const buy = s.direction === 'BUY';
  const statusStyle: Record<string, string> = {
    'OPEN':      'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
    'STOP LOSS': 'text-red-400     bg-red-500/15     border-red-500/35',
    'TP1':       'text-[#D4AF37]   bg-[#D4AF37]/15   border-[#D4AF37]/35',
    'TP2':       'text-[#F5C542]   bg-[#F5C542]/15   border-[#F5C542]/35',
  };
  return (
    <div className="group relative rounded-2xl bg-[#0F0F0F] border border-[#D4AF37]/12 hover:border-[#D4AF37]/40 transition-all duration-300 p-5 overflow-hidden"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(212,175,55,0.05) 0%, transparent 55%)' }} />
      {/* gold top line on hover */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#D4AF37]/60 via-[#F5C542]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {s.starred && <span className="text-[#D4AF37] text-xs">★</span>}
          <span className="text-white font-black text-[19px] tracking-wider">{s.pair}</span>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${buy ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'}`}>
            {s.direction}
          </span>
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md border ${statusStyle[s.status]}`}>
            {s.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">{s.time}</span>
          <span className="text-gray-600 hover:text-[#D4AF37] cursor-pointer text-sm transition-colors">›</span>
        </div>
      </div>

      {/* data grid */}
      <div className="grid grid-cols-6 gap-x-3 gap-y-0 mb-4">
        {[
          { l: 'ENTRY',      v: s.entry.toFixed(2),   c: 'text-blue-400'   },
          { l: 'SL',         v: s.sl.toFixed(2),      c: 'text-red-400'    },
          { l: 'TP1',        v: s.tp1.toFixed(2),     c: 'text-emerald-400'},
          { l: 'TP2',        v: s.tp2.toFixed(2),     c: 'text-emerald-300'},
          { l: 'H4 TREND',   v: s.h4trend,            c: 'text-[#D4AF37]'  },
          { l: 'CONFIDENCE', v: `${s.confidence}%`,   c: 'text-white'      },
        ].map(d => (
          <div key={d.l}>
            <div className="text-[8px] text-gray-600 font-semibold tracking-widest mb-1">{d.l}</div>
            <div className={`text-sm font-bold ${d.c}`}>{d.v}</div>
          </div>
        ))}
      </div>

      {/* confidence bar */}
      <div className="h-[5px] bg-[#181818] rounded-full overflow-hidden">
        <div className="h-full rounded-full"
          style={{
            width: `${s.confidence}%`,
            background: 'linear-gradient(90deg, #D4AF37, #F5C542)',
            boxShadow: '0 0 8px rgba(212,175,55,0.55)',
          }} />
      </div>
      <div className="flex justify-end mt-1.5">
        <span className="text-[9px] text-gray-600">{s.confidence}%</span>
      </div>
    </div>
  );
}

// ─── Recharts tooltip ─────────────────────────────────────────────────────────
function GoldTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs bg-[#111] border border-[#D4AF37]/30"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
      <div className="text-gray-400 mb-0.5">{label}</div>
      <div className="text-[#D4AF37] font-black">+{payload[0].value.toLocaleString()} pips</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mob, setMob]   = useState(false);
  const [pair, setPair] = useState('All Pairs');

  const nav: { id: Page; Icon: () => JSX.Element; label: string }[] = [
    { id: 'dashboard',   Icon: IcoDash,  label: 'Dashboard'   },
    { id: 'journal',     Icon: IcoJrnl,  label: 'Journal'     },
    { id: 'studio',      Icon: IcoStud,  label: 'Studio'      },
    { id: 'signals',     Icon: IcoSig,   label: 'Signals'     },
    { id: 'backtest',    Icon: IcoBkt,   label: 'Backtest'    },
    { id: 'performance', Icon: IcoPerf,  label: 'Performance' },
    { id: 'reports',     Icon: IcoRpt,   label: 'Reports'     },
    { id: 'settings',    Icon: IcoSet,   label: 'Settings'    },
  ];

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

        .gb { border: 1px solid rgba(212,175,55,0.22); box-shadow: 0 0 18px rgba(212,175,55,0.04), inset 0 1px 0 rgba(212,175,55,0.08); }
        .nav-active {
          background: linear-gradient(135deg,rgba(212,175,55,0.16),rgba(212,175,55,0.04));
          border: 1px solid rgba(212,175,55,0.28);
        }
      `}</style>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed lg:static z-40 flex-shrink-0 w-[215px] h-full flex flex-col
        bg-[#0D0D0D] border-r border-[#D4AF37]/10
        transition-transform duration-300 lg:translate-x-0
        ${mob ? 'translate-x-0' : '-translate-x-full'}
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
            <Mascot xPct={0} yPct={0} wPct={33} hPct={32} w={38} h={38}
              style={{ borderRadius: '50%', border: '1px solid rgba(212,175,55,0.35)' }} />
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
            <button key={id} onClick={() => { setPage(id); setMob(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 text-left
                ${page === id ? 'nav-active text-[#D4AF37]' : 'text-gray-400 hover:text-gray-100 hover:bg-white/4'}`}>
              <span className="w-4 h-4 flex-shrink-0 opacity-80"><Icon /></span>
              {label}
            </button>
          ))}
        </nav>

        {/* market time */}
        <div className="mx-3 mb-2 p-3.5 rounded-xl bg-[#111] gb flex-shrink-0">
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
              { l: 'TG', c: '#229ED9', h: 'https://t.me/azzavisionai_bot' },
              { l: 'YT', c: '#FF0000', h: '#' },
              { l: 'IG', c: '#E1306C', h: '#' },
              { l: 'TK', c: '#69C9D0', h: '#' },
            ].map(s => (
              <a key={s.l} href={s.h} target="_blank" rel="noreferrer"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white hover:scale-110 transition-transform"
                style={{ background: s.c + '28', border: `1px solid ${s.c}44` }}>
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

      {mob && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMob(false)} />}

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
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold border border-[#D4AF37]/25 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/12 transition-all">
              ↺ REFRESH
            </button>
          </div>
        </header>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── HERO ── */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0D0D0D] gb" style={{ minHeight: 210 }}>
            {/* bg candles */}
            <div className="absolute inset-0 pointer-events-none"><CandleBg /></div>
            {/* right glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 75% 50%, rgba(212,175,55,0.1) 0%, transparent 65%)' }} />

            <div className="relative z-10 flex items-center gap-4 p-5">
              {/* left: quote */}
              <div className="flex-1 min-w-0 max-w-[280px]">
                <div className="inline-block px-3.5 py-3 rounded-xl mb-4"
                  style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)' }}>
                  <p className="text-[13px] text-white font-semibold italic leading-snug">
                    "Trade with Discipline,<br />Not Emotion."
                  </p>
                  <p className="text-[10px] text-[#D4AF37] mt-1.5" style={{ fontFamily: 'Georgia, serif' }}>— Azza</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-gray-500">System running · All signals live</span>
                </div>
              </div>

              {/* characters */}
              <div className="flex items-end justify-center gap-3 flex-shrink-0">
                {/* Azza */}
                <div className="float-b relative">
                  <div className="absolute -inset-3 rounded-2xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)' }} />
                  <AzzaChar w={118} h={168} />
                </div>
                {/* Lydia */}
                <div className="float-a relative">
                  <div className="absolute -inset-3 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)' }} />
                  <Mascot xPct={0} yPct={0} wPct={33} hPct={68} w={130} h={180}
                    className="relative" />
                  {/* lydia label */}
                  <div className="absolute bottom-6 right-0 px-2 py-1 rounded-lg text-center"
                    style={{ background: 'rgba(11,11,11,0.88)', border: '1px solid rgba(212,175,55,0.25)' }}>
                    <div className="text-[8px] text-[#D4AF37] font-bold">LYDIA ✦</div>
                    <div className="text-[7px] text-gray-500">AI Assistant</div>
                    <div className="flex items-center gap-1 justify-center mt-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[7px] text-emerald-400">Always here!</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* right: welcome */}
              <div className="hidden lg:block flex-shrink-0">
                <div className="px-4 py-3 rounded-xl text-right"
                  style={{ background: 'rgba(17,17,17,0.8)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <div className="text-[9px] text-gray-500 mb-1">Welcome Back,</div>
                  <div className="text-[17px] font-black text-white leading-tight">Azza 👑</div>
                  <div className="text-[9px] text-[#D4AF37] mt-0.5">Focus · Plan · Execute</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STATS ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard icon={<IcoGrid />} label="Total Signals" value="192"    sub="1 open"           />
            <StatCard icon={<IcoTgt  />} label="Win Rate"      value="42.4%"  sub="81W / 81L"        color="text-red-400"     />
            <StatCard icon={<IcoTrnd />} label="Total Pips"    value="+4,380" sub="avg +23/trade"    color="text-emerald-400" />
            <StatCard icon={<IcoClk  />} label="Last Signal"   value="01.10"  sub="31 Jul 2026 · 191 closed" />
          </div>

          {/* ── SIGNAL STREAM + SIDE PANEL ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-4">

            {/* signals */}
            <div className="rounded-2xl bg-[#0D0D0D] gb overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/10">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#D4AF37] text-sm">⚡</span>
                  <span className="text-[12px] font-black tracking-[0.18em]">SIGNAL STREAM</span>
                </div>
                <div className="flex items-center gap-2">
                  <select value={pair} onChange={e => setPair(e.target.value)}
                    className="text-[11px] bg-[#111] border border-[#D4AF37]/20 text-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-[#D4AF37]/50 cursor-pointer">
                    <option>All Pairs</option><option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option>
                  </select>
                  <button className="p-1.5 rounded-lg border border-white/6 text-gray-500 hover:text-[#D4AF37] hover:border-[#D4AF37]/25 transition-all">
                    <IcoFlt />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {SIGNALS.map(s => <SignalCard key={s.id} s={s} />)}
              </div>
            </div>

            {/* side panel */}
            <div className="flex flex-col gap-3">

              {/* server resources */}
              <div className="rounded-2xl bg-[#0D0D0D] gb p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[9px] text-gray-500 font-semibold tracking-widest">SERVER RESOURCES</span>
                  <span className="flex items-center gap-1.5 text-[9px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />RUNNING
                  </span>
                </div>
                {[
                  { l: 'CPU',    v: '0.0%',  bar: 1  },
                  { l: 'MEMORY', v: '55 MB', bar: 35 },
                  { l: 'DISK',   v: '—',     bar: null },
                  { l: 'UPTIME', v: '6m',    bar: null },
                ].map(r => (
                  <div key={r.l} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                    <span className="text-[11px] text-gray-500 w-16">{r.l}</span>
                    {r.bar !== null
                      ? <div className="flex items-center gap-2 flex-1">
                          <div className="flex-1 h-[3px] bg-[#1A1A1A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${Math.max(r.bar, 2)}%` }} />
                          </div>
                          <span className="text-[11px] text-white font-semibold w-12 text-right">{r.v}</span>
                        </div>
                      : <span className="text-[11px] text-white font-semibold">{r.v}</span>
                    }
                  </div>
                ))}
              </div>

              {/* signal checklist */}
              <div className="rounded-2xl bg-[#0D0D0D] gb p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[9px] text-gray-500 font-semibold tracking-widest">SIGNAL CHECKLIST</span>
                  <Mascot xPct={0} yPct={0} wPct={33} hPct={32} w={30} h={30}
                    style={{ borderRadius: '50%', border: '1px solid rgba(212,175,55,0.25)' }} />
                </div>
                {[
                  { l: 'H4 Trend',   badge: 'STRONG_BUY', ok: true  },
                  { l: 'H1 Trend',   badge: 'STRONG_BUY', ok: true  },
                  { l: 'Confidence', badge: '76%',         ok: false },
                ].map(c => (
                  <div key={c.l} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-4.5 h-4.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${c.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {c.ok ? '✓' : '✕'}
                      </span>
                      <span className="text-[11px] text-gray-300">{c.l}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/12 text-[#D4AF37] border border-[#D4AF37]/20">
                      {c.badge}
                    </span>
                  </div>
                ))}
              </div>

              {/* lydia assist */}
              <div className="rounded-2xl p-4 flex items-center gap-3 flex-1"
                style={{ background: 'linear-gradient(135deg,#130F00,#0D0D0D)', border: '1px solid rgba(212,175,55,0.18)' }}>
                <Mascot xPct={0} yPct={0} wPct={33} hPct={50} w={46} h={52}
                  className="rounded-xl flex-shrink-0" />
                <div>
                  <div className="text-[9px] text-[#D4AF37] font-bold mb-1">LYDIA says:</div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Market dalam mode <span className="text-[#D4AF37] font-semibold">STRONG_BUY</span>. Level <span className="text-white font-semibold">4100</span> jadi support kunci hari ini.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* ── PERFORMANCE SECTION ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* recharts area chart */}
            <div className="rounded-2xl bg-[#0D0D0D] gb p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] text-gray-500 font-semibold tracking-widest">PERFORMANCE CHART</span>
                <span className="text-[11px] text-emerald-400 font-black">+4,380 pips</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={PERF_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                  <defs>
                    <linearGradient id="gold-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#444' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: '#444' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<GoldTooltip />} />
                  <Area type="monotone" dataKey="pips" stroke="#D4AF37" strokeWidth={2}
                    fill="url(#gold-area)" dot={false}
                    activeDot={{ r: 4, fill: '#F5C542', stroke: '#D4AF37', strokeWidth: 1 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* recharts pie chart */}
            <div className="rounded-2xl bg-[#0D0D0D] gb p-5">
              <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">TRADE DISTRIBUTION</div>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <PieChart width={120} height={120}>
                    <Pie data={DIST_DATA} cx={55} cy={55} innerRadius={34} outerRadius={52}
                      dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                      {DIST_DATA.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[15px] font-black text-white leading-none">192</span>
                    <span className="text-[8px] text-gray-500 mt-0.5">TOTAL</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {DIST_DATA.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <div>
                        <div className="text-[9px] text-gray-500">{d.name}</div>
                        <div className="text-[10px] text-white font-semibold">
                          {d.value} ({((d.value / 192) * 100).toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* best performing */}
            <div className="rounded-2xl bg-[#0D0D0D] gb p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#D4AF37]">🏆</span>
                <span className="text-[9px] text-gray-500 font-semibold tracking-widest">BEST PERFORMING</span>
              </div>
              <div className="space-y-3.5">
                {BEST.map(b => (
                  <div key={b.rank} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                        b.rank === 1 ? 'bg-[#D4AF37] text-black' : b.rank === 2 ? 'bg-gray-600 text-white' : 'bg-[#7C3B10]/60 text-orange-300'
                      }`}>{b.rank}</span>
                      <span className="text-[13px] font-bold text-white">{b.pair}</span>
                    </div>
                    <span className="text-[13px] font-black text-emerald-400">{b.pips} pips</span>
                  </div>
                ))}
              </div>

              {/* small lydia decoration */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                <Mascot xPct={0} yPct={0} wPct={33} hPct={32} w={28} h={28}
                  style={{ borderRadius: '50%', border: '1px solid rgba(212,175,55,0.2)', opacity: 0.8 }} />
                <span className="text-[9px] text-gray-600 italic">Analysed by Lydia AI</span>
              </div>
            </div>

          </div>

          {/* ── FOOTER BAR ── */}
          <div className="rounded-2xl overflow-hidden gb"
            style={{ background: 'linear-gradient(135deg,#0E0D00,#0D0D0D,#0B0B0B)' }}>
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-5 gap-4">

              {/* logo */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 blur-md bg-[#D4AF37]/20 rounded-full" />
                  <Logo size={38} />
                </div>
                <div>
                  <div className="text-[12px] font-black text-[#D4AF37] tracking-widest">AZZAVISION AI</div>
                  <div className="text-[8px] text-gray-600 tracking-widest">PROFESSIONAL TRADING MONITOR</div>
                </div>
              </div>

              {/* slogan */}
              <div className="text-center">
                <p className="text-[15px] font-black text-white tracking-wide">Discipline Over Emotion.</p>
                <p className="text-[12px] text-gray-400 font-medium mt-0.5">
                  Consistent Today.&nbsp;
                  <span className="text-[#D4AF37] font-semibold">Freedom Tomorrow.</span>
                </p>
              </div>

              {/* signature + lydia */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-[22px] text-[#D4AF37] leading-none" style={{ fontFamily: 'Georgia, serif', fontWeight: 700 }}>
                    Azza
                  </div>
                  <div className="text-[8px] text-gray-600">Founder & Trader</div>
                </div>
                <div className="float-a">
                  <Mascot xPct={0} yPct={0} wPct={33} hPct={50} w={55} h={64}
                    className="rounded-xl" />
                </div>
              </div>

            </div>
          </div>

          <div className="h-3" />
        </div>
      </main>
    </div>
  );
}

// ─── Icon set ─────────────────────────────────────────────────────────────────
const ic = (d: string) => () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d={d} />
  </svg>
);

function IcoDash() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="1" y="1" width="6" height="6" rx="1.2" /><rect x="9" y="1" width="6" height="6" rx="1.2" />
    <rect x="1" y="9" width="6" height="6" rx="1.2" /><rect x="9" y="9" width="6" height="6" rx="1.2" />
  </svg>;
}
const IcoJrnl = ic('M3 1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm2 4h6m-6 3h6m-6 3h4');
const IcoStud = ic('M8 1l7 7-7 7V1z');
const IcoSig  = ic('M1 12 5 7 8 9 11 4 15 4M11 4h4v4');
const IcoBkt  = ic('M3 8A5 5 0 118 13M3 5v3h3');
const IcoPerf = ic('M1 12l4-5 3 2 3-5 4 2M11 4l4 4');
const IcoRpt  = ic('M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 8h2v3H5zm3-3h2v6H8zm3-3h2v9h-2');
const IcoSet  = ic('M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M12.78 3.22l-1.42 1.42M4.64 11.36l-1.42 1.42M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z');

function IcoClk() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"
    strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 2" />
  </svg>;
}
function IcoGrid() {
  return <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
    <rect x="1" y="1" width="5" height="5" rx="1" /><rect x="8" y="1" width="5" height="5" rx="1" />
    <rect x="1" y="8" width="5" height="5" rx="1" /><rect x="8" y="8" width="5" height="5" rx="1" />
  </svg>;
}
function IcoTgt() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5">
    <circle cx="7" cy="7" r="5.5" /><circle cx="7" cy="7" r="3" />
    <circle cx="7" cy="7" r="0.8" fill="currentColor" stroke="none" />
  </svg>;
}
function IcoTrnd() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M1 11l4-4.5L8 8.5l3-5 2.5 1.5" /><path d="M10 4l3 1.5V2" />
  </svg>;
}
function IcoFlt() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"
    strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M1 3h12M3 7h8M5 11h4" />
  </svg>;
}
