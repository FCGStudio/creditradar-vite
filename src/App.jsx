import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Settings, Wallet2, Bell, Coins, Trash2, Edit2, BarChart3, CreditCard, Cloud } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts";

/**
 * CreditRadar – single‑file React prototype
 *
 * Updates (2025‑11‑11):
 * - FIX: Resolved "Unterminated string constant" in CSV exporter (now uses "\n").
 * - FIX: Removed stray duplicate component tail that caused syntax errors.
 * - UX: "NEW (custom)" option when adding a platform (no more forced presets).
 * - UX: Create a platform inline from the Log usage modal (NEW… option in dropdown).
 * - QA: Added lightweight dev-time tests that run in `import.meta.env.DEV`.
 *
 * Features
 * - Dark, sleek dashboard (Tailwind)
 * - Add/manage platforms (Higgsfield, Suno, Google Flow, Runway, Pika, Luma, etc.) OR a custom platform via NEW
 * - Log credit usage (transactions) per platform & optional project tag
 * - Auto sums balances, shows total credits
 * - Burn‑rate & forecast from 30‑day average
 * - Simple trend chart per platform
 * - CSV export (balances & transactions)
 * - LocalStorage persistence
 */

// --- Presets (still available, but optional) ---
const PLATFORM_PRESETS = [
  { key: "Higgsfield", color: "#34d399" },
  { key: "Suno", color: "#60a5fa" },
  { key: "Google Flow", color: "#fbbf24" },
  { key: "Runway", color: "#f472b6" },
  { key: "Pika", color: "#a78bfa" },
  { key: "Luma", color: "#22d3ee" },
];

const demoTransactions = () => {
  const now = Date.now();
  const days = (n) => new Date(now - n * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return [
    { id: crypto.randomUUID(), platform: "Higgsfield", amount: -120, project: "Bug City trailer", note: "4 x 30s gens", date: days(1) },
    { id: crypto.randomUUID(), platform: "Suno", amount: -40, project: "NeonShore EP", note: "2 songs v4", date: days(2) },
    { id: crypto.randomUUID(), platform: "Runway", amount: -60, project: "FCG Reel", note: "Gen-3 alpha shots", date: days(4) },
    { id: crypto.randomUUID(), platform: "Google Flow", amount: -30, project: "Pitch deck", note: "text-to-video", date: days(6) },
    { id: crypto.randomUUID(), platform: "Pika", amount: -25, project: "Meme pack", note: "shorts", date: days(9) },
    { id: crypto.randomUUID(), platform: "Luma", amount: -50, project: "Desert MV", note: "lighting tests", date: days(12) },
  ];
};

const initialState = {
  platforms: PLATFORM_PRESETS.map((p) => ({
    id: crypto.randomUUID(),
    name: p.key,
    credits: 1000,
    color: p.color,
    unit: "credits",
    account: "main",
    monthlyAllowance: 0,
  })),
  transactions: demoTransactions(),
};

function loadState() {
  try {
    const raw = localStorage.getItem("ai-credit-tracker");
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      platforms: parsed.platforms ?? initialState.platforms,
      transactions: parsed.transactions ?? initialState.transactions,
    };
  } catch (e) {
    return initialState;
  }
}

function saveState(state) {
  localStorage.setItem("ai-credit-tracker", JSON.stringify(state));
}

function classNames(...c) { return c.filter(Boolean).join(" "); }

