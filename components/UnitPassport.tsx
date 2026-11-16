"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readUnitPassports, saveUnitPassports, UnitPassportRecord, UnitStatus } from "@/lib/unitPassports";

const stages: UnitStatus[] = ["Available", "Reserved", "Dispatched", "Handed over"];
const samples: UnitPassportRecord[] = [
  { id: "LL-DEMO-2026-00481", bank: "CityCare Demo Blood Centre", group: "B+", component: "Packed red cells", units: 1, collected: "08 Nov 2026", expires: "06 Dec 2026", status: "Reserved", batch: "DEMO-BP-481", createdAt: "2026-11-08T09:00:00.000Z", source: "sample" },
  { id: "LL-DEMO-2026-00482", bank: "Community Demo Blood Centre", group: "O+", component: "Platelets", units: 1, collected: "10 Nov 2026", expires: "15 Nov 2026", status: "Available", batch: "DEMO-OP-482", createdAt: "2026-11-10T09:00:00.000Z", source: "sample" },
  { id: "LL-DEMO-2026-00483", bank: "Metro Demo Blood Centre", group: "A-", component: "Plasma", units: 1, collected: "07 Nov 2026", expires: "07 Nov 2027", status: "Dispatched", batch: "DEMO-AM-483", createdAt: "2026-11-07T09:00:00.000Z", source: "sample" },
];

function QRPreview({ value }: { value: string }) {
  const cells = useMemo(() => Array.from({ length: 441 }, (_, index) => {
    const x = index % 21, y = Math.floor(index / 21);
    const finder = (ox: number, oy: number) => { const dx = x - ox, dy = y - oy; if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return null; return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); };
    const fixed = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
    if (fixed !== null) return fixed;
    const seed = value.charCodeAt((x * 7 + y * 11) % value.length) || 0;
    return ((x * 13 + y * 17 + seed + x * y) % 5) < 2;
  }), [value]);
  return <div className="rounded-2xl bg-white p-3 shadow-sm" aria-label="Decorative QR-style demo graphic; not scannable"><div className="grid aspect-square w-36 grid-cols-[repeat(21,minmax(0,1fr))] gap-[2px]">{cells.map((dark, i) => <span key={i} className={dark ? "rounded-[1px] bg-[#211d1b]" : "bg-white"} />)}</div></div>;
}

