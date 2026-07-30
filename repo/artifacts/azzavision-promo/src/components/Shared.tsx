// ─── Shared UI components for AZZAVISION AI ──────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Signal } from "../types";

// ─── Logo ────────────────────────────────────────────────────────────────────
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 36" width={size} height={size}>
      <polygon points="20,2 38,34 2,34" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2.2" fill="#D4AF37" />
    </svg>
  );
}

// ─── Live clock ──────────────────────────────────────────────────────────────
export function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const date = t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return (
    <>
      <div className="text-[10px] text-gray-500 mb-0.5">{date}</div>
      <div className="text-[22px] font-black text-[#D4AF37] tracking-wider leading-none">{time}</div>
      <div className="text-[9px] text-gray-600 mt-1">(WIB)</div>
    </>
  );
}

// ─── Azza character ──────────────────────────────────────────────────────────
export function AzzaChar({ w = 120, h = 170 }: { w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, position: "relative", flexShrink: 0 }}>
      <img
        src={`${import.meta.env.BASE_URL}azza-char.png`}
        alt="Azza — Founder & Trader"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "bottom" }}
      />
    </div>
  );
}

// ─── Lydia avatar (small circle) ─────────────────────────────────────────────
export function LydiaAvatar({ size = 30 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}lydia-char.png`}
      alt="Lydia"
      draggable={false}
      style={{
        width: size, height: size,
        objectFit: "cover", objectPosition: "top center",
        borderRadius: "50%",
        border: "1px solid rgba(212,175,55,0.25)",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Decorative candle background ────────────────────────────────────────────
export function CandleBg() {
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
          <line x1={c.x} y1={c.h} x2={c.x} y2={c.l} stroke={c.bull ? "#D4AF37" : "#ef4444"} strokeWidth="0.7" />
          <rect x={c.x - 3.5} y={Math.min(c.o, c.c)} width={7}
            height={Math.max(Math.abs(c.o - c.c), 1.5)}
            fill={c.bull ? "#D4AF37" : "#ef4444"} rx="0.4" />
        </g>
      ))}
      <polyline points="8,68 20,62 32,52 44,56 56,43 68,38 80,28 92,20"
        fill="none" stroke="#F5C542" strokeWidth="1.2" strokeDasharray="4,3" opacity={0.22} />
    </svg>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color = "text-white" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="relative group flex flex-col gap-2 p-5 rounded-2xl bg-[#111] border border-[#D4AF37]/18 hover:border-[#D4AF37]/45 transition-all duration-300 overflow-hidden"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: "radial-gradient(ellipse at 20% 20%, rgba(212,175,55,0.06) 0%, transparent 70%)" }} />
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

// ─── Signal card ─────────────────────────────────────────────────────────────
export function SignalCard({ s, onExpand }: { s: Signal; onExpand?: (id: number) => void }) {
  const buy = s.direction === "BUY";
  const [hovered, setHovered] = useState(false);
  const statusStyle: Record<string, string> = {
    OPEN:          "text-emerald-400 bg-emerald-500/15 border-emerald-500/35",
    "STOP LOSS":   "text-red-400     bg-red-500/15     border-red-500/35",
    TP1:           "text-[#D4AF37]   bg-[#D4AF37]/15   border-[#D4AF37]/35",
    TP2:           "text-[#F5C542]   bg-[#F5C542]/15   border-[#F5C542]/35",
  };
  return (
    <div
      className="signal-card group relative rounded-2xl bg-[#0F0F0F] border border-[#D4AF37]/12 hover:border-[#D4AF37]/45 transition-all duration-300 p-5 overflow-hidden cursor-pointer"
      style={{
        boxShadow: hovered
          ? "0 0 28px rgba(212,175,55,0.30), 0 4px 20px rgba(0,0,0,0.6)"
          : "0 2px 16px rgba(0,0,0,0.5)",
        transition: "box-shadow 0.35s ease, border-color 0.3s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onExpand?.(s.id)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(212,175,55,0.05) 0%, transparent 55%)" }} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#D4AF37]/60 via-[#F5C542]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {s.starred && <span className="text-[#D4AF37] text-xs">★</span>}
          <span className="text-white font-black text-[19px] tracking-wider">{s.pair}</span>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${buy ? "text-emerald-400 bg-emerald-500/15" : "text-red-400 bg-red-500/15"}`}>
            {s.direction}
          </span>
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md border ${statusStyle[s.status] ?? ""}`}>
            {s.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">{s.time}</span>
          <span className="text-gray-600 hover:text-[#D4AF37] text-sm transition-colors">›</span>
        </div>
      </div>

      {/* data grid */}
      <div className="grid grid-cols-6 gap-x-3 gap-y-0 mb-4">
        {[
          { l: "ENTRY",      v: s.entry.toFixed(2), c: "text-blue-400"    },
          { l: "SL",         v: s.sl.toFixed(2),    c: "text-red-400"     },
          { l: "TP1",        v: s.tp1.toFixed(2),   c: "text-emerald-400" },
          { l: "TP2",        v: s.tp2.toFixed(2),   c: "text-emerald-300" },
          { l: "H4 TREND",   v: s.h4trend,          c: "text-[#D4AF37]"   },
          { l: "CONFIDENCE", v: `${s.confidence}%`, c: "text-white"       },
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
            background: "linear-gradient(90deg, #D4AF37, #F5C542)",
            boxShadow: "0 0 8px rgba(212,175,55,0.55)",
            transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
          }} />
      </div>
      <div className="flex justify-end mt-1.5">
        <span className="text-[9px] text-gray-600">{s.confidence}%</span>
      </div>
    </div>
  );
}

// ─── Gold Recharts tooltip ────────────────────────────────────────────────────
export function GoldTooltip({
  active, payload, label,
}: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs bg-[#111] border border-[#D4AF37]/30"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
      <div className="text-gray-400 mb-0.5">{label}</div>
      <div className="text-[#D4AF37] font-black">
        {payload[0].value >= 0 ? "+" : ""}{payload[0].value.toLocaleString()} pips
      </div>
    </div>
  );
}

// ─── Skeleton loading card ────────────────────────────────────────────────────
export function SkeletonCard({ h = 80 }: { h?: number }) {
  return (
    <div className="rounded-2xl bg-[#111] border border-[#D4AF37]/8 overflow-hidden relative"
      style={{ height: h }}>
      <div className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg,transparent 0%,rgba(212,175,55,0.06) 50%,transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "goldShimmer 1.8s linear infinite",
        }} />
    </div>
  );
}

// ─── Reconnecting error state ─────────────────────────────────────────────────
export function ReconnectingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#D4AF37]/30 border-t-[#D4AF37] animate-spin" />
      <p className="text-[13px] text-gray-400 font-medium">Reconnecting to server...</p>
      <p className="text-[10px] text-gray-600">Backend will resume shortly</p>
    </div>
  );
}

// ─── Small performance area chart ────────────────────────────────────────────
export function MiniPerfChart({ data }: { data: { date: string; pips: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
        <defs>
          <linearGradient id="gold-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#444" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 8, fill: "#444" }} tickLine={false} axisLine={false} />
        <Tooltip content={<GoldTooltip />} />
        <Area type="monotone" dataKey="pips" stroke="#D4AF37" strokeWidth={2}
          fill="url(#gold-area)" dot={false}
          activeDot={{ r: 4, fill: "#F5C542", stroke: "#D4AF37", strokeWidth: 1 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({ icon, title, right }: {
  icon?: React.ReactNode; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/10">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-[#D4AF37]">{icon}</span>}
        <span className="text-[12px] font-black tracking-[0.18em]">{title}</span>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────
export function FilterSelect({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[11px] bg-[#111] border border-[#D4AF37]/20 text-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-[#D4AF37]/50 cursor-pointer"
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export function PageWrap({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 overflow-hidden ${className}`}
      style={{ boxShadow: "0 0 18px rgba(212,175,55,0.04), inset 0 1px 0 rgba(212,175,55,0.08)" }}>
      {children}
    </div>
  );
}