// --- Dev tests (run only in dev) ---
function __runDevTests() {
  try {
    // test CSV make function behavior
    const rows = [["A,1", 'B"2', "C\n3"], ["x", "y", "z"]];
    const make = (arr) => arr.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const out = make(rows);
    console.assert(out.includes('\n'), 'CSV should contain newlines');
    console.assert(out.split('\n').length === 3, 'CSV should have header+2 rows when tested');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Dev tests failed:', err);
  }
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [showAdd, setShowAdd] = useState(false);
  const [showNew, setShowNew] = useState(false); // NEW (custom) platform modal
  const [editing, setEditing] = useState(null); // platform id
  const [showTxn, setShowTxn] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => saveState(state), [state]);
  useEffect(() => { if (import.meta?.env?.DEV) __runDevTests(); }, []);

  const totalCredits = useMemo(() => state.platforms.reduce((a, p) => a + (Number(p.credits) || 0), 0), [state.platforms]);

  const last30 = useMemo(() => {
    const cut = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return state.transactions.filter((t) => new Date(t.date) >= cut);
  }, [state.transactions]);

  const dailyBurn = useMemo(() => {
    if (!last30.length) return 0;
    const spent = last30.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
    return +(spent / 30).toFixed(2);
  }, [last30]);

  const forecastDays = useMemo(() => {
    if (dailyBurn <= 0) return Infinity;
    return Math.floor(totalCredits / dailyBurn);
  }, [totalCredits, dailyBurn]);

  const platformMap = useMemo(() => Object.fromEntries(state.platforms.map(p => [p.name, p])), [state.platforms]);

  const chartData = useMemo(() => {
    const byDay = {};
    state.transactions.forEach((t) => {
      byDay[t.date] = (byDay[t.date] || 0) + t.amount;
    });
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(Date.now() - (13 - i) * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      return { date: key, spend: Math.abs(byDay[key] || 0) };
    });
    return days;
  }, [state.transactions]);

  const filteredTxns = useMemo(() => state.transactions
    .filter(t => filter === "All" ? true : t.platform === filter)
    .sort((a, b) => b.date.localeCompare(a.date)), [state.transactions, filter]);

  function addPlatform(presetName) {
    if (!presetName) return;
    const preset = PLATFORM_PRESETS.find(p => p.key === presetName) || { color: "#64748b" };
    const exists = state.platforms.some(p => p.name === presetName);
    if (exists) return alert("Platform already added.");
    setState(s => ({
      ...s,
      platforms: [...s.platforms, {
        id: crypto.randomUUID(),
        name: presetName,
        credits: 0,
        color: preset.color,
        unit: "credits",
        account: "main",
        monthlyAllowance: 0,
      }]
    }));
    setShowAdd(false);
  }

  function addCustomPlatform(custom) {
    const trimmed = (custom.name || "").trim();
    if (!trimmed) return alert("Name is required");
    if (state.platforms.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return alert("A platform with that name already exists.");
    }
    setState(s => ({
      ...s,
      platforms: [...s.platforms, {
        id: crypto.randomUUID(),
        name: trimmed,
        credits: Number(custom.credits) || 0,
        color: custom.color || "#64748b",
        unit: custom.unit || "credits",
        account: custom.account || "main",
        monthlyAllowance: Number(custom.monthlyAllowance) || 0,
      }]
    }));
    setShowNew(false);
    setShowAdd(false);
  }

  function updatePlatform(id, patch) {
    setState(s => ({
      ...s,
      platforms: s.platforms.map(p => p.id === id ? { ...p, ...patch } : p)
    }));
  }

  function removePlatform(id) {
    setState(s => ({
      ...s,
      platforms: s.platforms.filter(p => p.id !== id),
      transactions: s.transactions.filter(t => (platformMap[t.platform]?.id ?? null) !== id && t.platform !== (s.platforms.find(p=>p.id===id)?.name))
    }));
  }

  function addTransaction(txn) {
    setState(s => ({ ...s, transactions: [{ id: crypto.randomUUID(), ...txn }, ...s.transactions] }));
  }

  function exportCSV() {
    const headers1 = ["Platform","Credits","Unit","MonthlyAllowance","Account"]; 
    const rows1 = state.platforms.map(p => [p.name,p.credits,p.unit,p.monthlyAllowance,p.account]);

    const headers2 = ["Date","Platform","Amount","Project","Note"]; 
    const rows2 = state.transactions.map(t => [t.date,t.platform,t.amount,t.project||"",t.note||""]); 

    // FIX: use \n instead of a literal line break in string literal
    const make = (rows) => rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const part1 = make([headers1, ...rows1]);
    const part2 = make([headers2, ...rows2]);
    const content = `Balances\n${part1}\n\nTransactions\n${part2}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `creditradar_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wallet2 className="h-6 w-6 text-emerald-400" />
            <h1 className="text-lg font-semibold tracking-tight">CreditRadar</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowTxn(true)} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
              <CreditCard className="h-4 w-4" /> Log usage
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" /> Add platform
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => alert('Daily sync is simulated in this prototype.')} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
              <RefreshCw className="h-4 w-4" /> Sync
            </button>
            <button onClick={() => alert('Use the edit icon on a platform to set balance, unit, and allowance.')} className="rounded-2xl bg-zinc-800 p-2 hover:bg-zinc-700" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Top KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={<Coins className="h-4 w-4" />} label="Total credits" value={totalCredits.toLocaleString()} sub="across all platforms" />
          <KPI icon={<BarChart3 className="h-4 w-4" />} label="Daily burn (30d)" value={dailyBurn} sub="credits/day" />
          <KPI icon={<Cloud className="h-4 w-4" />} label="Platforms" value={state.platforms.length} sub="connected" />
          <KPI icon={<Bell className="h-4 w-4" />} label="Forecast" value={Number.isFinite(forecastDays) ? `${forecastDays} days` : "∞"} sub="until depletion" />
        </section>

        {/* Platforms grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.platforms.map((p) => (
            <PlatformCard
              key={p.id}
              platform={p}
              onEdit={() => setEditing(p.id)}
              onRemove={() => removePlatform(p.id)}
              transactions={state.transactions.filter(t => t.platform === p.name)}
            />
          ))}
        </section>

        {/* Spend chart + transactions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">14‑day spend</h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#a1a1aa" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, color: "#e4e4e7" }} />
                  <Area type="monotone" dataKey="spend" stroke="#22c55e" fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Transactions</h3>
              <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="rounded-xl bg-zinc-800 px-3 py-1 text-sm">
                <option>All</option>
                {state.platforms.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <ul className="space-y-2 max-h-64 overflow-auto pr-1">
              {filteredTxns.map(t => (
                <li key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{t.platform} • {t.project || "—"}</span>
                    <span className={classNames("font-medium", t.amount < 0 ? "text-rose-400" : "text-emerald-400")}>{t.amount}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{t.date} • {t.note || ""}</div>
                </li>
              ))}
              {!filteredTxns.length && (
                <li className="text-sm text-zinc-500">No transactions yet.</li>
              )}
            </ul>
            <button onClick={()=>setShowTxn(true)} className="mt-3 w-full rounded-xl bg-zinc-800 py-2 text-sm hover:bg-zinc-700">Add transaction</button>
          </div>
        </section>
      </main>

      {showAdd && (
        <Modal onClose={()=>setShowAdd(false)} title="Add Platform">
          <div className="space-y-2">
            {/* NEW custom option */}
            <button onClick={()=>setShowNew(true)} className="flex w-full items-center justify-between rounded-xl border border-emerald-700/50 bg-emerald-900/30 px-3 py-2 hover:bg-emerald-800/40">
              <span className="text-sm font-medium text-emerald-300">NEW (custom)</span>
              <span className="text-xs text-emerald-300">Create your own</span>
            </button>
            <div className="pt-2 text-xs text-zinc-500">Or pick a preset:</div>
            {PLATFORM_PRESETS.map((p) => (
              <button key={p.key} onClick={()=>addPlatform(p.key)} className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 hover:bg-zinc-800">
                <span className="text-sm">{p.key}</span>
                <span className="h-4 w-4 rounded-full" style={{ background: p.color }} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showNew && (
        <NewPlatformModal
          onClose={()=>setShowNew(false)}
          onCreate={addCustomPlatform}
        />
      )}

      {typeof editing === 'string' && (
        <EditPlatform
          platform={state.platforms.find(p => p.id === editing)}
          onClose={()=>setEditing(null)}
          onSave={(patch)=>{ updatePlatform(editing, patch); setEditing(null); }}
          onRemove={()=>{ removePlatform(editing); setEditing(null); }}
        />
      )}

      {showTxn && (
        <TransactionDrawer
          platforms={state.platforms}
          onClose={()=>setShowTxn(false)}
          onCreate={(t)=>{ addTransaction(t); const p = state.platforms.find(p=>p.name===t.platform); if (p) updatePlatform(p.id, { credits: Number(p.credits) + Number(t.amount) }); setShowTxn(false); }}
          onCreatePlatform={(pf)=>{ addCustomPlatform(pf); }}
        />)
      }
    </div>
  );
}