export default function UnitPassport() {
  const [units, setUnits] = useState<UnitPassportRecord[]>(samples);
  const [selectedId, setSelectedId] = useState(samples[0].id);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    const stored = readUnitPassports();
    const merged = [...stored, ...samples.filter((sample) => !stored.some((item) => item.id === sample.id))];
    setUnits(merged);
    setSelectedId((current) => merged.some((item) => item.id === current) ? current : merged[0]?.id ?? "");
  }, []);

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("id");
    if (requestedId) setSelectedId(requestedId);
    setReady(true);
    const onUpdate = () => refresh();
    window.addEventListener("lifeline:unit-passports-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => { window.removeEventListener("lifeline:unit-passports-updated", onUpdate); window.removeEventListener("storage", onUpdate); };
  }, [refresh]);

  const selected = units.find((unit) => unit.id === selectedId) ?? units[0];
  const stageIndex = selected ? stages.indexOf(selected.status) : 0;

  function advanceStatus() {
    if (!selected || stageIndex >= stages.length - 1) return;
    const updated = units.map((unit) => unit.id === selected.id ? { ...unit, status: stages[stageIndex + 1] } : unit);
    setUnits(updated);
    saveUnitPassports(updated.filter((unit) => unit.source !== "sample"));
  }

  function resetDemo() {
    saveUnitPassports([]);
    setUnits(samples);
    setSelectedId(samples[0].id);
  }

  if (!ready || !selected) return <main className="min-h-screen bg-clay p-8 text-ink">Loading unit passports…</main>;

  return <main className="min-h-screen bg-clay px-5 py-8 sm:px-8 sm:py-12"><div className="mx-auto max-w-6xl">
    <nav className="mb-10 flex flex-wrap items-center justify-between gap-4"><Link href="/" className="font-mono text-xs font-bold uppercase tracking-[.2em] text-ink"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blood"/>LifeLine</Link><div className="flex gap-5"><Link href="/rapid-delivery" className="text-xs font-semibold text-blood hover:underline">← Rapid Blood Finder</Link><Link href="/" className="text-xs text-ink-50 hover:text-blood">Home</Link></div></nav>
    <header className="mb-9 max-w-3xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-blood">Traceability · Demo module</p><h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-6xl">Every unit has a <span className="font-normal italic text-blood">story.</span></h1><p className="mt-5 max-w-2xl text-sm leading-7 text-ink-60">Each demo reservation from Rapid Blood Finder receives a unique unit ID and appears here automatically.</p></header>
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-900"><strong>Student prototype only.</strong> All unit IDs, banks, dates and statuses are fictional. The QR-style graphic is decorative and is not scannable. This is not a medical record or validated blood traceability system.</div>
    <div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
      <section className="rounded-3xl border border-ink-10 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-blood">Demo unit registry</p><h2 className="mt-2 font-display text-2xl font-semibold">Blood passports</h2></div><span className="rounded-full bg-blood-50 px-3 py-1 text-[10px] font-semibold text-blood">{units.length} records</span></div>
        <div className="space-y-3">{units.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedId(unit.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected.id === unit.id ? "border-blood bg-blood-50/60" : "border-ink-10 bg-white hover:border-ink-20"}`}><div className="flex items-center justify-between gap-3"><span className="break-all font-mono text-xs font-bold text-ink">{unit.id}</span><span className="shrink-0 rounded-full bg-ink-5 px-2.5 py-1 text-[10px] font-semibold text-ink-60">{unit.status}</span></div><p className="mt-2 text-xs text-ink-50">{unit.group} · {unit.component} · {unit.units} unit(s)</p><p className="mt-1 text-[11px] text-ink-40">{unit.bank}</p></button>)}</div>
        <button type="button" onClick={resetDemo} className="mt-5 w-full rounded-xl border border-ink-10 px-4 py-3 text-xs font-semibold text-ink-60 transition hover:border-blood hover:text-blood">Reset generated demo records</button>
      </section>
      <section className="rounded-3xl border border-ink-10 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-widest text-blood">Selected unit passport</p><h2 className="mt-2 break-all font-mono text-lg font-bold text-ink sm:text-xl">{selected.id}</h2><p className="mt-2 text-xs text-ink-50">{selected.bank}</p></div><QRPreview value={selected.id}/></div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Blood group", selected.group], ["Component", selected.component], ["Quantity", `${selected.units} unit(s)`], ["Expiry", selected.expires]].map(([label, value]) => <div key={label} className="rounded-xl bg-clay p-3"><p className="text-[10px] text-ink-40">{label}</p><p className="mt-1 text-xs font-semibold text-ink">{value}</p></div>)}</div>
        <div className="mt-8"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-display text-xl font-semibold">Unit journey</h3><span className="text-[10px] font-semibold uppercase tracking-wider text-blood">Simulated</span></div>{stages.map((stage, index) => { const complete = index <= stageIndex; return <div key={stage} className="flex gap-3"><div className="flex w-6 flex-col items-center"><span className={`z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${complete ? "border-blood bg-blood text-white" : "border-ink-20 bg-white text-ink-40"}`}>{complete ? "✓" : index + 1}</span>{index < stages.length - 1 && <span className={`my-1 min-h-7 w-px flex-1 ${index < stageIndex ? "bg-blood" : "bg-ink-10"}`}/>}</div><div className="pb-5"><p className={`text-sm ${index === stageIndex ? "font-semibold text-ink" : complete ? "text-ink-60" : "text-ink-40"}`}>{stage}</p><p className="mt-1 text-[11px] text-ink-40">{index === stageIndex ? "Current simulated status" : complete ? "Demo stage completed" : "Awaiting next demo step"}</p></div></div>;})}</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#211d1b] p-4 text-white"><div><p className="text-[10px] uppercase tracking-widest text-white/50">Demo control</p><p className="mt-1 text-sm font-semibold">{selected.status === "Handed over" ? "Journey complete" : `Advance to ${stages[Math.min(stageIndex + 1, stages.length - 1)]}`}</p></div><button type="button" onClick={advanceStatus} disabled={stageIndex === stages.length - 1} className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-ink transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{stageIndex === stages.length - 1 ? "Completed ✓" : "Advance status →"}</button></div>
        <p className="mt-4 text-[10px] leading-relaxed text-ink-40">Batch reference: {selected.batch}. Status changes are saved in this browser for the demo. Real blood-component handling, compatibility testing, release and traceability must remain within authorised blood-bank systems.</p>
      </section>
    </div>
  </div></main>;
}
