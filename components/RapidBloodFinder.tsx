"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createUnitId, readUnitPassports, saveUnitPassports, UnitPassportRecord } from "@/lib/unitPassports";
import { readWorkspace, writeWorkspace, addDemoNotification } from "@/lib/demoWorkspace";

type Stock = {
  id: string;
  name: string;
  area: string;
  distance: string;
  groups: string[];
  units: number;
  component: string;
  eta: string;
};

// Fictional records for the student demo only. Never use these as real stock data.
const DEMO_STOCK: Stock[] = [
  { id: "bank-01", name: "CityCare Blood Centre", area: "Lajpat Nagar, Delhi", distance: "2.4 km", groups: ["A+", "B+", "O+", "AB+"], units: 4, component: "Whole blood", eta: "18–25 min" },
  { id: "bank-02", name: "Red Cross Demo Blood Bank", area: "South Extension, Delhi", distance: "4.1 km", groups: ["O-", "O+", "B-", "B+"], units: 2, component: "Packed red cells", eta: "25–35 min" },
  { id: "bank-03", name: "Metro Hospital Blood Centre", area: "Saket, Delhi", distance: "6.8 km", groups: ["A+", "A-", "B+", "AB-"], units: 6, component: "Platelets", eta: "30–40 min" },
  { id: "bank-04", name: "Community Demo Blood Centre", area: "Greater Kailash, Delhi", distance: "5.2 km", groups: ["A+", "B+", "O+"], units: 3, component: "Plasma", eta: "28–38 min" },
];

const steps = ["Request received", "Searching nearby network", "Inventory identified", "Bank verification", "Reservation locked", "Dispatch preparation", "Handover completed"];