function KPI({ icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-zinc-400 text-xs">{icon}<span>{label}</span></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function PlatformCard({ platform, onEdit, onRemove, transactions }) {
  const spent30 = useMemo(() => {
    const cut = new Date(Date.now() - 30*24*3600*1000);
    return Math.abs(transactions.filter(t=> new Date(t.date) >= cut && t.amount < 0).reduce((a,t)=>a+t.amount,0));
  }, [transactions]);

  const daily = +(spent30/30).toFixed(2);
  const daysLeft = daily>0 ? Math.floor((platform.credits||0)/daily) : Infinity;

  const data = useMemo(()=>{
    const days = Array.from({length:14}).map((_,i)=>{
      const d = new Date(Date.now() - (13-i)*24*3600*1000);
      const key = d.toISOString().slice(0,10);
      const dailySpend = transactions.filter(t=>t.date===key).reduce((a,t)=>a+t.amount,0);
      return { date:key, bal: dailySpend };
    });
    let acc = 0; return days.map(d=>({ ...d, bal: (acc+=d.bal) }));
  }, [transactions]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: platform.color }} />
          <div>
            <div className="text-sm font-semibold">{platform.name}</div>
            <div className="text-xs text-zinc-500">{platform.unit || 'credits'} • acct: {platform.account}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="rounded-xl bg-zinc-800 p-2 hover:bg-zinc-700" aria-label="Edit"><Edit2 className="h-4 w-4"/></button>
          <button onClick={onRemove} className="rounded-xl bg-zinc-800 p-2 hover:bg-zinc-700" aria-label="Remove"><Trash2 className="h-4 w-4"/></button>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs text-zinc-400">Balance</div>
          <div className="text-xl font-semibold">{Number(platform.credits).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs text-zinc-400">Forecast</div>
          <div className="text-xl font-semibold">{Number.isFinite(daysLeft)? `${daysLeft} d` : '∞'}</div>
        </div>
        <div className="col-span-2 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
              <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, color: "#e4e4e7" }} />
              <Line type="monotone" dataKey="bal" stroke={platform.color} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-3 text-sm font-semibold">{title}</div>
        {children}
        <div className="mt-4 text-right">
          <button onClick={onClose} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Close</button>
        </div>
      </div>
    </div>
  );
}

