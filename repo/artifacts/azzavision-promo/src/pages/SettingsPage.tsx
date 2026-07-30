import { useState, useEffect } from "react";
import { API_BASE } from "../config/api";
import { LydiaAvatar } from "../components/Shared";

type ApiStatus = "checking" | "connected" | "disconnected";

const PAIRS_LIST = ["XAUUSD", "EURUSD", "GBPUSD", "GBPJPY", "USDJPY", "AUDUSD"];

export default function SettingsPage() {
  const [name, setName]         = useState("Azza");
  const [timezone, setTimezone] = useState("WIB (UTC+7)");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [savedMsg, setSavedMsg]  = useState(false);

  const [notifs, setNotifs] = useState({
    newSignal: true,
    slHit: true,
    tpHit: true,
    systemAlert: false,
  });

  const [activePairs, setActivePairs] = useState<Record<string, boolean>>({
    XAUUSD: true, EURUSD: true, GBPUSD: true, GBPJPY: false, USDJPY: false, AUDUSD: false,
  });

  useEffect(() => {
    setApiStatus("checking");
    fetch(`${API_BASE}/api/healthz`)
      .then(r => r.ok ? setApiStatus("connected") : setApiStatus("disconnected"))
      .catch(() => setApiStatus("disconnected"));
  }, []);

  function save() {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function toggleNotif(k: keyof typeof notifs) {
    setNotifs(prev => ({ ...prev, [k]: !prev[k] }));
  }

  function togglePair(p: string) {
    setActivePairs(prev => ({ ...prev, [p]: !prev[p] }));
  }

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`relative w-10 h-5 rounded-full transition-all ${on ? "bg-[#D4AF37]" : "bg-gray-700"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black text-white">⚙️ Settings</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Customize your AZZAVISION AI experience</p>
        </div>
        <LydiaAvatar size={36} />
      </div>

      {/* profile */}
      <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-5">
        <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">PROFILE</div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#111] border border-[#D4AF37]/20 rounded-xl px-4 py-2.5 text-[13px] text-white outline-none focus:border-[#D4AF37]/50" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full bg-[#111] border border-[#D4AF37]/20 rounded-xl px-4 py-2.5 text-[13px] text-gray-300 outline-none focus:border-[#D4AF37]/50 cursor-pointer">
              <option>WIB (UTC+7)</option>
              <option>UTC+0</option>
              <option>UTC+8</option>
              <option>UTC+9</option>
              <option>UTC-5</option>
            </select>
          </div>
        </div>
      </div>

      {/* notifications */}
      <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-5">
        <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">NOTIFICATIONS</div>
        <div className="space-y-3">
          {[
            { k: "newSignal" as const,   l: "New Signal Alert",    d: "Notify when a new signal is posted"  },
            { k: "slHit"     as const,   l: "Stop Loss Hit",       d: "Notify when SL is triggered"         },
            { k: "tpHit"     as const,   l: "Take Profit Hit",     d: "Notify when TP1 or TP2 is reached"   },
            { k: "systemAlert" as const, l: "System Alerts",       d: "Server status and connectivity alerts" },
          ].map(n => (
            <div key={n.k} className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
              <div>
                <div className="text-[12px] text-white font-medium">{n.l}</div>
                <div className="text-[10px] text-gray-500">{n.d}</div>
              </div>
              <Toggle on={notifs[n.k]} onClick={() => toggleNotif(n.k)} />
            </div>
          ))}
        </div>
      </div>

      {/* pair preferences */}
      <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-5">
        <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">PAIR PREFERENCES</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PAIRS_LIST.map(p => (
            <button key={p} onClick={() => togglePair(p)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-[12px] font-bold transition-all ${
                activePairs[p]
                  ? "text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/35"
                  : "text-gray-500 bg-[#111] border-[#D4AF37]/10 hover:border-[#D4AF37]/25"
              }`}>
              {p}
              {activePairs[p] && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* theme */}
      <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-5">
        <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">THEME</div>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-[12px] text-white font-medium">Dark Mode</div>
            <div className="text-[10px] text-gray-500">AZZAVISION AI is dark-mode only for optimal chart readability</div>
          </div>
          <button className="px-4 py-2 rounded-xl text-[11px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 cursor-default">
            ● Always Dark
          </button>
        </div>
      </div>

      {/* api status */}
      <div className="rounded-2xl bg-[#0D0D0D] border border-[#D4AF37]/18 p-5">
        <div className="text-[9px] text-gray-500 font-semibold tracking-widest mb-4">API STATUS</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-white font-medium">Backend Connection</div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{API_BASE || "relative: /api"}</div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-bold ${
            apiStatus === "connected"    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" :
            apiStatus === "disconnected" ? "text-red-400 bg-red-500/10 border-red-500/25" :
            "text-yellow-400 bg-yellow-500/10 border-yellow-500/25"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === "connected" ? "bg-emerald-400 animate-pulse" :
              apiStatus === "disconnected" ? "bg-red-400" : "bg-yellow-400 animate-pulse"
            }`} />
            {apiStatus === "connected" ? "Connected" : apiStatus === "disconnected" ? "Disconnected" : "Checking..."}
          </div>
        </div>
        <button
          className="mt-3 text-[10px] text-[#D4AF37] hover:text-[#F5C542] transition-colors"
          onClick={() => {
            setApiStatus("checking");
            fetch(`${API_BASE}/api/healthz`)
              .then(r => r.ok ? setApiStatus("connected") : setApiStatus("disconnected"))
              .catch(() => setApiStatus("disconnected"));
          }}>
          ↺ Re-check connection
        </button>
      </div>

      {/* save button */}
      <button onClick={save}
        className="w-full py-3.5 rounded-xl font-black text-[13px] text-black transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: "linear-gradient(90deg,#D4AF37,#F5C542)", boxShadow: "0 0 20px rgba(212,175,55,0.25)" }}>
        {savedMsg ? "✓ Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