export default function RapidBloodFinder() {
  const [group, setGroup] = useState("B+");
  const [component, setComponent] = useState("Whole blood");
  const [units, setUnits] = useState("2");
  const [location, setLocation] = useState("South Delhi");
  const [searched, setSearched] = useState(false);
  const [reserved, setReserved] = useState<string | null>(null);
  const [reservedUnitId, setReservedUnitId] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [seconds, setSeconds] = useState(600);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLElement | null>(null);

  const matches = useMemo(
    () => DEMO_STOCK.filter((item) => item.groups.includes(group) && item.component === component && item.units >= Number(units)),
    [group, component, units],
  );

  useEffect(() => {
    if (!reserved || stage >= steps.length - 1) return;
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [reserved, stage]);

  useEffect(() => {
    if (!reserved || stage >= steps.length - 1) return;
    const timer = window.setTimeout(() => setStage((current) => Math.min(current + 1, steps.length - 1)), 4500);
    return () => window.clearTimeout(timer);
  }, [reserved, stage]);

  function startSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedUnits = Number(units);
    if (!Number.isInteger(requestedUnits) || requestedUnits < 1 || requestedUnits > 10) {
      setError("Enter a whole number of units between 1 and 10.");
      setSearched(false);
      return;
    }
    if (!location.trim()) {
      setError("Enter an area or PIN code to continue.");
      setSearched(false);
      return;
    }
    setError("");
    setReserved(null);
    setStage(0);
    setSeconds(600);
    setNotice("");
    setSearched(true);
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function reserve(id: string) {
    const stock = DEMO_STOCK.find((item) => item.id === id);
    if (!stock) return;
    const unitId = createUnitId();
    const record: UnitPassportRecord = {
      id: unitId, bank: stock.name, group, component, units: Number(units),
      collected: new Date(Date.now() - 3 * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      expires: new Date(Date.now() + 25 * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Reserved", batch: `DEMO-${unitId.slice(-6)}`, createdAt: new Date().toISOString(), source: "rapid-finder",
    };
    const existing = readUnitPassports();
    saveUnitPassports([record, ...existing.filter((item) => item.id !== unitId)]);
    const workspace = readWorkspace();
    const requestId = `REQ-${Date.now().toString().slice(-8)}`;
    workspace.requests.unshift({ id: requestId, bloodGroup: group, component, units: Number(units), location, status: "Reservation created", unitId, createdAt: new Date().toISOString() });
    writeWorkspace(workspace);
    addDemoNotification("Demo reservation created", `${requestId} · ${unitId} · ${group} ${component}`);
    setReservedUnitId(unitId);
    setReserved(id);
    setStage(0);
    setSeconds(600);
    setNotice("Demo reservation created. A licensed blood bank and clinical team must independently verify compatibility, availability and release.");
  }

  const clock = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-ink-10 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-blood">Rapid Blood Finder</p><h2 className="mt-2 font-display text-2xl font-semibold">Find nearby supply.</h2></div>
            <span className="rounded-full bg-blood-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blood">Demo mode</span>
          </div>
          <form onSubmit={startSearch} className="space-y-4">
            <label className="block text-xs font-semibold text-ink-60">Blood group
              <select value={group} onChange={(e) => setGroup(e.target.value)} className="mt-2 w-full rounded-xl border border-ink-10 bg-clay px-4 py-3 text-sm text-ink outline-none focus:border-blood">{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-ink-60">Blood component
              <select value={component} onChange={(e) => setComponent(e.target.value)} className="mt-2 w-full rounded-xl border border-ink-10 bg-clay px-4 py-3 text-sm text-ink outline-none focus:border-blood">{["Whole blood", "Packed red cells", "Platelets", "Plasma"].map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-ink-60">Units needed<input type="number" min="1" max="10" step="1" value={units} onChange={(e) => setUnits(e.target.value)} className="mt-2 w-full rounded-xl border border-ink-10 bg-clay px-4 py-3 text-sm outline-none focus:border-blood" /></label>
              <label className="block text-xs font-semibold text-ink-60">Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area / PIN code" className="mt-2 w-full rounded-xl border border-ink-10 bg-clay px-4 py-3 text-sm outline-none focus:border-blood" /></label>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" className="w-full rounded-xl bg-blood px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blood-light focus:outline-none focus:ring-2 focus:ring-blood focus:ring-offset-2">Search nearby inventory <span aria-hidden>→</span></button>
            <p className="text-[11px] leading-relaxed text-ink-40">This is a school-project simulation using fictional inventory and illustrative distances. It does not contact hospitals or reserve real blood.</p>
          </form>
        </section>

        <section className="rounded-3xl border border-ink-10 bg-[#211d1b] p-6 text-white shadow-sm sm:p-8">
          <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-red-300">Network pulse</p><h2 className="mt-2 font-display text-2xl">From request to handover.</h2></div><span className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/60">Illustrative flow</span></div>
          <div className="mt-8 space-y-4">{steps.map((label, index) => <div key={label} className="flex items-center gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${reserved && index <= stage ? "border-red-300 bg-red-400 text-white" : "border-white/20 text-white/40"}`}>{reserved && index < stage ? "✓" : String(index + 1).padStart(2, "0")}</span><span className={`text-sm ${reserved && index === stage ? "font-semibold text-white" : "text-white/55"}`}>{label}</span>{reserved && index === stage && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-red-300" />}</div>)}</div>
          {reserved ? <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/60">Demo response target timer</span><strong className="font-mono text-2xl text-red-200">{clock}</strong></div><p className="mt-2 text-[11px] leading-relaxed text-white/50">A UI countdown only — not a delivery promise or a clinical service-level guarantee.</p>{reservedUnitId && <div className="mt-4 border-t border-white/10 pt-4"><p className="text-[10px] uppercase tracking-widest text-white/45">Generated blood unit ID</p><p className="mt-1 break-all font-mono text-sm font-bold text-white">{reservedUnitId}</p><Link href={`/unit-passport?id=${encodeURIComponent(reservedUnitId)}`} className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink hover:bg-red-50">View unit passport →</Link></div>}</div> : <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/55">Select a blood requirement and search to preview the matching and reservation journey.</div>}
        </section>
      </div>

      {searched && <section ref={resultsRef} aria-live="polite" className="scroll-mt-6 space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-blood">Nearby demo inventory</p><h2 className="mt-1 font-display text-2xl font-semibold">{matches.length} possible network matches</h2></div><p className="text-xs text-ink-40">{group} · {component} · {units} units · {location}</p></div>
        {matches.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matches.map((item) => <article key={item.id} className="rounded-2xl border border-ink-10 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">{item.name}</h3><p className="mt-1 text-xs text-ink-50">{item.area}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Demo verified</span></div><div className="mt-5 grid grid-cols-3 gap-2 border-y border-ink-10 py-4"><div><p className="text-[10px] text-ink-40">Distance</p><p className="mt-1 text-sm font-semibold">{item.distance}</p></div><div><p className="text-[10px] text-ink-40">Sample stock</p><p className="mt-1 text-sm font-semibold">{item.units} units</p></div><div><p className="text-[10px] text-ink-40">Indicative ETA</p><p className="mt-1 text-sm font-semibold">{item.eta}</p></div></div><p className="mt-3 text-[11px] text-ink-50">Illustrative component: {item.component}</p><button type="button" onClick={() => reserve(item.id)} disabled={!!reserved} className="mt-4 w-full rounded-xl border border-blood bg-blood px-4 py-3 text-xs font-semibold text-white transition hover:bg-blood-light disabled:cursor-not-allowed disabled:opacity-50">{reserved === item.id ? "Demo reservation active ✓" : "Reserve in demo"}</button></article>)}</div> : <div className="rounded-2xl border border-dashed border-ink-20 bg-white p-8 text-center"><p className="font-semibold">No sample inventory match</p><p className="mt-1 text-xs text-ink-50">Try another group, component or a smaller unit quantity. This prototype only searches fictional sample records.</p></div>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800">{notice}</p>}
      </section>}
    </div>
  );
}