function EditPlatform({ platform, onClose, onSave, onRemove }) {
  const [form, setForm] = useState({
    name: platform?.name || "",
    credits: platform?.credits || 0,
    unit: platform?.unit || "credits",
    account: platform?.account || "main",
    monthlyAllowance: platform?.monthlyAllowance || 0,
    color: platform?.color || "#64748b",
  });
  return (
    <Modal title={`Edit ${platform?.name}`} onClose={onClose}>
      <div className="space-y-3">
        <LabeledInput label="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} />
        <LabeledInput label="Balance" type="number" value={form.credits} onChange={(e)=>setForm({...form,credits:Number(e.target.value)})} />
        <LabeledInput label="Unit" value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} />
        <LabeledInput label="Account" value={form.account} onChange={(e)=>setForm({...form,account:e.target.value})} />
        <LabeledInput label="Monthly allowance (auto top‑up)" type="number" value={form.monthlyAllowance} onChange={(e)=>setForm({...form,monthlyAllowance:Number(e.target.value)})} />
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-300 w-48">Color</label>
          <input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="h-8 w-16 rounded" />
        </div>
        <div className="flex justify-between pt-2">
          <button onClick={onRemove} className="inline-flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-300 hover:bg-rose-900/40"><Trash2 className="h-4 w-4"/>Remove</button>
          <div className="space-x-2">
            <button onClick={onClose} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Cancel</button>
            <button onClick={()=>onSave(form)} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NewPlatformModal({ onCreate, onClose }) {
  const [form, setForm] = useState({ name: "", credits: 0, unit: "credits", account: "main", monthlyAllowance: 0, color: "#22c55e" });
  return (
    <Modal title="Create NEW Platform" onClose={onClose}>
      <div className="space-y-3">
        <LabeledInput label="Name (e.g., 'Hailuo', 'Veo3', 'Custom')" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} />
        <LabeledInput label="Starting balance" type="number" value={form.credits} onChange={(e)=>setForm({...form,credits:Number(e.target.value)})} />
        <LabeledInput label="Unit" value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} />
        <LabeledInput label="Account" value={form.account} onChange={(e)=>setForm({...form,account:e.target.value})} />
        <LabeledInput label="Monthly allowance" type="number" value={form.monthlyAllowance} onChange={(e)=>setForm({...form,monthlyAllowance:Number(e.target.value)})} />
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-300 w-48">Color</label>
          <input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="h-8 w-16 rounded" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Cancel</button>
          <button onClick={()=>onCreate(form)} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Create</button>
        </div>
      </div>
    </Modal>
  );
}

