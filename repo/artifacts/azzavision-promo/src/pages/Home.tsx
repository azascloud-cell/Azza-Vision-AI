import { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Signal {
  id: number;
  pair: string;
  direction: 'BUY' | 'SELL';
  status: 'OPEN' | 'STOP LOSS' | 'TP1' | 'TP2';
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  h4trend: string;
  confidence: number;
  time: string;
  starred?: boolean;
}

// ─── Mascot Crop Helper ──────────────────────────────────────────────────────
function MascotCrop({
  xPct, yPct, wPct, hPct, displayW, displayH, className = '', style = {},
}: {
  xPct: number; yPct: number; wPct: number; hPct: number;
  displayW: number; displayH: number;
  className?: string; style?: React.CSSProperties;
}) {
  const scaleX = 100 / wPct;
  const scaleY = 100 / hPct;
  return (
    <div className={className} style={{ width: displayW, height: displayH, overflow: 'hidden', position: 'relative', flexShrink: 0, ...style }}>
      <img
        src={`${import.meta.env.BASE_URL}mascot.png`}
        alt="AZZAVISION mascot"
        style={{
          position: 'absolute',
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          left: `${-(xPct / wPct) * 100}%`,
          top: `${-(yPct / hPct) * 100}%`,
          imageRendering: 'auto',
        }}
        draggable={false}
      />
    </div>
  );
}

// ─── Triangle Logo SVG ───────────────────────────────────────────────────────
function TriangleLogo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 36" width={size} height={size}>
      <polygon points="20,2 38,34 2,34" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="20" cy="19" r="5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      <circle cx="20" cy="19" r="2" fill="#D4AF37" />
    </svg>
  );
}

// ─── Nav Item ────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
        active
          ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/5 text-[#D4AF37] border border-[#D4AF37]/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#D4AF37]' : ''}`}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, valueColor = 'text-white' }: {
  icon: React.ReactNode; label: string; value: string; sub: string; valueColor?: string;
}) {
  return (
    <div className="relative flex flex-col gap-2 p-5 rounded-2xl bg-[#111111] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.4)] group overflow-hidden">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 30px rgba(212,175,55,0.04)' }} />
      <div className="flex items-center gap-2">
        <span className="text-[#D4AF37] opacity-70">{icon}</span>
        <span className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">{label}</span>
      </div>
      <div className={`text-3xl font-black ${valueColor} leading-none`}>{value}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

// ─── Signal Card ─────────────────────────────────────────────────────────────
function SignalCard({ signal }: { signal: Signal }) {
  const isBuy = signal.direction === 'BUY';
  const isOpen = signal.status === 'OPEN';
  const isStopLoss = signal.status === 'STOP LOSS';

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    'STOP LOSS': 'bg-red-500/20 text-red-400 border-red-500/40',
    'TP1': 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
    'TP2': 'bg-[#F5C542]/20 text-[#F5C542] border-[#F5C542]/40',
  };

  return (
    <div className="relative rounded-2xl bg-[#0F0F0F] border border-[#D4AF37]/15 hover:border-[#D4AF37]/40 transition-all duration-300 p-5 group shadow-[0_2px_20px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Gold glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top left, rgba(212,175,55,0.04) 0%, transparent 60%)' }} />

      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {signal.starred && <span className="text-[#D4AF37] text-sm">★</span>}
          <span className="text-white font-black text-xl tracking-wide">{signal.pair}</span>
          <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md ${isBuy ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'}`}>
            {signal.direction}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${statusColors[signal.status]}`}>
            {signal.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{signal.time}</span>
          <span className="text-gray-600 hover:text-[#D4AF37] cursor-pointer transition-colors">›</span>
        </div>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {[
          { label: 'ENTRY', value: signal.entry.toFixed(2), color: 'text-blue-400' },
          { label: 'SL', value: signal.sl.toFixed(2), color: 'text-red-400' },
          { label: 'TP1', value: signal.tp1.toFixed(2), color: 'text-emerald-400' },
          { label: 'TP2', value: signal.tp2.toFixed(2), color: 'text-emerald-300' },
          { label: 'H4 TREND', value: signal.h4trend, color: 'text-[#D4AF37]' },
          { label: 'CONFIDENCE', value: `${signal.confidence}%`, color: 'text-white' },
        ].map(d => (
          <div key={d.label}>
            <div className="text-[9px] text-gray-600 font-semibold tracking-widest mb-1">{d.label}</div>
            <div className={`text-sm font-bold ${d.color}`}>{d.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${signal.confidence}%`,
            background: `linear-gradient(90deg, #D4AF37, #F5C542)`,
            boxShadow: '0 0 8px rgba(212,175,55,0.6)',
          }}
        />
      </div>
      <div className="flex justify-end mt-1">
        <span className="text-[10px] text-gray-500">{signal.confidence}%</span>
      </div>
    </div>
  );
}

