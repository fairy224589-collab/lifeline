"use client";

import Link from "next/link";

/**
 * Rapid Delivery copy. Every line below maps to something the prototype really does
 * (see components/RapidBloodFinder.tsx and lib/unitPassports.ts) — nothing is invented.
 */
export const RAPID_STAGES = ["Request received", "Searching nearby network", "Inventory identified", "Bank verification", "Reservation locked", "Dispatch preparation", "Handover completed"];
export const PASSPORT_STATUS = ["Available", "Reserved", "Dispatched", "Handed over"];

export default function RapidFeatures() {
  return (
    <div className="rf">
      <p className="rf-eyebrow" data-rf>Rapid delivery</p>
      <h2 className="rf-title" data-rf>Every minute <em>is a decision.</em></h2>
      <p className="rf-lede" data-rf>Rapid Blood Finder searches nearby demo inventory, lets you reserve a unit, and walks the request through seven stages to handover.</p>

      <ol className="rf-stages" data-rf aria-label="Request tracking stages">
        {RAPID_STAGES.map((s, i) => (<li key={s}><span>{String(i + 1).padStart(2, "0")}</span>{s}</li>))}
      </ol>

      <dl className="rf-facts" data-rf>
        <div><dt>Matching</dt><dd>Blood group, component and units are filtered against nearby inventory.</dd></div>
        <div><dt>Reservation</dt><dd>One tap locks a unit and creates a Unit Passport: {PASSPORT_STATUS.join(" → ")}.</dd></div>
        <div><dt>Response timer</dt><dd>A 10-minute demo countdown starts once a unit is reserved.</dd></div>
      </dl>

      <div className="rf-cta" data-rf>
        <Link href="/rapid-delivery" className="rf-btn">Open Rapid Blood Finder <span aria-hidden="true">→</span></Link>
        <Link href="/unit-passport" className="rf-link">View Unit Passport</Link>
      </div>
      <p className="rf-note" data-rf>Prototype with fictional inventory and illustrative distances. It does not track real deliveries or contact hospitals. The animation is illustrative.</p>
    </div>
  );
}