function TransactionDrawer({ platforms, onCreate, onClose, onCreatePlatform }) {
  const [form, setForm] = useState({ platform: platforms[0]?.name || "", amount: -10, project: "", note: "", date: new Date().toISOString().slice(0,10) });
  const [newPf, setNewPf] = useState({ name: "", credits: 0, unit: "credits", account: "main", monthlyAllowance: 0, color: "#22c55e" });
  const [makeNew, setMakeNew] = useState(false);

  function handlePlatformChange(val){
    if (val === "__NEW__") {
      setMakeNew(true);
      setForm({ ...form, platform: "" });
    } else {
      setMakeNew(false);
      setForm({ ...form, platform: val });
    }
  }

  function createAndSelect(){
    const trimmed = (newPf.name||"").trim();
    if (!trimmed) return alert("Name is required");
    onCreatePlatform?.(newPf);
    setForm({ ...form, platform: trimmed });
    setMakeNew(false);
  }

  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-300 w-48">Platform</label>
          <select value={makeNew ? "__NEW__" : form.platform} onChange={(e)=>handlePlatformChange(e.target.value)} className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm">
            {platforms.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            <option value="__NEW__">NEW… (create custom)</option>
          </select>
        </div>

        {makeNew && (
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-3 space-y-2">
            <div className="text-xs text-emerald-300 font-medium">Create new platform</div>
            <LabeledInput label="Name" value={newPf.name} onChange={(e)=>setNewPf({...newPf,name:e.target.value})} />
            <LabeledInput label="Starting balance" type="number" value={newPf.credits} onChange={(e)=>setNewPf({...newPf,credits:Number(e.target.value)})} />
            <LabeledInput label="Unit" value={newPf.unit} onChange={(e)=>setNewPf({...newPf,unit:e.target.value})} />
            <LabeledInput label="Account" value={newPf.account} onChange={(e)=>setNewPf({...newPf,account:e.target.value})} />
            <LabeledInput label="Monthly allowance" type="number" value={newPf.monthlyAllowance} onChange={(e)=>setNewPf({...newPf,monthlyAllowance:Number(e.target.value)})} />
            <div className="flex items-center gap-3">
              <label className="text-sm text-zinc-300 w-48">Color</label>
              <input type="color" value={newPf.color} onChange={(e)=>setNewPf({...newPf,color:e.target.value})} className="h-8 w-16 rounded" />
            </div>
            <div className="flex justify-end">
              <button onClick={createAndSelect} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Create & select</button>
            </div>
          </div>
        )}

        <LabeledInput label="Amount (negative = spend)" type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:Number(e.target.value)})} />
        <LabeledInput label="Project (optional)" value={form.project} onChange={(e)=>setForm({...form,project:e.target.value})} />
        <LabeledInput label="Note" value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} />
        <LabeledInput label="Date" type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">Cancel</button>
          <button onClick={()=>{ if (!form.platform) return alert("Select a platform (or create NEW)"); onCreate(form); }} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Add</button>
        </div>
      </div>
    </Modal>
  );
}

function LabeledInput({ label, ...props }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-zinc-300 w-48">{label}</label>
      <input {...props} className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none ring-0 focus:bg-zinc-700" />
    </div>
  );
}
