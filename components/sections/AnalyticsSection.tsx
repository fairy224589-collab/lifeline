"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DemoWorkspace, readWorkspace } from "@/lib/demoWorkspace";
import { readUnitPassports } from "@/lib/unitPassports";
import { useInView, useProgress } from "@/lib/useReveal";

/**
 * ANALYTICS — every number below is computed from data that exists in this prototype:
 *   • the demo workspace (inventory, donors, requests) stored in this browser
 *   • the Unit Passports saved in this browser
 *   • the matching-engine weights defined in lib/matchingEngine.ts
 * It is fictional demo data, and the section says so. Nothing is invented or presented as live.
 */
const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const C = { burgundy: "#7A1F2B", crimson: "#C9304B", pink: "#EFA3B1", charcoal: "#2B2523", warm: "#B9AFA4", ivory: "#FAF7F2" };
const WEIGHTS = [{ k: "Urgency", v: 35, c: C.burgundy }, { k: "Proximity", v: 30, c: C.crimson }, { k: "Expiry", v: 20, c: C.pink }, { k: "Reliability", v: 15, c: C.charcoal }];
const STATUS_COLORS = [C.burgundy, C.crimson, C.pink, C.charcoal, C.warm];

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

function daysUntil(iso: string) { return Math.round((new Date(iso).getTime() - Date.now()) / 86400000); }

function useWorkspace() {
  const [ws, setWs] = useState<DemoWorkspace | null>(null);
  const [passports, setPassports] = useState<ReturnType<typeof readUnitPassports>>([]);
  useEffect(() => {
    const load = () => { setWs(readWorkspace()); setPassports(readUnitPassports()); };
    load();
    window.addEventListener("lifeline:workspace-updated", load);
    window.addEventListener("lifeline:unit-passports-updated", load);
    window.addEventListener("storage", load);
    return () => { window.removeEventListener("lifeline:workspace-updated", load); window.removeEventListener("lifeline:unit-passports-updated", load); window.removeEventListener("storage", load); };
  }, []);
  return { ws, passports };
}

function Counter({ to, p, suffix = "" }: { to: number; p: number; suffix?: string }) {
  return <>{Math.round(to * p)}{suffix}</>;
}

function Donut({ parts, p, center, sub, onTip }: { parts: { label: string; value: number; color: string }[]; p: number; center: string; sub: string; onTip: (t: Tip, e?: React.PointerEvent) => void }) {
  const total = parts.reduce((a, b) => a + b.value, 0) || 1;
  const R = 52, CIRC = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" className="an-donut" role="img" aria-label={`${sub}: ${parts.map((q) => `${q.label} ${q.value}`).join(", ")}`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(28,25,23,.07)" strokeWidth="14" />
      {parts.map((q) => {
        const frac = q.value / total, start = acc; acc += frac;
        const visible = Math.max(0, Math.min(frac, p - start)); // arcs fill one after another
        return (
          <circle key={q.label} cx="70" cy="70" r={R} fill="none" stroke={q.color} strokeWidth="14" strokeLinecap="butt"
            strokeDasharray={`${visible * CIRC} ${CIRC}`} strokeDashoffset={-start * CIRC} transform="rotate(-90 70 70)"
            style={{ cursor: "pointer", transition: "stroke-width .2s" }}
            onPointerEnter={(e) => onTip({ x: 0, y: 0, title: q.label, lines: [`${q.value} · ${Math.round(frac * 100)}%`] }, e)}
            onPointerDown={(e) => onTip({ x: 0, y: 0, title: q.label, lines: [`${q.value} · ${Math.round(frac * 100)}%`] }, e)}
            onPointerLeave={(e) => e.pointerType === "mouse" && onTip(null)} />
        );
      })}
      <text x="70" y="68" textAnchor="middle" className="an-donut-n">{center}</text>
      <text x="70" y="84" textAnchor="middle" className="an-donut-s">{sub}</text>
    </svg>
  );
}