// ─── Clock Component ─────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const hour = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div>
      <div className="text-[10px] text-gray-500 mb-1">{date}</div>
      <div className="text-2xl font-black text-[#D4AF37] tracking-wider">{hour}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">(WIB)</div>
    </div>
  );
}

// ─── Mini Candle Chart SVG ────────────────────────────────────────────────────
function MiniCandleChart() {
  // Static decorative candles for hero background
  const candles = [
    { x: 10, open: 60, close: 40, high: 30, low: 70, bull: true },
    { x: 22, open: 55, close: 35, high: 25, low: 65, bull: true },
    { x: 34, open: 50, close: 65, high: 20, low: 80, bull: false },
    { x: 46, open: 62, close: 48, high: 35, low: 75, bull: true },
    { x: 58, open: 45, close: 30, high: 20, low: 55, bull: true },
    { x: 70, open: 35, close: 50, high: 15, low: 65, bull: false },
    { x: 82, open: 48, close: 38, high: 25, low: 60, bull: true },
    { x: 94, open: 40, close: 25, high: 15, low: 50, bull: true },
  ];
  return (
    <svg viewBox="0 0 110 100" className="w-full h-full opacity-20" preserveAspectRatio="none">
      {candles.map((c, i) => (
        <g key={i}>
          <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.bull ? '#D4AF37' : '#ef4444'} strokeWidth="0.8" />
          <rect
            x={c.x - 4}
            y={Math.min(c.open, c.close)}
            width={8}
            height={Math.abs(c.open - c.close)}
            fill={c.bull ? '#D4AF37' : '#ef4444'}
            rx="0.5"
            opacity={0.8}
          />
        </g>
      ))}
      {/* Trend line */}
      <polyline
        points="10,65 22,60 34,50 46,55 58,42 70,38 82,30 94,22"
        fill="none"
        stroke="#F5C542"
        strokeWidth="1.5"
        strokeDasharray="3,2"
        opacity={0.5}
      />
    </svg>
  );
}

