"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cancel, clamp, ease, pause, tween } from "@/lib/cine";
import { useInView, useReducedMotion } from "@/lib/useReveal";

/**
 * LIVE DEMO — a constellation that explains the real LifeLine workflow.
 * The star path is modelled on the Aries reference: a long, gently rising stroke, a sharp bend, then a drop to a tip.
 * Each star is one real step of the prototype (see lib/matchingEngine.ts, app/api/match, Rapid Blood Finder, Unit Passport).
 */
const STEPS = [
  { t: "Hospital raises a request", d: "A verified hospital enters the blood group, units needed, urgency and location in the Hospital Portal.", link: { href: "/hospital", label: "Open Hospital Portal" } },
  { t: "Request enters matching", d: "The server validates the request, then hands it to the matching engine." },
  { t: "Compatibility check", d: "ABO and Rh compatibility rules remove every donor or unit that is not safely compatible. This is a hard filter that runs before any scoring." },
  { t: "Candidates identified", d: "Only available donors and non-expired blood-bank stock that passed the filter remain as candidates." },
  { t: "Weighted scoring", d: "Each candidate is scored: urgency 35%, proximity 30%, shelf expiry 20%, donor reliability 15%. The result is a ranked list." },
  { t: "Best match surfaced", d: "The hospital sees the ranked matches with each score broken down, so the choice can be understood." },
  { t: "Confirm and lock", d: "When the hospital confirms, a first-confirmed lock reserves that source and releases the others." },
  { t: "Tracked to handover", d: "The request moves through its tracking stages. A Unit Passport follows the unit: Available → Reserved → Dispatched → Handed over.", link: { href: "/rapid-delivery", label: "Try Rapid Blood Finder" } },
];
const SHORT = ["Request", "Matching", "Compatibility", "Candidates", "Scoring", "Best match", "Lock", "Handover"];

// Aries-shaped paths. Desktop: wide. Mobile: the same shape turned to run top-to-bottom.
const DESK = { w: 1000, h: 520, pts: [[120, 170], [288, 152], [450, 132], [560, 192], [660, 254], [700, 316], [726, 376], [712, 432]] as [number, number][] };
const MOB = { w: 360, h: 500, pts: [[84, 66], [100, 134], [116, 202], [172, 256], [228, 308], [246, 360], [258, 410], [300, 438]] as [number, number][] };

