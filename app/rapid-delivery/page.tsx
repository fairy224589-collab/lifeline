import Link from "next/link";
import RapidBloodFinder from "@/components/RapidBloodFinder";

export default function RapidDeliveryPage() {
  return <main className="min-h-screen bg-clay px-5 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <nav className="mb-12 flex items-center justify-between"><Link href="/" className="font-mono text-xs font-bold uppercase tracking-[.2em] text-ink"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blood"/>LifeLine</Link><Link href="/" className="text-xs text-ink-50 transition hover:text-blood">← Back to home</Link></nav>
      <header className="mb-10 max-w-3xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-blood">Rapid response · Demo experience</p><h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-6xl">Blood, matched with <span className="font-normal italic text-blood">urgency.</span></h1><p className="mt-5 max-w-2xl text-sm leading-7 text-ink-60 sm:text-base">A quick-commerce-inspired interface for finding nearby blood-bank inventory, viewing indicative distance and ETA, and following a reservation journey — all using clearly labelled demo data.</p></header>
      <RapidBloodFinder />
      <p className="mt-12 border-t border-ink-10 pt-6 text-[11px] leading-relaxed text-ink-40">Important: LifeLine is a student prototype. Blood type matching, stock availability, crossmatching, release and transport must be verified by licensed blood-bank and clinical professionals. No actual blood is supplied, dispatched or guaranteed through this demo.</p>
    </div>
  </main>;
}