// ─── Donut Chart SVG ─────────────────────────────────────────────────────────
function DonutChart({ win, loss, breakeven }: { win: number; loss: number; breakeven: number }) {
  const total = win + loss + breakeven;
  const r = 40;
  const cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const winDash = (win / total) * circumference;
  const lossDash = (loss / total) * circumference;
  const beDash = (breakeven / total) * circumference;
  const winOffset = 0;
  const lossOffset = -winDash;
  const beOffset = -(winDash + lossDash);

  return (
    <svg viewBox="0 0 100 100" width="120" height="120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A1A" strokeWidth="14" />
      {/* Win */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth="13"
        strokeDasharray={`${winDash} ${circumference - winDash}`}
        strokeDashoffset={circumference / 4 + winOffset}
        strokeLinecap="butt"
      />
      {/* Loss */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth="13"
        strokeDasharray={`${lossDash} ${circumference - lossDash}`}
        strokeDashoffset={circumference / 4 + lossOffset}
        strokeLinecap="butt"
      />
      {/* Breakeven */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eab308" strokeWidth="13"
        strokeDasharray={`${beDash} ${circumference - beDash}`}
        strokeDashoffset={circumference / 4 + beOffset}
        strokeLinecap="butt"
      />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="900">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#888" fontSize="7" fontWeight="600">TOTAL</text>
    </svg>
  );
}

// ─── Performance Line Chart ───────────────────────────────────────────────────
function PerfChart() {
  const points = [
    { x: 0, y: 60 }, { x: 14, y: 55 }, { x: 28, y: 48 }, { x: 42, y: 42 },
    { x: 56, y: 38 }, { x: 70, y: 28 }, { x: 84, y: 18 }, { x: 100, y: 10 },
  ];
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L100,80 L0,80 Z`;

  return (
    <svg viewBox="0 0 100 80" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[20, 40, 60].map(y => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#1A1A1A" strokeWidth="0.5" />
      ))}
      {/* Area fill */}
      <path d={areaD} fill="url(#perfGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      {/* End dot */}
      <circle cx="100" cy="10" r="2.5" fill="#F5C542" />
      <circle cx="100" cy="10" r="5" fill="none" stroke="#F5C542" strokeOpacity="0.3" strokeWidth="1" />
      {/* Labels */}
      {['25', '26', '27', '28', '29', '30', '31'].map((d, i) => (
        <text key={d} x={i * 17} y="78" fill="#444" fontSize="5" textAnchor="middle">
          {d} Jul
        </text>
      ))}
    </svg>
  );
}

// ─── Sample Signals ──────────────────────────────────────────────────────────
const SAMPLE_SIGNALS: Signal[] = [
  { id: 1, pair: 'XAUUSD', direction: 'BUY', status: 'STOP LOSS', entry: 4104.74, sl: 4100.74, tp1: 4110.74, tp2: 4125.74, h4trend: 'STRONG_BUY', confidence: 76, time: '31 Jul 2026, 01.10', starred: true },
  { id: 2, pair: 'XAUUSD', direction: 'BUY', status: 'STOP LOSS', entry: 4098.32, sl: 4094.32, tp1: 4104.32, tp2: 4118.32, h4trend: 'BUY', confidence: 72, time: '31 Jul 2026, 00.45', starred: true },
  { id: 3, pair: 'XAUUSD', direction: 'BUY', status: 'OPEN', entry: 4103.21, sl: 4099.21, tp1: 4109.21, tp2: 4123.00, h4trend: 'STRONG_BUY', confidence: 81, time: '31 Jul 2026, 00.59' },
  { id: 4, pair: 'XAUUSD', direction: 'SELL', status: 'TP1', entry: 4115.50, sl: 4120.00, tp1: 4109.00, tp2: 4100.00, h4trend: 'SELL', confidence: 68, time: '30 Jul 2026, 22.30' },
];

// ─── Nav Pages ────────────────────────────────────────────────────────────────
type Page = 'dashboard' | 'journal' | 'studio' | 'signals' | 'backtest' | 'performance' | 'reports' | 'settings';

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterPair, setFilterPair] = useState('All Pairs');
  const [isLive] = useState(true);

  const stats = {
    totalSignals: 192,
    winRate: 42.4,
    wins: 81,
    losses: 81,
    totalPips: 4380,
    avgPips: 23,
    lastSignal: '31 Jul 2026, 01.10',
    closed: 191,
    open: 1,
  };

  const navItems: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <DashboardIcon />, label: 'Dashboard' },
    { id: 'journal', icon: <JournalIcon />, label: 'Journal' },
    { id: 'studio', icon: <StudioIcon />, label: 'Studio' },
    { id: 'signals', icon: <SignalIcon />, label: 'Signals' },
    { id: 'backtest', icon: <BacktestIcon />, label: 'Backtest' },
    { id: 'performance', icon: <PerformanceIcon />, label: 'Performance' },
    { id: 'reports', icon: <ReportsIcon />, label: 'Reports' },
    { id: 'settings', icon: <SettingsIcon />, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-[#0B0B0B] text-white overflow-hidden font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        * { font-family: 'Inter', sans-serif; }

        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmerGold {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(212,175,55,0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        .text-gold-shimmer {
          background: linear-gradient(90deg, #D4AF37, #F5C542, #fff8dc, #F5C542, #D4AF37);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerGold 3s linear infinite;
        }
        .float-anim { animation: floatSlow 4s ease-in-out infinite; }
        .float-anim-2 { animation: floatSlow 5s 1s ease-in-out infinite; }
        .fade-slide-in { animation: fadeSlideIn 0.6s ease forwards; }
        .live-pulse { animation: pulseGold 2s infinite; }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 2px; }

        .glass-card {
          background: rgba(17, 17, 17, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .gold-border-glow {
          border: 1px solid rgba(212,175,55,0.25);
          box-shadow: 0 0 20px rgba(212,175,55,0.05), inset 0 1px 0 rgba(212,175,55,0.1);
        }

        .sidebar-item-active {
          background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05));
          border: 1px solid rgba(212,175,55,0.3);
          box-shadow: inset 0 0 20px rgba(212,175,55,0.05);
        }
      `}</style>

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-40 flex-shrink-0 w-[220px] h-full flex flex-col
        bg-[#0D0D0D] border-r border-[#D4AF37]/10
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-[#D4AF37]/10">
          <div className="relative">
            <div className="absolute inset-0 blur-lg bg-[#D4AF37]/20 rounded-full" />
            <TriangleLogo size={34} />
          </div>
          <div>
            <div className="text-xs font-black tracking-widest text-[#D4AF37] leading-tight">AZZAVISION</div>
            <div className="text-[9px] text-gray-600 tracking-widest">AI</div>
          </div>
        </div>

        {/* Lydia avatar + label */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D4AF37]/8">
          <div className="relative">
            <MascotCrop xPct={0} yPct={2} wPct={33} hPct={40} displayW={40} displayH={40}
              className="rounded-full border border-[#D4AF37]/30" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-[#0D0D0D]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Lydia ✦</div>
            <div className="text-[9px] text-gray-500">AI Assistant</div>
            <div className="text-[9px] text-emerald-400">● Always here!</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left
                ${activePage === item.id
                  ? 'sidebar-item-active text-[#D4AF37]'
                  : 'text-gray-400 hover:text-white hover:bg-white/4'
                }`}
            >
              <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Market Time */}
        <div className="mx-3 mb-3 p-4 rounded-xl bg-[#111] border border-[#D4AF37]/15 gold-border-glow">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon />
            <span className="text-[10px] text-[#D4AF37] font-semibold tracking-widest">MARKET TIME</span>
          </div>
          <LiveClock />
        </div>

        {/* Join Community */}
        <div className="mx-3 mb-4 p-4 rounded-xl bg-[#111] border border-[#D4AF37]/10">
          <div className="text-[10px] text-gray-500 font-semibold tracking-widest mb-3">JOIN COMMUNITY</div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'TG', href: 'https://t.me/azzavisionai_bot', color: '#229ED9' },
              { label: 'YT', href: '#', color: '#FF0000' },
              { label: 'IG', href: '#', color: '#E1306C' },
              { label: 'TK', href: '#', color: '#69C9D0' },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white transition-all hover:scale-110"
                style={{ backgroundColor: s.color + '33', border: `1px solid ${s.color}44` }}>
                {s.label}
              </a>
            ))}
          </div>
          <div className="text-[9px] text-gray-600 mt-2">t.me/azzavisionai</div>
        </div>

        {/* Copyright */}
        <div className="px-5 pb-4">
          <div className="text-[8px] text-gray-700">© 2026 AZZAVISION AI</div>
          <div className="text-[8px] text-gray-700">All Rights Reserved.</div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOP BAR ── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-[#D4AF37]/10 bg-[#0B0B0B]/95 backdrop-blur-md">
          {/* Mobile menu btn */}
          <button className="lg:hidden mr-3 text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>

          {/* Brand */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-gold-shimmer tracking-wide leading-tight">AZZAVISION AI</h1>
            <p className="text-[9px] text-gray-500 tracking-widest">PROFESSIONAL TRADING MONITOR</p>
          </div>

          {/* Center: quote */}
          <div className="hidden xl:block px-5 py-2 rounded-xl border border-[#D4AF37]/15 bg-[#111]/60 max-w-xs">
            <p className="text-xs text-gray-300 italic">"Trade with Discipline, Not Emotion."</p>
            <p className="text-[9px] text-[#D4AF37] mt-0.5 text-right">— Azza</p>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[9px] text-gray-500">Welcome Back,</div>
              <div className="text-sm font-black text-white">Azza 👑</div>
              <div className="text-[8px] text-[#D4AF37]">Focus · Plan · Execute</div>
            </div>

            <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all
              ${isLive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 live-pulse' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-[#D4AF37]/25 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/15 transition-all">
              ↺ REFRESH
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── HERO SECTION ── */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow" style={{ minHeight: 200 }}>
            {/* Background chart */}
            <div className="absolute inset-0 opacity-30">
              <MiniCandleChart />
            </div>
            {/* Gold radial glow */}
            <div className="absolute top-0 right-0 w-96 h-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at right, rgba(212,175,55,0.12) 0%, transparent 70%)' }} />

            <div className="relative z-10 flex items-center justify-between p-6 gap-4">
              {/* Left: quote + stats preview */}
              <div className="flex-1 max-w-sm">
                <div className="inline-block px-3 py-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 mb-4">
                  <p className="text-sm text-white font-semibold italic">"Trade with Discipline,</p>
                  <p className="text-sm text-white font-semibold italic">Not Emotion."</p>
                  <p className="text-[10px] text-[#D4AF37] mt-1">— <span className="font-bold" style={{ fontFamily: 'cursive' }}>Azza</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-gray-400">System running · All signals live</span>
                </div>
              </div>

              {/* Center characters area */}
              <div className="flex items-end gap-2 justify-center">
                {/* Azza - anime boy character placeholder with gold theme */}
                <div className="relative float-anim-2">
                  <div className="w-32 h-44 rounded-2xl overflow-hidden border border-[#D4AF37]/20 bg-gradient-to-b from-[#1A1A0A] to-[#0D0D05] flex flex-col items-center justify-end"
                    style={{ boxShadow: '0 0 30px rgba(212,175,55,0.15)' }}>
                    {/* Azza silhouette: anime boy with laptop */}
                    <svg viewBox="0 0 80 110" className="w-full h-full" style={{ position: 'absolute', inset: 0 }}>
                      {/* Glow bg */}
                      <radialGradient id="azzaGlow" cx="50%" cy="70%" r="50%">
                        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                      </radialGradient>
                      <rect width="80" height="110" fill="url(#azzaGlow)" />
                      {/* Body */}
                      <rect x="22" y="55" width="36" height="40" rx="4" fill="#1A1A1A" />
                      {/* Hoodie logo */}
                      <text x="40" y="80" textAnchor="middle" fill="#D4AF37" fontSize="8" fontWeight="900">▲</text>
                      <text x="40" y="89" textAnchor="middle" fill="#D4AF37" fontSize="5">AZZA</text>
                      {/* Neck */}
                      <rect x="35" y="48" width="10" height="10" fill="#C8956C" />
                      {/* Head */}
                      <ellipse cx="40" cy="38" rx="16" ry="18" fill="#C8956C" />
                      {/* Hair */}
                      <ellipse cx="40" cy="22" rx="16" ry="10" fill="#1A1208" />
                      <rect x="24" y="22" width="32" height="12" rx="2" fill="#1A1208" />
                      {/* Hair strands */}
                      <rect x="24" y="20" width="6" height="18" rx="3" fill="#1A1208" />
                      <rect x="50" y="18" width="8" height="20" rx="3" fill="#1A1208" />
                      {/* Eyes */}
                      <ellipse cx="34" cy="38" rx="3" ry="3.5" fill="#1A1208" />
                      <ellipse cx="46" cy="38" rx="3" ry="3.5" fill="#1A1208" />
                      <circle cx="35" cy="37" r="1" fill="white" opacity="0.8" />
                      <circle cx="47" cy="37" r="1" fill="white" opacity="0.8" />
                      {/* Laptop */}
                      <rect x="15" y="88" width="50" height="20" rx="3" fill="#222" />
                      <rect x="17" y="90" width="46" height="15" rx="2" fill="#0A0A0A" />
                      {/* Screen glow */}
                      <rect x="18" y="91" width="44" height="13" rx="1" fill="#D4AF37" opacity="0.12" />
                      {/* Tiny chart on screen */}
                      <polyline points="20,100 25,98 30,102 35,96 40,99 45,94 50,97 55,92 60,95" fill="none" stroke="#D4AF37" strokeWidth="0.8" opacity="0.7" />
                      {/* Arms */}
                      <rect x="10" y="58" width="14" height="32" rx="5" fill="#1A1A1A" />
                      <rect x="56" y="58" width="14" height="32" rx="5" fill="#1A1A1A" />
                      {/* Hands */}
                      <ellipse cx="17" cy="90" rx="5" ry="4" fill="#C8956C" />
                      <ellipse cx="63" cy="90" rx="5" ry="4" fill="#C8956C" />
                    </svg>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/30">
                      <span className="text-[8px] text-[#D4AF37] font-bold">AZZA</span>
                    </div>
                  </div>
                </div>

                {/* Lydia - mascot */}
                <div className="relative float-anim">
                  <div className="relative">
                    <div className="absolute inset-0 blur-xl bg-[#D4AF37]/10 rounded-full scale-110 pointer-events-none" />
                    <MascotCrop xPct={0} yPct={2} wPct={33} hPct={72} displayW={130} displayH={165}
                      className="relative drop-shadow-lg" />
                  </div>
                  <div className="absolute bottom-4 right-0 px-2 py-1 rounded-lg bg-[#111]/90 border border-[#D4AF37]/25 text-center">
                    <div className="text-[8px] text-[#D4AF37] font-bold">LYDIA ✦</div>
                    <div className="text-[7px] text-gray-500">AI Assistant</div>
                    <div className="flex items-center gap-1 justify-center">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[7px] text-emerald-400">Always here!</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: welcome card */}
              <div className="hidden lg:flex flex-col items-end gap-2">
                <div className="px-4 py-3 rounded-xl bg-[#111]/80 border border-[#D4AF37]/20 text-right">
                  <div className="text-[9px] text-gray-500 mb-1">Welcome Back,</div>
                  <div className="text-lg font-black text-white">Azza 👑</div>
                  <div className="text-[9px] text-[#D4AF37]">Focus · Plan · Execute</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={<GridIcon />}
              label="Total Signals"
              value={stats.totalSignals.toString()}
              sub={`${stats.open} open`}
            />
            <StatCard
              icon={<TargetIcon />}
              label="Win Rate"
              value={`${stats.winRate}%`}
              sub={`${stats.wins}W / ${stats.losses}L`}
              valueColor="text-red-400"
            />
            <StatCard
              icon={<TrendIcon />}
              label="Total Pips"
              value={`+${stats.totalPips.toLocaleString()}`}
              sub={`avg +${stats.avgPips}/trade`}
              valueColor="text-emerald-400"
            />
            <StatCard
              icon={<ClockIcon />}
              label="Last Signal"
              value="31 Jul 2026"
              sub={`${stats.closed} closed · 01.10`}
            />
          </div>

          {/* ── SIGNAL STREAM + SERVER ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

            {/* Signal Stream */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/10">
                <div className="flex items-center gap-3">
                  <span className="text-[#D4AF37]">⚡</span>
                  <span className="text-sm font-black tracking-widest text-white">SIGNAL STREAM</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={filterPair}
                    onChange={e => setFilterPair(e.target.value)}
                    className="text-xs bg-[#111] border border-[#D4AF37]/20 text-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-[#D4AF37]/50"
                  >
                    <option>All Pairs</option>
                    <option>XAUUSD</option>
                    <option>EURUSD</option>
                    <option>GBPUSD</option>
                  </select>
                  <button className="text-gray-500 hover:text-[#D4AF37] transition-colors p-1.5 rounded-lg border border-white/5 hover:border-[#D4AF37]/20">
                    <FilterIcon />
                  </button>
                </div>
              </div>

              {/* Signals */}
              <div className="p-4 space-y-3">
                {SAMPLE_SIGNALS.map(signal => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </div>

            {/* Right panel: Server Resources + Signal Checklist */}
            <div className="space-y-4">

              {/* Server Resources */}
              <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-gray-500 font-semibold tracking-widest">SERVER RESOURCES</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    RUNNING
                  </span>
                </div>
                {[
                  { label: 'CPU', value: '0.0%', bar: 1 },
                  { label: 'MEMORY', value: '55 MB', bar: 35 },
                  { label: 'DISK', value: '—', bar: 0 },
                  { label: 'UPTIME', value: '6m', bar: null },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                    <span className="text-xs text-gray-500 font-medium w-20">{r.label}</span>
                    {r.bar !== null ? (
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${r.bar}%`, minWidth: r.bar > 0 ? 3 : 0 }} />
                        </div>
                        <span className="text-xs text-white font-semibold w-12 text-right">{r.value}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white font-semibold">{r.value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Signal Checklist */}
              <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-gray-500 font-semibold tracking-widest">SIGNAL CHECKLIST</span>
                  <MascotCrop xPct={70} yPct={2} wPct={18} hPct={32} displayW={32} displayH={32}
                    className="rounded-full border border-[#D4AF37]/25" />
                </div>
                {[
                  { label: 'H4 Trend', badge: 'STRONG_BUY', ok: true },
                  { label: 'H1 Trend', badge: 'STRONG_BUY', ok: true },
                  { label: 'Confidence', badge: '76%', ok: false },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${item.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.ok ? '✓' : '✕'}
                      </span>
                      <span className="text-xs text-gray-300">{item.label}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20">
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>

              {/* Lydia assistant panel */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1A1400] to-[#0D0D0D] border border-[#D4AF37]/20 p-4 flex items-center gap-3">
                <MascotCrop xPct={0} yPct={2} wPct={33} hPct={40} displayW={50} displayH={55}
                  className="rounded-xl flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-[#D4AF37] font-bold mb-1">LYDIA says:</div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Market sedang dalam mode <span className="text-[#D4AF37] font-semibold">STRONG_BUY</span>. Perhatikan level 4100 sebagai support kunci.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* ── PERFORMANCE SECTION ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Performance Chart */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-gray-500 font-semibold tracking-widest">PERFORMANCE CHART</span>
                <span className="text-xs text-emerald-400 font-bold">+4,380 pips</span>
              </div>
              {/* Y-axis labels */}
              <div className="flex gap-2">
                <div className="flex flex-col justify-between text-[8px] text-gray-600 py-1 flex-shrink-0">
                  <span>10k</span>
                  <span>5k</span>
                  <span>0</span>
                  <span>-5k</span>
                </div>
                <div className="flex-1 h-28">
                  <PerfChart />
                </div>
              </div>
            </div>

            {/* Trade Distribution */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow p-5">
              <div className="text-[10px] text-gray-500 font-semibold tracking-widest mb-4">TRADE DISTRIBUTION</div>
              <div className="flex items-center gap-4">
                <DonutChart win={81} loss={81} breakeven={30} />
                <div className="space-y-2.5">
                  {[
                    { label: 'Win', value: '81 (42.2%)', color: '#22c55e' },
                    { label: 'Loss', value: '81 (42.2%)', color: '#ef4444' },
                    { label: 'Breakeven', value: '30 (15.6%)', color: '#eab308' },
                  ].map(d => (
                    <div key={d.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div>
                        <div className="text-[9px] text-gray-500">{d.label}</div>
                        <div className="text-[10px] text-white font-semibold">{d.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Best Performing */}
            <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/15 gold-border-glow p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#D4AF37]">🏆</span>
                <span className="text-[10px] text-gray-500 font-semibold tracking-widest">BEST PERFORMING</span>
              </div>
              <div className="space-y-3">
                {[
                  { rank: 1, pair: 'XAUUSD', pips: '+2,850' },
                  { rank: 2, pair: 'EURUSD', pips: '+720' },
                  { rank: 3, pair: 'GBPUSD', pips: '+510' },
                ].map(p => (
                  <div key={p.rank} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black
                        ${p.rank === 1 ? 'bg-[#D4AF37] text-black' : p.rank === 2 ? 'bg-gray-600 text-white' : 'bg-orange-800/60 text-orange-300'}`}>
                        {p.rank}
                      </span>
                      <span className="text-sm font-bold text-white">{p.pair}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">{p.pips} pips</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── FOOTER BAR ── */}
          <div className="rounded-2xl bg-gradient-to-r from-[#0D0D0D] via-[#111100] to-[#0D0D0D] border border-[#D4AF37]/20 gold-border-glow overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-5 gap-4">

              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 blur-lg bg-[#D4AF37]/20 rounded-full" />
                  <TriangleLogo size={40} />
                </div>
                <div>
                  <div className="text-sm font-black text-[#D4AF37] tracking-widest">AZZAVISION AI</div>
                  <div className="text-[8px] text-gray-600 tracking-widest">PROFESSIONAL TRADING MONITOR</div>
                </div>
              </div>

              {/* Slogan */}
              <div className="text-center">
                <p className="text-base font-black text-white">Discipline Over Emotion.</p>
                <p className="text-sm text-gray-400 font-medium">Consistent Today. <span className="text-[#D4AF37]">Freedom Tomorrow.</span></p>
              </div>

              {/* Azza signature + Lydia */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl text-[#D4AF37]" style={{ fontFamily: 'cursive', fontWeight: 900 }}>Azza</div>
                  <div className="text-[9px] text-gray-600">Founder & Trader</div>
                </div>
                <div className="relative float-anim">
                  <MascotCrop xPct={0} yPct={2} wPct={33} hPct={60} displayW={60} displayH={70}
                    className="rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}

// ─── Icon Components ──────────────────────────────────────────────────────────
function DashboardIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="1" y="1" width="6" height="6" rx="1" />
    <rect x="9" y="1" width="6" height="6" rx="1" />
    <rect x="1" y="9" width="6" height="6" rx="1" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>;
}
function JournalIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="2" y="1" width="10" height="14" rx="1.5" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
}
function StudioIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <circle cx="8" cy="8" r="6" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="6,5.5 12,8 6,10.5" />
  </svg>;
}
function SignalIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M1 12 L4 8 L7 10 L10 5 L13 7 L15 4" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="15" cy="4" r="1.5" />
  </svg>;
}
function BacktestIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M3 8 A5 5 0 1 1 8 13" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="3,5 3,8 6,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>;
}
function PerformanceIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <polyline points="1,12 5,7 8,9 11,4 15,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="11,4 15,4 15,8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function ReportsIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="2" y="1" width="12" height="14" rx="1.5" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" />
    <rect x="5" y="9" width="2" height="4" rx="0.5" />
    <rect x="8" y="7" width="2" height="6" rx="0.5" />
    <rect x="11" y="5" width="2" height="8" rx="0.5" />
  </svg>;
}
function SettingsIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <circle cx="8" cy="8" r="2.5" fillOpacity="0" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 1 L8 3 M8 13 L8 15 M1 8 L3 8 M13 8 L15 8 M3.22 3.22 L4.64 4.64 M11.36 11.36 L12.78 12.78 M12.78 3.22 L11.36 4.64 M4.64 11.36 L3.22 12.78"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>;
}
function ClockIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5">
    <circle cx="8" cy="8" r="6.5" />
    <polyline points="8,4 8,8 10.5,10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function GridIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
    <rect x="1" y="1" width="6" height="6" rx="0.8" /><rect x="9" y="1" width="6" height="6" rx="0.8" />
    <rect x="1" y="9" width="6" height="6" rx="0.8" /><rect x="9" y="9" width="6" height="6" rx="0.8" />
  </svg>;
}
function TargetIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5">
    <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="3.5" /><circle cx="8" cy="8" r="1" fill="currentColor" />
  </svg>;
}
function TrendIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,12 5,7 8,9 11,4 15,4" />
    <polyline points="11,4 15,4 15,8" />
  </svg>;
}
function FilterIcon() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5" strokeLinecap="round">
    <polyline points="1,3 13,3 8.5,8.5 8.5,13 5.5,11 5.5,8.5" />
  </svg>;
}
