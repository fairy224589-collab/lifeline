"use client";

import { useMemo, useRef } from "react";
import { useInView, useProgress } from "@/lib/useReveal";

/**
 * About — droplets assemble into one larger droplet: each dot is a person, each square an institution.
 * No organisational history, awards or statistics are claimed. LifeLine is described honestly as a college prototype.
 */
function lattice() {
  const pts: { x: number; y: number }[] = [];
  const s = 0.2;
  for (let r = 0, y = -0.95; y <= 0.95; y += s * 0.866, r++) {
    for (let x = -0.9 + (r % 2 ? s / 2 : 0); x <= 0.9; x += s) {
      const inCircle = x * x + (y - 0.28) * (y - 0.28) <= 0.66 * 0.66;
      const inTop = y <= 0.28 && y >= -0.98 && Math.abs(x) <= (0.66 * (y + 0.98)) / 1.26 * 0.98;
      if (inCircle || inTop) pts.push({ x, y });
    }
  }
  return pts;
}

const BLOCKS = [
  { h: "Why LifeLine exists", t: "When a hospital needs a particular blood group quickly, the search can depend on phone calls and scattered lists. LifeLine is a college prototype exploring what it would look like to bring hospitals, donors and blood banks into one matching system." },
  { h: "Mission", t: "Make compatible blood easier to find, and make the reasoning behind every match easy to see." },
  { h: "Vision", t: "A network where the right unit or donor is identified quickly, and every step from request to handover is visible to the people who need it." },
  { h: "The problem it addresses", t: "An urgent request has to weigh blood-group compatibility, availability, distance and expiry all at once, under time pressure. LifeLine applies those rules consistently and shows its working." },
  { h: "How it connects people", t: "Hospitals raise requests. Donors volunteer and share their availability. Blood banks list their stock. The matching engine ranks only the safe, compatible candidates." },
  { h: "The human impact", t: "Behind every request is a patient and a family; behind every unit is a donor. The technology is there to shorten the distance between them." },
];

export default function AboutSection() {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, 0.2);
  const p = useProgress(seen, "about", 2600);
  const pts = useMemo(lattice, []);
  const links = useMemo(() => { const l: [number, number][] = []; pts.forEach((a, i) => pts.forEach((b, j) => { if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < 0.235) l.push([i, j]); })); return l; }, [pts]);
  const sx = (x: number) => 150 + x * 130, sy = (y: number) => 160 + y * 128;
  return (
    <section id="about" ref={ref} className="scroll-mt-24">
      <div className="ab-grid">
        <figure className="ab-art">
          <svg viewBox="0 0 300 320" role="img" aria-label="Many small droplets and squares joined together to form one large droplet, representing people and institutions working together">
            {links.map(([i, j], k) => (<line key={k} x1={sx(pts[i].x)} y1={sy(pts[i].y)} x2={sx(pts[j].x)} y2={sy(pts[j].y)} stroke="#7A1F2B" strokeWidth=".7" opacity={Math.max(0, Math.min(0.35, (p - 0.35) * 0.9))} />))}
            {pts.map((q, i) => {
              const vis = Math.max(0, Math.min(1, p * 1.6 - i / pts.length * 0.9)); const inst = i % 7 === 3;
              return inst
                ? <rect key={i} x={sx(q.x) - 4.5} y={sy(q.y) - 4.5} width="9" height="9" rx="2.5" fill="#FAF7F2" stroke="#7A1F2B" strokeWidth="1.4" opacity={vis} transform={`scale(${0.4 + 0.6 * vis})`} style={{ transformOrigin: `${sx(q.x)}px ${sy(q.y)}px` }} />
                : <path key={i} d="M0 -6 C3 -1.5 4 .5 4 2 A4 4 0 0 1 -4 2 C-4 .5 -3 -1.5 0 -6Z" fill={i % 3 ? "#C9304B" : "#7A1F2B"} opacity={vis} transform={`translate(${sx(q.x)} ${sy(q.y)}) scale(${0.4 + 0.6 * vis})`} />;
            })}
          </svg>
          <figcaption><span><i className="ab-dot" /> people</span><span><i className="ab-sq" /> hospitals &amp; blood banks</span></figcaption>
        </figure>
        <div className="ab-text">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-blood">About us</p>
          <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl leading-tight">A network made of <em className="text-blood">people.</em></h2>
          <div className="ab-blocks">{BLOCKS.map((b) => (<div key={b.h}><h3>{b.h}</h3><p>{b.t}</p></div>))}</div>
          <p className="ab-note">LifeLine is a college project prototype that uses fictional demo data. It is not a medical device and does not replace clinical or blood-bank verification.</p>
        </div>
      </div>
    </section>
  );
}