export default function AnalyticsSection() {
  const root = useRef<HTMLElement>(null);
  const seen = useInView(root, 0.15);
  const { ws, passports } = useWorkspace();
  const [component, setComponent] = useState("All");
  const [windowDays, setWindowDays] = useState<number>(0); // 0 = all upcoming
  const [tip, setTip] = useState<Tip>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const showTip = (t: Tip, e?: React.PointerEvent) => {
    if (!t || !e || !wrap.current) return setTip(null);
    const r = wrap.current.getBoundingClientRect();
    setTip({ ...t, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const inv = useMemo(() => (ws?.inventory ?? []).filter((i) => (component === "All" || i.component === component) && (windowDays === 0 || daysUntil(i.expiry) <= windowDays) && daysUntil(i.expiry) >= 0), [ws, component, windowDays]);
  const components = useMemo(() => ["All", ...Array.from(new Set((ws?.inventory ?? []).map((i) => i.component)))], [ws]);
  const byGroup = GROUPS.map((g) => ({ g, units: inv.filter((i) => i.bloodGroup === g).reduce((a, b) => a + b.units, 0), rows: inv.filter((i) => i.bloodGroup === g) }));
  const maxUnits = Math.max(4, ...byGroup.map((b) => b.units));
  const line = useMemo(() => {
    const sorted = [...inv].sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
    let cum = 0;
    return sorted.map((i) => { cum += i.units; return { d: daysUntil(i.expiry), cum, row: i }; });
  }, [inv]);
  const donors = ws?.donors ?? [];
  const avail = donors.filter((d) => d.available).length;
  const reqStatus = useMemo(() => { const m = new Map<string, number>(); (ws?.requests ?? []).forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1)); return Array.from(m, ([label, value], i) => ({ label, value, color: STATUS_COLORS[i % STATUS_COLORS.length] })); }, [ws]);
  const passStatus = ["Available", "Reserved", "Dispatched", "Handed over"].map((s) => ({ s, n: passports.filter((p) => p.status === s).length }));
  const totalUnits = (ws?.inventory ?? []).reduce((a, b) => a + b.units, 0);
  const banks = new Set((ws?.inventory ?? []).map((i) => i.bank)).size;

  const key = `${component}|${windowDays}|${ws?.inventory.length}|${ws?.requests.length}`;
  const p = useProgress(seen, key, 1400);

  // line chart geometry
  const LW = 560, LH = 220, PL = 40, PR = 16, PT = 14, PB = 30;
  const maxD = Math.max(30, ...line.map((l) => l.d), windowDays || 0), maxC = Math.max(4, ...line.map((l) => l.cum));
  const lx = (d: number) => PL + (d / maxD) * (LW - PL - PR), ly = (c: number) => LH - PB - (c / maxC) * (LH - PT - PB);
  const pts = [{ d: 0, cum: 0 }, ...line].map((l) => [lx(l.d), ly(l.cum)]);
  const path = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");

  return (
    <section id="analytics" ref={root} className="space-y-8 scroll-mt-24">
      <div className="max-w-2xl space-y-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-blood">Analytics</p>
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl leading-tight">The network, <em className="text-blood">in numbers.</em></h2>
        <p className="text-sm text-ink-60 leading-relaxed">Charts are drawn from the demo workspace saved in this browser, so they update when you reserve a unit in Rapid Blood Finder.</p>
        <p className="an-badge"><span aria-hidden="true" />Demo data · fictional records · not live operational data</p>
      </div>

      <div className="an-kpis">
        {[{ label: "Units in demo inventory", to: totalUnits }, { label: "Demo blood banks", to: banks }, { label: "Available donors", to: avail, suffix: ` / ${donors.length}` }, { label: "Demo requests", to: ws?.requests.length ?? 0 }].map((k) => (
          <div key={k.label} className="an-kpi"><p className="an-kpi-n"><Counter to={k.to} p={p} suffix={k.suffix} /></p><p className="an-kpi-l">{k.label}</p></div>
        ))}
      </div>

      <div className="an-controls" role="group" aria-label="Chart filters">
        <div className="an-chips" role="group" aria-label="Blood component">
          {components.map((c) => (<button key={c} type="button" className={`an-chip ${component === c ? "on" : ""}`} aria-pressed={component === c} onClick={() => setComponent(c)}>{c}</button>))}
        </div>
        <div className="an-chips" role="group" aria-label="Expiry window">
          {[[0, "All upcoming"], [14, "14 days"], [30, "30 days"], [60, "60 days"]].map(([d, l]) => (<button key={d} type="button" className={`an-chip ${windowDays === d ? "on" : ""}`} aria-pressed={windowDays === d} onClick={() => setWindowDays(d as number)}>{l}</button>))}
        </div>
      </div>

      <div ref={wrap} className="an-grid" onPointerDown={(e) => { if ((e.target as Element).tagName === "DIV") setTip(null); }}>
        {/* Bars */}
        <figure className="an-card an-wide">
          <figcaption><span>Inventory by blood group</span><em>Units · demo workspace</em></figcaption>
          <svg viewBox="0 0 560 230" className="an-svg" role="img" aria-label="Bar chart of demo inventory units by blood group">
            {[0, 0.5, 1].map((t) => (<g key={t}><line x1="32" x2="548" y1={190 - t * 150} y2={190 - t * 150} className="an-grid-l" /><text x="24" y={194 - t * 150} textAnchor="end" className="an-axis">{Math.round(maxUnits * t)}</text></g>))}
            {byGroup.map((b, i) => {
              const bw = 38, x = 46 + i * 64, h = (b.units / maxUnits) * 150 * p;
              return (
                <g key={b.g} style={{ cursor: "pointer" }} onPointerEnter={(e) => showTip({ x: 0, y: 0, title: `${b.g} · ${b.units} unit${b.units === 1 ? "" : "s"}`, lines: b.rows.length ? b.rows.map((r) => `${r.bank} · ${r.component}`) : ["No stock in this view"] }, e)}
                   onPointerDown={(e) => showTip({ x: 0, y: 0, title: `${b.g} · ${b.units} unit${b.units === 1 ? "" : "s"}`, lines: b.rows.length ? b.rows.map((r) => `${r.bank} · ${r.component}`) : ["No stock in this view"] }, e)} onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
                  <rect x={x - 8} y="30" width={bw + 16} height="170" fill="transparent" />
                  <rect x={x} y={190 - 150} width={bw} height="150" rx="4" fill="rgba(28,25,23,.04)" />
                  <rect x={x} y={190 - h} width={bw} height={Math.max(h, b.units ? 2 : 0)} rx="4" fill={b.units === Math.max(...byGroup.map((q) => q.units)) && b.units > 0 ? C.crimson : C.burgundy} opacity={b.units ? 1 : 0.2} />
                  <text x={x + bw / 2} y="212" textAnchor="middle" className="an-axis an-axis-b">{b.g}</text>
                  {b.units > 0 && <text x={x + bw / 2} y={190 - h - 6} textAnchor="middle" className="an-val" opacity={p}>{Math.round(b.units * p)}</text>}
                </g>
              );
            })}
          </svg>
        </figure>

        {/* Donut: donors */}
        <figure className="an-card">
          <figcaption><span>Donor availability</span><em>Demo registry</em></figcaption>
          <Donut p={p} onTip={showTip} center={`${donors.length ? Math.round((avail / donors.length) * 100 * p) : 0}%`} sub="available"
            parts={[{ label: "Available", value: avail, color: C.crimson }, { label: "Unavailable", value: donors.length - avail, color: C.warm }]} />
        </figure>

        {/* Line: expiry */}
        <figure className="an-card an-wide">
          <figcaption><span>Cumulative units reaching expiry</span><em>Days from today · filters apply</em></figcaption>
          {line.length === 0 ? <p className="an-empty">No stock matches these filters.</p> : (
            <svg viewBox={`0 0 ${LW} ${LH}`} className="an-svg" role="img" aria-label="Line chart of cumulative inventory units by days until expiry">
              {[0, 0.5, 1].map((t) => (<g key={t}><line x1={PL} x2={LW - PR} y1={ly(maxC * t)} y2={ly(maxC * t)} className="an-grid-l" /><text x={PL - 8} y={ly(maxC * t) + 4} textAnchor="end" className="an-axis">{Math.round(maxC * t)}</text></g>))}
              {[0, 0.5, 1].map((t) => (<text key={t} x={lx(maxD * t)} y={LH - 8} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} className="an-axis">{Math.round(maxD * t)}d</text>))}
              <path d={`${path} L${lx(line[line.length - 1].d)} ${ly(0)} L${lx(0)} ${ly(0)}Z`} fill="url(#an-area)" opacity={p * 0.9} />
              <defs><linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.crimson} stopOpacity=".28" /><stop offset="1" stopColor={C.crimson} stopOpacity="0" /></linearGradient></defs>
              <path d={path} fill="none" stroke={C.burgundy} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
              {line.map((l, i) => {
                const vis = p > (i + 1) / (line.length + 1);
                return (
                  <g key={l.row.id} style={{ cursor: "pointer" }} opacity={vis ? 1 : 0}
                     onPointerEnter={(e) => showTip({ x: 0, y: 0, title: `In ${l.d} day${l.d === 1 ? "" : "s"}`, lines: [`${l.row.bank}`, `${l.row.bloodGroup} · ${l.row.component} · ${l.row.units} unit${l.row.units === 1 ? "" : "s"}`, `Running total: ${l.cum}`] }, e)}
                     onPointerDown={(e) => showTip({ x: 0, y: 0, title: `In ${l.d} day${l.d === 1 ? "" : "s"}`, lines: [`${l.row.bank}`, `${l.row.bloodGroup} · ${l.row.component} · ${l.row.units} unit${l.row.units === 1 ? "" : "s"}`, `Running total: ${l.cum}`] }, e)}
                     onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
                    <circle cx={lx(l.d)} cy={ly(l.cum)} r="16" fill="transparent" />
                    <circle cx={lx(l.d)} cy={ly(l.cum)} r="5" fill={C.ivory} stroke={C.crimson} strokeWidth="2.2" />
                  </g>
                );
              })}
            </svg>
          )}
        </figure>

        {/* Donut: matching weights */}
        <figure className="an-card">
          <figcaption><span>Matching score weights</span><em>From the matching engine</em></figcaption>
          <Donut p={p} onTip={showTip} center="100%" sub="of score" parts={WEIGHTS.map((w) => ({ label: w.k, value: w.v, color: w.c }))} />
          <ul className="an-legend">{WEIGHTS.map((w) => (<li key={w.k}><i style={{ background: w.c }} />{w.k} {w.v}%</li>))}</ul>
        </figure>

        {/* Donut: requests */}
        <figure className="an-card">
          <figcaption><span>Demo requests by status</span><em>Demo workspace</em></figcaption>
          {reqStatus.length ? (<><Donut p={p} onTip={showTip} center={String(Math.round((ws?.requests.length ?? 0) * p))} sub="requests" parts={reqStatus} /><ul className="an-legend">{reqStatus.map((w) => (<li key={w.label}><i style={{ background: w.color }} />{w.label} · {w.value}</li>))}</ul></>) : <p className="an-empty">No demo requests yet. Reserve a unit in Rapid Blood Finder.</p>}
        </figure>

        {/* Passport bars */}
        <figure className="an-card an-wide">
          <figcaption><span>Unit Passports by status</span><em>Saved in this browser</em></figcaption>
          <div className="an-hbars">
            {passStatus.map((s, i) => {
              const m = Math.max(1, ...passStatus.map((q) => q.n));
              return (
                <div key={s.s} className="an-hbar" onPointerDown={(e) => showTip({ x: 0, y: 0, title: s.s, lines: [`${s.n} passport${s.n === 1 ? "" : "s"}`] }, e)} onPointerEnter={(e) => showTip({ x: 0, y: 0, title: s.s, lines: [`${s.n} passport${s.n === 1 ? "" : "s"}`] }, e)} onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
                  <span>{s.s}</span><div><b style={{ width: `${(s.n / m) * 100 * p}%`, background: [C.burgundy, C.crimson, C.pink, C.charcoal][i] }} /></div><em>{Math.round(s.n * p)}</em>
                </div>
              );
            })}
          </div>
        </figure>

        {tip && (<div className="an-tip" role="status" style={{ left: Math.min(Math.max(tip.x, 90), (wrap.current?.clientWidth ?? 600) - 90), top: tip.y - 12 }}><strong>{tip.title}</strong>{tip.lines.map((l, i) => (<span key={i}>{l}</span>))}</div>)}
      </div>
    </section>
  );
}