// ─── Daily Music Player ───────────────────────────────────────────────────────
const PLAYLIST = [
  { title: "Focus Flow",    artist: "Trading Vibes", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "Gold Rush",     artist: "Market Beats",  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { title: "Discipline",    artist: "Azza Sessions", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { title: "Chart Breaker", artist: "Studio AI",     src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
];

export function MusicPlayer() {
  const [idx,      setIdx]      = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);   // 0–1
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = PLAYLIST[idx];

  // Load new track when idx changes
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    a.src = track.src;
    a.load();
    setProgress(0);

    const onTime  = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onMeta  = () => setDuration(a.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };

    a.addEventListener("timeupdate",      onTime);
    a.addEventListener("loadedmetadata",  onMeta);
    a.addEventListener("ended",           onEnded);

    if (playing) a.play().catch(() => setPlaying(false));

    return () => {
      a.removeEventListener("timeupdate",     onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended",          onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Toggle play/pause
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else         a.pause();
  }, [playing]);

  // Cleanup
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const prev = () => setIdx(i => (i - 1 + PLAYLIST.length) % PLAYLIST.length);
  const next = () => setIdx(i => (i + 1) % PLAYLIST.length);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setProgress(ratio);
  }

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="mx-3 mb-2 flex-shrink-0 rounded-xl p-3.5" style={{
      background: "linear-gradient(135deg,#0D0919,#0D0D0D,#110D00)",
      border: "1px solid rgba(124,58,237,0.30)",
      boxShadow: "0 0 22px rgba(124,58,237,0.12), 0 0 32px rgba(212,175,55,0.05)",
    }}>
      {/* title bar */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[10px]">🎵</span>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-[#D4AF37]">DAILY MUSIC</span>
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
      </div>

      {/* song info */}
      <div className="text-center mb-2.5 min-w-0">
        <div className="text-[12px] font-bold text-white truncate leading-snug">{track.title}</div>
        <div className="text-[9px] text-purple-300 truncate">{track.artist}</div>
      </div>

      {/* progress bar */}
      <div className="mb-2">
        <div className="h-[3px] bg-[#1A1A1A] rounded-full overflow-hidden cursor-pointer" onClick={seek}>
          <div className="h-full rounded-full" style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg,#7C3AED,#D4AF37)",
            boxShadow: "0 0 6px rgba(124,58,237,0.5)",
            transition: "width 0.25s linear",
          }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-gray-600">{fmt(progress * duration)}</span>
          <span className="text-[8px] text-gray-600">{fmt(duration)}</span>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prev}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/8 transition-all">
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M2 2h1.5v10H2V2zm9.5 1.5L5.5 7l6 3.5V3.5z" />
          </svg>
        </button>

        <button onClick={() => setPlaying(p => !p)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-black transition-all"
          style={{
            background: playing
              ? "linear-gradient(135deg,#7C3AED,#D4AF37)"
              : "linear-gradient(135deg,#D4AF37,#F5C542)",
            boxShadow: playing
              ? "0 0 18px rgba(124,58,237,0.5)"
              : "0 0 12px rgba(212,175,55,0.4)",
          }}>
          {playing ? (
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
              <rect x="2" y="2" width="3.5" height="10" rx="0.5" />
              <rect x="8.5" y="2" width="3.5" height="10" rx="0.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 ml-0.5">
              <path d="M3 2l9 5-9 5V2z" />
            </svg>
          )}
        </button>

        <button onClick={next}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/8 transition-all">
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M10.5 2H12v10h-1.5V2zM2 3.5L8 7l-6 3.5V3.5z" />
          </svg>
        </button>
      </div>

      {/* dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {PLAYLIST.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 14 : 5,
              height: 5,
              background: i === idx
                ? "linear-gradient(90deg,#7C3AED,#D4AF37)"
                : "#2A2A2A",
            }} />
        ))}
      </div>
    </div>
  );
}
