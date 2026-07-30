import { useEffect, useRef, useState } from 'react';

// ─── Mascot Crop Helper ─────────────────────────────────────────────────────
// The sprite sheet is a single PNG. We crop different poses with CSS.
function MascotCrop({
  xPct, yPct, wPct, hPct,
  displayW, displayH,
  className = '',
  style = {},
}: {
  xPct: number; yPct: number; wPct: number; hPct: number;
  displayW: number; displayH: number;
  className?: string; style?: React.CSSProperties;
}) {
  const scaleX = 100 / wPct;
  const scaleY = 100 / hPct;
  return (
    <div
      className={className}
      style={{
        width: displayW,
        height: displayH,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}mascot.png`}
        alt="AZZAVISION AI mascot"
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

// ─── Floating Particle ──────────────────────────────────────────────────────
function Particle({ delay, duration, x, size, opacity }: {
  delay: number; duration: number; x: number; size: number; opacity: number;
}) {
  return (
    <div
      className="absolute rounded-full bg-[#C9A227] pointer-events-none"
      style={{
        width: size, height: size,
        left: `${x}%`,
        bottom: '-20px',
        opacity,
        animation: `floatUp ${duration}s ${delay}s infinite linear`,
      }}
    />
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl border border-[#C9A227]/20 bg-[#0A0A0A]/80 backdrop-blur">
      <span className="text-2xl">{icon}</span>
      <span className="text-3xl font-extrabold text-[#C9A227]">{value}</span>
      <span className="text-xs text-gray-400 text-center">{label}</span>
    </div>
  );
}

// ─── Feature Card ───────────────────────────────────────────────────────────
function FeatureCard({
  mascotX, mascotY, mascotW, mascotH,
  title, desc, accent,
}: {
  mascotX: number; mascotY: number; mascotW: number; mascotH: number;
  title: string; desc: string; accent: string;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-4 p-6 rounded-2xl border border-[#C9A227]/15 bg-gradient-to-b from-[#111] to-[#0A0A0A] hover:border-[#C9A227]/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(201,162,39,0.15)]">
      {/* Gold accent top bar */}
      <div className={`absolute top-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Mascot pose */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[#C9A227]/10 blur-xl scale-150" />
        <MascotCrop
          xPct={mascotX} yPct={mascotY} wPct={mascotW} hPct={mascotH}
          displayW={120} displayH={120}
          className="relative rounded-xl"
        />
      </div>

      <h3 className="text-lg font-bold text-white text-center">{title}</h3>
      <p className="text-sm text-gray-400 text-center leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const particles = [
    { delay: 0,   duration: 8,  x: 10, size: 3,  opacity: 0.4 },
    { delay: 2,   duration: 12, x: 25, size: 2,  opacity: 0.3 },
    { delay: 1,   duration: 10, x: 40, size: 4,  opacity: 0.25 },
    { delay: 3,   duration: 9,  x: 55, size: 2,  opacity: 0.35 },
    { delay: 0.5, duration: 11, x: 70, size: 3,  opacity: 0.3 },
    { delay: 1.5, duration: 7,  x: 85, size: 2,  opacity: 0.4 },
    { delay: 4,   duration: 13, x: 92, size: 4,  opacity: 0.2 },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: var(--op, 0.4); }
          80%  { opacity: var(--op, 0.4); }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-18px) rotate(1deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .text-shimmer {
          background: linear-gradient(90deg, #C9A227, #FFE066, #C9A227, #FFE066, #C9A227);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .hero-mascot {
          animation: float 5s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(201,162,39,0.3));
        }
        .fade-in-up { animation: fadeInUp 0.8s ease forwards; }
        .slide-in-right { animation: slideInRight 0.8s ease forwards; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-[#050505]/80 border-b border-[#C9A227]/10">
        <div className="flex items-center gap-3">
          {/* Triangle logo */}
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg viewBox="0 0 40 36" className="w-9 h-9">
              <polygon points="20,2 38,34 2,34" fill="none" stroke="#C9A227" strokeWidth="2.5" />
              <polygon points="20,10 30,28 10,28" fill="#C9A227" opacity="0.3" />
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-widest text-[#C9A227]">AZZAVISION</span>
          <span className="text-xs text-gray-500 font-light tracking-widest mt-0.5">AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          {['Fitur', 'Performa', 'Harga', 'FAQ'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-[#C9A227] transition-colors">{item}</a>
          ))}
        </div>
        <a
          href="https://t.me/azzavisionai_bot"
          target="_blank"
          rel="noreferrer"
          className="px-5 py-2 rounded-full text-sm font-semibold bg-[#C9A227] text-black hover:bg-[#FFE066] transition-all hover:scale-105 shadow-[0_0_20px_rgba(201,162,39,0.4)]"
        >
          Coba Gratis →
        </a>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-24 px-6 overflow-hidden">
        {/* BG grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#C9A227 1px, transparent 1px), linear-gradient(90deg, #C9A227 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,162,39,0.08) 0%, transparent 70%)' }} />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((p, i) => <Particle key={i} {...p} />)}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text side */}
          <div className="fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/5 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />
              <span className="text-xs text-[#C9A227] font-medium tracking-widest">AI GOLD TRADING ASSISTANT</span>
            </div>

            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.1] mb-6">
              <span className="block text-white">Sinyal Emas</span>
              <span className="text-shimmer block">Akurat & Cepat</span>
              <span className="block text-white text-4xl md:text-5xl font-bold mt-2">dengan AI</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
              AZZAVISION AI menganalisis pasar XAUUSD secara real-time menggunakan kecerdasan buatan. 
              Dapatkan sinyal trading presisi tinggi langsung di Telegram-mu.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="https://t.me/azzavisionai_bot"
                target="_blank"
                rel="noreferrer"
                className="relative flex items-center gap-3 px-8 py-4 rounded-full bg-[#C9A227] text-black font-bold text-base hover:bg-[#FFE066] transition-all hover:scale-105 shadow-[0_0_30px_rgba(201,162,39,0.5)] group"
              >
                <span>🚀 Mulai Sekarang</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="#fitur"
                className="flex items-center gap-2 px-8 py-4 rounded-full border border-[#C9A227]/30 text-[#C9A227] font-semibold hover:bg-[#C9A227]/10 transition-all"
              >
                Lihat Fitur
              </a>
            </div>

            {/* Mini stats */}
            <div className="flex flex-wrap gap-6 mt-10 pt-8 border-t border-white/5">
              {[
                { v: '10K+', l: 'Trader Aktif' },
                { v: '94%', l: 'Akurasi Sinyal' },
                { v: '24/7', l: 'Monitoring' },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-2xl font-extrabold text-[#C9A227]">{s.v}</div>
                  <div className="text-xs text-gray-500">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mascot side — big waving character */}
          <div className="flex justify-center lg:justify-end slide-in-right" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              {/* Pulse rings */}
              {[0, 0.4, 0.8].map((d, i) => (
                <div key={i} className="absolute inset-0 rounded-full border border-[#C9A227]/20"
                  style={{ animation: `pulse-ring 3s ${d}s infinite ease-out` }} />
              ))}
              {/* Mascot: big waving character at left of sprite sheet */}
              <MascotCrop
                xPct={0} yPct={2} wPct={33} hPct={72}
                displayW={340} displayH={480}
                className="hero-mascot"
              />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-xs text-gray-500 tracking-widest">SCROLL</span>
          <div className="w-px h-12 bg-gradient-to-b from-[#C9A227] to-transparent animate-pulse" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="py-12 border-y border-[#C9A227]/10 bg-gradient-to-r from-[#0A0A0A] via-[#0D0D0D] to-[#0A0A0A]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="XAUUSD" label="Pair Spesialisasi" icon="🥇" />
          <StatCard value="< 3s" label="Latensi Analisis" icon="⚡" />
          <StatCard value="50+" label="Parameter AI" icon="🧠" />
          <StatCard value="3 Sesi" label="Market London · NY · Asia" icon="🌐" />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fitur" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs text-[#C9A227] tracking-[0.3em] font-semibold">KEMAMPUAN</span>
            <h2 className="text-4xl md:text-5xl font-extrabold mt-3">
              Azza <span className="text-shimmer">Bisa Apa Saja</span>
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              Lebih dari sekadar sinyal — Azza adalah asisten trading lengkap yang memahami pasar emas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pose: analyzing / magnifying glass — mid-left area */}
            <FeatureCard
              mascotX={28} mascotY={38} mascotW={18} mascotH={32}
              title="Analisis Pasar Real-time"
              desc="Membaca sentimen pasar, level support/resistance, dan momentum dalam hitungan detik."
              accent="from-[#C9A227] to-transparent"
            />
            {/* Pose: lightbulb idea — mid center */}
            <FeatureCard
              mascotX={48} mascotY={38} mascotW={18} mascotH={32}
              title="Sinyal Entry & Exit Presisi"
              desc="Rekomendasi harga masuk, stop loss, dan take profit berdasarkan analisis multi-timeframe."
              accent="from-transparent via-[#C9A227] to-transparent"
            />
            {/* Pose: laptop typing — upper right area */}
            <FeatureCard
              mascotX={55} mascotY={38} mascotW={20} mascotH={32}
              title="Laporan Performa Harian"
              desc="Ringkasan win rate, profit/loss, dan statistik trading langsung di Telegram."
              accent="from-transparent to-[#C9A227]"
            />
            {/* Pose: growth chart — far right mid */}
            <FeatureCard
              mascotX={76} mascotY={38} mascotW={18} mascotH={32}
              title="Tracking Pertumbuhan"
              desc="Grafik performa akun, drawdown analisis, dan saran manajemen risiko otomatis."
              accent="from-[#C9A227] to-transparent"
            />
            {/* Pose: thinking — upper row */}
            <FeatureCard
              mascotX={44} mascotY={2} mascotW={18} mascotH={32}
              title="Konfirmasi Setup Trading"
              desc="AI mengevaluasi apakah kondisi pasar mendukung setup yang kamu rencakan."
              accent="from-transparent via-[#C9A227] to-transparent"
            />
            {/* Pose: happy/excited — upper right */}
            <FeatureCard
              mascotX={70} mascotY={2} mascotW={18} mascotH={32}
              title="Notifikasi Instan"
              desc="Alert langsung saat ada peluang masuk dengan risk/reward terbaik di pasar emas."
              accent="from-transparent to-[#C9A227]"
            />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#050505] to-[#0A0800]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Mascot cluster */}
          <div className="relative flex justify-center">
            <div className="relative">
              {/* Glow circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(201,162,39,0.15) 0%, transparent 70%)' }} />

              {/* Main: laptop pose */}
              <MascotCrop
                xPct={28} yPct={2} wPct={20} hPct={34}
                displayW={220} displayH={220}
                style={{ animation: 'float 5s ease-in-out infinite' }}
              />

              {/* Floating mini: growth chart */}
              <div className="absolute -bottom-4 -right-4"
                style={{ animation: 'float 4s 1s ease-in-out infinite' }}>
                <MascotCrop
                  xPct={76} yPct={38} wPct={18} hPct={32}
                  displayW={110} displayH={110}
                  className="rounded-xl border border-[#C9A227]/20"
                />
              </div>

              {/* Badge */}
              <div className="absolute -top-2 -left-6 px-3 py-1.5 rounded-full bg-[#C9A227] text-black text-xs font-bold shadow-lg"
                style={{ animation: 'float 6s 0.5s ease-in-out infinite' }}>
                ✨ AI Trading
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <span className="text-xs text-[#C9A227] tracking-[0.3em] font-semibold">CARA KERJA</span>
            <h2 className="text-4xl font-extrabold mt-3 mb-10">
              3 Langkah <span className="text-shimmer">Mudah</span>
            </h2>
            {[
              { n: '01', t: 'Start Bot Telegram', d: 'Ketuk /start di @azzavisionai_bot. Setup selesai dalam 30 detik.' },
              { n: '02', t: 'Pilih Mode Trading', d: 'Conservative, Moderate, atau Aggressive — AI menyesuaikan parameter sesuai profil risikomu.' },
              { n: '03', t: 'Terima & Eksekusi Sinyal', d: 'Azza kirim sinyal lengkap: entry, SL, TP1/TP2/TP3 beserta probabilitas sukses.' },
            ].map(step => (
              <div key={step.n} className="flex gap-6 mb-8 group">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl border border-[#C9A227]/30 bg-[#C9A227]/5 flex items-center justify-center text-[#C9A227] font-black text-lg group-hover:bg-[#C9A227]/15 transition-colors">
                  {step.n}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">{step.t}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="performa" className="py-24 px-6 border-t border-[#C9A227]/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs text-[#C9A227] tracking-[0.3em] font-semibold">TRADER BILANG</span>
            <h2 className="text-4xl font-extrabold mt-3">
              Hasil <span className="text-shimmer">Nyata</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Reza A.', role: 'Full-time Trader', text: 'Win rate naik dari 58% ke 91% setelah pakai Azza. Sinyal nya akurat banget, TP hampir selalu kesentuh.', stars: 5 },
              { name: 'Siti M.', role: 'Trader Pemula', text: 'Buat yang baru belajar, Azza ngebantu banget. Bisa tanya-tanya strategi dan dia jelasin dengan sabar.', stars: 5 },
              { name: 'Doni K.', role: 'Scalper XAUUSD', text: 'Alert-nya cepet banget. Masih hottest signal yang pernah aku pakai. Nggak pernah ketinggalan momentum lagi.', stars: 5 },
            ].map(t => (
              <div key={t.name} className="p-6 rounded-2xl border border-[#C9A227]/15 bg-[#0A0A0A] hover:border-[#C9A227]/40 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array(t.stars).fill(0).map((_, i) => (
                    <span key={i} className="text-[#C9A227] text-sm">★</span>
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  {/* Avatar from mascot icon strip */}
                  <MascotCrop
                    xPct={0} yPct={80} wPct={17} hPct={20}
                    displayW={36} displayH={36}
                    style={{ borderRadius: '50%', border: '1px solid rgba(201,162,39,0.3)' }}
                  />
                  <div>
                    <div className="text-white font-semibold text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="harga" className="py-24 px-6 bg-gradient-to-b from-[#0A0800] to-[#050505]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs text-[#C9A227] tracking-[0.3em] font-semibold">PAKET</span>
            <h2 className="text-4xl font-extrabold mt-3">
              Pilih <span className="text-shimmer">Paket Mu</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Starter', price: 'Gratis', period: 'selamanya', features: ['5 sinyal/hari', 'Analisis dasar', 'Notifikasi Telegram', 'Support komunitas'], cta: 'Mulai Gratis', popular: false },
              { name: 'Pro', price: 'Rp 299K', period: '/bulan', features: ['Sinyal unlimited', 'AI multi-timeframe', 'Laporan harian PDF', 'Backtest 90 hari', 'Support prioritas'], cta: 'Ambil Pro', popular: true },
              { name: 'Elite', price: 'Rp 599K', period: '/bulan', features: ['Semua fitur Pro', 'Sinyal eksklusif VIP', 'Konsultasi 1-on-1', 'Custom alert setup', 'Early access fitur baru'], cta: 'Bergabung Elite', popular: false },
            ].map(p => (
              <div
                key={p.name}
                className={`relative p-7 rounded-2xl border transition-all ${
                  p.popular
                    ? 'border-[#C9A227] bg-gradient-to-b from-[#1A1400] to-[#0A0A0A] shadow-[0_0_50px_rgba(201,162,39,0.2)]'
                    : 'border-[#C9A227]/15 bg-[#0A0A0A] hover:border-[#C9A227]/35'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C9A227] text-black text-xs font-black tracking-wide">
                    PALING POPULER
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-white font-bold text-lg mb-2">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#C9A227]">{p.price}</span>
                    <span className="text-gray-500 text-sm">{p.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-[#C9A227] text-xs">▲</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://t.me/azzavisionai_bot"
                  target="_blank"
                  rel="noreferrer"
                  className={`block text-center py-3 rounded-full font-bold text-sm transition-all hover:scale-105 ${
                    p.popular
                      ? 'bg-[#C9A227] text-black shadow-[0_0_20px_rgba(201,162,39,0.4)] hover:bg-[#FFE066]'
                      : 'border border-[#C9A227]/40 text-[#C9A227] hover:bg-[#C9A227]/10'
                  }`}
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, rgba(201,162,39,0.08) 0%, transparent 70%)' }} />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="flex justify-center mb-8">
            {/* Happy/excited mascot */}
            <div className="relative" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div className="absolute inset-0 rounded-full bg-[#C9A227]/20 blur-2xl scale-150" />
              <MascotCrop
                xPct={70} yPct={2} wPct={18} hPct={32}
                displayW={160} displayH={160}
                className="relative"
              />
            </div>
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Siap Trading <span className="text-shimmer">Lebih Cerdas?</span>
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Bergabung dengan ribuan trader yang sudah merasakan manfaat AZZAVISION AI.
            Gratis, tanpa kartu kredit.
          </p>
          <a
            href="https://t.me/azzavisionai_bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-[#C9A227] text-black font-extrabold text-lg hover:bg-[#FFE066] transition-all hover:scale-105 shadow-[0_0_40px_rgba(201,162,39,0.5)]"
          >
            <span>🤖 Buka di Telegram</span>
            <span>→</span>
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#C9A227]/10 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 36" className="w-8 h-8">
              <polygon points="20,2 38,34 2,34" fill="none" stroke="#C9A227" strokeWidth="2.5" />
              <polygon points="20,10 30,28 10,28" fill="#C9A227" opacity="0.3" />
            </svg>
            <span className="font-extrabold text-[#C9A227] tracking-widest">AZZAVISION AI</span>
          </div>
          <p className="text-xs text-gray-600 text-center">
            © 2026 AZZAVISION AI · AI Gold Trading Assistant · Trading involves risk, please manage wisely.
          </p>
          <div className="flex items-center gap-4">
            {/* Icon sticker strip from mascot */}
            <MascotCrop xPct={0} yPct={80} wPct={17} hPct={20} displayW={32} displayH={32}
              style={{ borderRadius: 8, opacity: 0.7, border: '1px solid rgba(201,162,39,0.2)' }} />
            <MascotCrop xPct={17} yPct={80} wPct={17} hPct={20} displayW={32} displayH={32}
              style={{ borderRadius: 8, opacity: 0.7, border: '1px solid rgba(201,162,39,0.2)' }} />
            <MascotCrop xPct={50} yPct={80} wPct={17} hPct={20} displayW={32} displayH={32}
              style={{ borderRadius: 8, opacity: 0.7, border: '1px solid rgba(201,162,39,0.2)' }} />
            <MascotCrop xPct={84} yPct={80} wPct={16} hPct={20} displayW={32} displayH={32}
              style={{ borderRadius: 8, opacity: 0.7, border: '1px solid rgba(201,162,39,0.2)' }} />
          </div>
        </div>
      </footer>
    </div>
  );
}