function rnd(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const star = (r: number) => `M0 ${-r} L${r * 0.2} ${-r * 0.2} L${r} 0 L${r * 0.2} ${r * 0.2} L0 ${r} L${-r * 0.2} ${r * 0.2} L${-r} 0 L${-r * 0.2} ${-r * 0.2}Z`;

export default function LiveDemoSection() {
  const root = useRef<HTMLElement>(null);
  const seen = useInView(root, 0.35);
  const reduced = useReducedMotion();
  const [wide, setWide] = useState(true);
  const [t, setT] = useState(0);          // 0..7 — whole part = stars reached, fraction = line being drawn
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const token = useRef<Cancel>({ cancelled: false });
  const started = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const f = () => setWide(mq.matches); f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => () => { token.current.cancelled = true; }, []);

  const G = wide ? DESK : MOB;
  const bg = useMemo(() => { const r = rnd(42); return Array.from({ length: wide ? 120 : 70 }, () => ({ x: r() * G.w, y: r() * G.h * 0.82, s: 0.4 + r() * 1.1, d: r() * 4 })); }, [wide]); // eslint-disable-line

  async function play() {
    token.current.cancelled = true;
    const c: Cancel = { cancelled: false }; token.current = c;
    setPlaying(true); setT(0); setActive(0);
    await pause(500, c);
    for (let i = 0; i < 7 && !c.cancelled; i++) {
      setActive(i);
      await pause(i === 0 ? 1400 : 1250, c);                    // time to read this stage
      if (c.cancelled) return;
      await tween(950, (p) => setT(i + p), ease.inOut2, c);     // line draws, particle travels
    }
    if (!c.cancelled) { setActive(7); setPlaying(false); }
  }
  function reset() { token.current.cancelled = true; setPlaying(false); setT(0); setActive(0); }
  function select(i: number) { token.current.cancelled = true; setPlaying(false); setT((v) => Math.max(Math.floor(v), i)); setActive(i); }

  useEffect(() => {
    if (!seen || started.current) return;
    started.current = true;
    if (reduced) { setT(7); setActive(7); } else play();
  }, [seen, reduced]); // eslint-disable-line

  const reached = Math.floor(t + 0.0001);
  const step = STEPS[active];
  const pe = Math.min(6, Math.floor(t)); const pf = t - pe;
  const particle = playing && t < 7 && pf > 0 && pf < 1 ? { x: G.pts[pe][0] + (G.pts[pe + 1][0] - G.pts[pe][0]) * pf, y: G.pts[pe][1] + (G.pts[pe + 1][1] - G.pts[pe][1]) * pf } : null;

  return (
    <section id="live-demo" ref={root} className="fullbleed sec-dark sec-night scroll-mt-0" aria-label="Live demo: the LifeLine workflow as a constellation">
      <div className="ld-wrap">
        <div className="ld-head">
          <p className="rf-eyebrow">Live demo</p>
          <h2 className="rf-title">Follow a request <em>across the sky.</em></h2>
          <p className="ld-badge"><span aria-hidden="true" />Simulated walkthrough of the real workflow · no live data</p>
        </div>

        <div className="ld-grid">
          <div className="ld-sky">
            <svg viewBox={`0 0 ${G.w} ${G.h}`} role="group" aria-label="Constellation of eight stars, one per workflow stage">
              <defs>
                <radialGradient id="ld-glow"><stop offset="0" stopColor="#FFB3BE" stopOpacity=".95" /><stop offset=".35" stopColor="#E0485E" stopOpacity=".38" /><stop offset="1" stopColor="#E0485E" stopOpacity="0" /></radialGradient>
                <linearGradient id="ld-hor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7A2A2E" stopOpacity="0" /><stop offset="1" stopColor="#C4553D" stopOpacity=".55" /></linearGradient>
              </defs>
              <rect x="0" y={G.h * 0.62} width={G.w} height={G.h * 0.38} fill="url(#ld-hor)" />
              {bg.map((s, i) => (<circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#FAF7F2" opacity=".7" className="ld-tw" style={{ animationDelay: `${s.d}s` }} />))}
              <path d={`M0 ${G.h} L0 ${G.h - 26} L40 ${G.h - 34} L66 ${G.h - 22} L110 ${G.h - 40} L150 ${G.h - 24} L210 ${G.h - 36} L270 ${G.h - 20} L340 ${G.h - 38} L420 ${G.h - 26} L520 ${G.h - 34} L600 ${G.h - 22} L700 ${G.h - 36} L790 ${G.h - 24} L880 ${G.h - 34} L${G.w} ${G.h - 22} L${G.w} ${G.h}Z`} fill="#0A0406" />

              {/* lines */}
              {G.pts.slice(0, 7).map((a, i) => { const b = G.pts[i + 1]; const pr = clamp(t - i); return (
                <g key={i}>
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(250,247,242,.12)" strokeWidth="1" strokeDasharray="3 5" />
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#FFC9D1" strokeWidth="1.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - pr} style={{ filter: "drop-shadow(0 0 4px rgba(255,120,140,.9))" }} />
                </g>); })}
              {particle && <circle cx={particle.x} cy={particle.y} r="3.4" fill="#fff" style={{ filter: "drop-shadow(0 0 6px #FF6F86) drop-shadow(0 0 12px #E0485E)" }} />}

              {/* stars */}
              {G.pts.map(([x, y], i) => {
                const lit = reached >= i, isActive = active === i, isEnd = i === 7;
                const r = (isEnd ? 17 : i === 2 ? 14 : 11) * (isActive ? 1.25 : 1);
                return (
                  <g key={i} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`Stage ${i + 1} of 8: ${STEPS[i].t}`} aria-pressed={isActive} className="ld-star"
                     onClick={() => select(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } }}>
                    <circle r={wide ? 26 : 22} fill="transparent" />
                    <circle r={r * (isEnd && lit ? 4 : 3)} pointerEvents="none" fill="url(#ld-glow)" opacity={lit ? (isActive || isEnd ? 1 : 0.55) : 0} style={{ transition: "opacity .5s, r .5s" }} />
                    <path pointerEvents="none" d={star(r)} fill={lit ? "#FFF3F0" : "rgba(250,247,242,.28)"} style={{ transition: "fill .5s", filter: lit ? "drop-shadow(0 0 5px rgba(255,150,165,.9))" : "none" }} />
                    <path pointerEvents="none" d={star(r * 0.62)} transform="rotate(45)" fill={lit ? "#FFF3F0" : "rgba(250,247,242,.2)"} />
                    {isActive && <circle pointerEvents="none" r={r + 9} fill="none" stroke="#FF8EA0" strokeWidth="1.2" className="ld-ring" />}
                    <text y={r + 22} textAnchor="middle" className="ld-num" style={{ fontSize: wide ? 15 : 11 }}>{i + 1}{wide ? ` · ${SHORT[i]}` : ""}</text>
                  </g>
                );
              })}
            </svg>
            <p className="ld-hint">{wide ? "Select any star to read its stage." : "Tap a star to read its stage."}</p>
          </div>

          <div className="ld-card" aria-live="polite">
            <p className="ld-step">Stage {active + 1} of 8{active === 7 ? " · destination" : ""}</p>
            <h3 key={active} className="ld-title">{step.t}</h3>
            <p key={`d${active}`} className="ld-desc">{step.d}</p>
            {step.link && <Link href={step.link.href} className="rf-btn ld-link">{step.link.label} <span aria-hidden="true">→</span></Link>}
            <div className="ld-ctrl">
              <button type="button" className="ld-btn" onClick={() => select(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous stage">←</button>
              <button type="button" className="ld-btn" onClick={() => select(Math.min(7, active + 1))} disabled={active === 7} aria-label="Next stage">→</button>
              <button type="button" className="ld-btn ld-btn-main" onClick={play}>{playing ? "Restart" : t >= 7 ? "Replay journey" : "Play journey"}</button>
              <button type="button" className="ld-btn" onClick={reset}>Reset</button>
            </div>
            <p className="rf-note">The real tools: <Link href="/hospital" className="ld-a">Hospital Portal</Link> · <Link href="/rapid-delivery" className="ld-a">Rapid Blood Finder</Link> · <Link href="/unit-passport" className="ld-a">Unit Passport</Link></p>
          </div>
        </div>
      </div>
    </section>
  );
}
