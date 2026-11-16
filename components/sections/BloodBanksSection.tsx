"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DemoInventory, readWorkspace } from "@/lib/demoWorkspace";
import { useInView, useProgress } from "@/lib/useReveal";

/** Blood Banks — unit "bags" filled by the real demo-inventory units, joined to a hub. Fictional demo records, labelled. */
const MAX = 8;

function Bag({ item, p, i }: { item: DemoInventory; p: number; i: number }) {
  const level = Math.min(1, item.units / MAX) * p;
  const days = Math.round((new Date(item.expiry).getTime() - Date.now()) / 86400000);
  const id = `bag-${i}`;
  return (
    <article className="bb-card">
      <svg viewBox="0 0 80 110" className="bb-bag" role="img" aria-label={`${item.units} units of ${item.bloodGroup} ${item.component}`}>
        <defs><clipPath id={id}><path d="M14 22 Q14 14 22 14 H58 Q66 14 66 22 V84 Q66 100 40 100 Q14 100 14 84 Z" /></clipPath>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D43A5B" /><stop offset="1" stopColor="#7A1F2B" /></linearGradient></defs>
        <path d="M32 14 V6 Q32 2 40 2 Q48 2 48 6 V14" fill="none" stroke="#B9AFA4" strokeWidth="2" />
        <path d="M14 22 Q14 14 22 14 H58 Q66 14 66 22 V84 Q66 100 40 100 Q14 100 14 84 Z" fill="rgba(28,25,23,.04)" stroke="#B9AFA4" strokeWidth="1.6" />
        <g clipPath={`url(#${id})`}><rect x="10" y={100 - level * 80} width="60" height="90" fill={`url(#${id}f)`} />
          <path d={`M10 ${100 - level * 80} Q25 ${96 - level * 80} 40 ${100 - level * 80} T70 ${100 - level * 80}`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" /></g>
        <text x="40" y="64" textAnchor="middle" className="bb-grp" paintOrder="stroke" stroke="#7A1F2B" strokeWidth="3.2" strokeLinejoin="round">{item.bloodGroup}</text>
      </svg>
      <div>
        <h3>{item.bank}</h3>
        <p>{item.component}</p>
        <p className="bb-meta"><b>{Math.round(item.units * p)}</b> unit{item.units === 1 ? "" : "s"} · {days >= 0 ? `expires in ${days} d` : "past expiry date"}</p>
      </div>
    </article>
  );
}

export default function BloodBanksSection() {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, 0.2);
  const [inv, setInv] = useState<DemoInventory[]>([]);
  useEffect(() => {
    const load = () => setInv(readWorkspace().inventory);
    load();
    window.addEventListener("lifeline:workspace-updated", load);
    return () => window.removeEventListener("lifeline:workspace-updated", load);
  }, []);
  const p = useProgress(seen, inv.length, 1300);
  const banks = Array.from(new Set(inv.map((i) => i.bank)));
  const W = 520, H = 120;
  return (
    <section id="blood-banks" ref={ref} className="space-y-8 scroll-mt-24">
      <div className="max-w-2xl space-y-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-blood">Blood banks</p>
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl leading-tight">Every unit, <em className="text-blood">accounted for.</em></h2>
        <p className="text-sm text-ink-60 leading-relaxed">Banks list their stock by group, component, quantity and expiry. The matching engine reads that stock, skips anything expired, and prefers units nearing expiry so they are used first.</p>
        <p className="an-badge"><span aria-hidden="true" />Demo inventory · fictional records</p>
      </div>

      {banks.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="bb-net" role="img" aria-label="Demo blood banks connected to the LifeLine network">
          {banks.map((b, i) => { const x = ((i + 1) * W) / (banks.length + 1); return (
            <g key={b}>
              <line x1={W / 2} y1="94" x2={x} y2="26" stroke="#C9304B" strokeWidth="1.3" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} opacity=".7" />
              <circle cx={x} cy="26" r="9" fill="#fff" stroke="#7A1F2B" strokeWidth="1.6" opacity={Math.min(1, p * 2)} />
              <path d={`M${x} 20 C${x + 3.5} 25 ${x + 4.5} 27 ${x + 4.5} 28.5 A4.5 4.5 0 0 1 ${x - 4.5} 28.5 C${x - 4.5} 27 ${x - 3.5} 25 ${x} 20Z`} fill="#C9304B" opacity={Math.min(1, p * 2)} />
            </g>); })}
          <circle cx={W / 2} cy="98" r="12" fill="#7A1F2B" /><text x={W / 2} y="102" textAnchor="middle" fontSize="9" fill="#FAF7F2" fontFamily="JetBrains Mono, monospace">LL</text>
        </svg>
      )}

      <div className="bb-grid">{inv.map((it, i) => (<Bag key={it.id} item={it} p={p} i={i} />))}</div>
      <Link href="/bank" className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-blood px-6 text-sm font-semibold text-white transition hover:bg-blood-light">Open blood bank portal <span aria-hidden="true">→</span></Link>
    </section>
  );
}
