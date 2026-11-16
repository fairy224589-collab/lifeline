"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Mannequin, { FigureDefs, FIG, MannequinHandle, STAND } from "./Mannequin";
import { Cancel, ease, ik, lerp, tween } from "@/lib/cine";

/**
 * The big dramatic clock (video 3, recoloured to burgundy/charcoal/ivory) with a white figure
 * bracing against the minute hand. The figure is posed by inverse kinematics every frame so its
 * hands really stay on the hand as it moves.
 */
const C = { x: 200, y: 200 };
const HAND_LEN = 150;
const PUSH_AT = 104; // how far along the hand the figure pushes
const FIG_X = 236, FIG_Y = 358, S = 0.74; // figure's pelvis x and feet-line (SVG units)
const PELVIS_Y = FIG_Y - 102 * S;

export type ClockHandle = { play: (c: Cancel, opts?: { fast?: boolean }) => Promise<void>; loop: (c: Cancel) => void; setHand: (deg: number) => void; svg: SVGSVGElement | null };

const ClockArt = forwardRef<ClockHandle, { static?: boolean }>(function ClockArt({ static: isStatic }, ref) {
  const hand = useRef<SVGGElement>(null);
  const fig = useRef<MannequinHandle>(null);
  const svg = useRef<SVGSVGElement>(null);

  // clock angle (0 = 12 o'clock, clockwise) → hand rotation + figure pose
  const setHand = (deg: number, braced = 0) => {
    hand.current?.setAttribute("transform", `rotate(${deg} ${C.x} ${C.y})`);
    const r = (deg * Math.PI) / 180;
    const tx = C.x + PUSH_AT * Math.sin(r), ty = C.y - PUSH_AT * Math.cos(r);
    // target in the figure's local space (figure faces right, scaled by S, torso leaning `lean`)
    const lean = 16 + braced * 8;
    const lx = (tx - FIG_X) / S, ly = (ty - PELVIS_Y) / S;
    const a = (lean * Math.PI) / 180; // undo the torso lean (rotate by -lean)
    const ux = lx * Math.cos(a) - ly * Math.sin(a), uy = lx * Math.sin(a) + ly * Math.cos(a);
    const r1 = ik(FIG.shoulderX, FIG.shoulderY, ux, uy - 2, FIG.upper, FIG.fore);
    const l1 = ik(-FIG.shoulderX, FIG.shoulderY, ux - 4, uy + 4, FIG.upper, FIG.fore);
    fig.current?.setPose({
      lean, head: -4,
      rA: [r1.a1, r1.a2], lA: [l1.a1, l1.a2],
      rL: [26 + braced * 4, -24], lL: [-28 - braced * 6, 4], // wide braced stance: front knee bent, back leg driving
    });
  };

  const play = async (c: Cancel, opts?: { fast?: boolean }) => {
    const k = opts?.fast ? 0.6 : 1;
    // The hand ticks forward, the figure pushes it back, it gives way, ticks again: a visible struggle.
    const seq: [number, number, number][] = [ // [target degrees, ms, bracing]
      [100, 700, 0], [112, 420, 0.4], [107, 520, 1], [124, 900, 0.7], [120, 480, 1], [138, 1000, 0.5],
    ];
    let cur = 92;
    setHand(cur);
    for (const [to, ms, br] of seq) {
      if (c.cancelled) return;
      const from = cur;
      await tween(ms * k, (p) => setHand(lerp(from, to, p), br), to < from ? ease.out3 : ease.inOut2, c);
      cur = to;
    }
  };

  // idle loop used on the page: slow ticks forward with small push-backs
  const loop = (c: Cancel) => {
    let cur = 138;
    const run = async () => {
      while (!c.cancelled) {
        const to = cur + 9, from = cur;
        await tween(1400, (p) => setHand(lerp(from, to, p), 0.6 + 0.4 * Math.sin(p * Math.PI)), ease.inOut2, c);
        if (c.cancelled) return;
        const back = to - 4;
        await tween(800, (p) => setHand(lerp(to, back, p), 1), ease.out3, c);
        cur = back > 200 ? 100 : back;
      }
    };
    run();
  };

  useImperativeHandle(ref, () => ({ play, loop, setHand: (d) => setHand(d), get svg() { return svg.current; } }));

  useEffect(() => { if (isStatic) setHand(138, 0.5); else setHand(92); }, [isStatic]); // eslint-disable-line

  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <svg ref={svg} viewBox="0 0 400 400" className="clock-svg" role="img" aria-label="A large clock face with a figure straining to hold back the minute hand — a picture of time pressure.">
      <defs>
        <radialGradient id="ck-dial" cx=".5" cy=".45" r=".6"><stop offset="0" stopColor="#3A1C23" /><stop offset=".7" stopColor="#24121A" /><stop offset="1" stopColor="#170B10" /></radialGradient>
        <linearGradient id="ck-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B5304A" /><stop offset=".5" stopColor="#5E1822" /><stop offset="1" stopColor="#2A0F16" /></linearGradient>
        <filter id="ck-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="9" /><feColorMatrix values="0 0 0 0 1  0 0 0 0 .92  0 0 0 0 .88  0 0 0 .5 -.18" /></filter>
        <clipPath id="ck-clip"><circle cx="200" cy="200" r="176" /></clipPath>
        <FigureDefs />
      </defs>
      <circle cx="200" cy="200" r="188" fill="url(#ck-rim)" />
      <circle cx="200" cy="200" r="176" fill="url(#ck-dial)" stroke="rgba(0,0,0,.5)" strokeWidth="2" />
      <g clipPath="url(#ck-clip)"><rect x="0" y="0" width="400" height="400" fill="#fff" filter="url(#ck-grain)" opacity=".35" /></g>
      {ticks.map((i) => {
        const big = i % 5 === 0, a = (i * 6 * Math.PI) / 180, r1 = big ? 150 : 160, r2 = 168;
        return <line key={i} x1={200 + r1 * Math.sin(a)} y1={200 - r1 * Math.cos(a)} x2={200 + r2 * Math.sin(a)} y2={200 - r2 * Math.cos(a)} stroke={big ? "#FAF7F2" : "rgba(250,247,242,.42)"} strokeWidth={big ? 2.4 : 1.1} strokeLinecap="round" />;
      })}
      {/* hour hand (still) */}
      <g transform={`rotate(300 ${C.x} ${C.y})`}><path d={`M ${C.x - 4} ${C.y} L ${C.x} ${C.y - 100} L ${C.x + 4} ${C.y} Z`} fill="rgba(250,247,242,.55)" /></g>
      {/* minute hand — the one being pushed */}
      <g ref={hand}>
        <path d={`M ${C.x - 5} ${C.y + 14} L ${C.x - 2.2} ${C.y - HAND_LEN} L ${C.x + 2.2} ${C.y - HAND_LEN} L ${C.x + 5} ${C.y + 14} Z`} fill="#E0485E" style={{ filter: "drop-shadow(0 0 6px rgba(224,72,94,.7))" }} />
      </g>
      <circle cx="200" cy="200" r="9" fill="#FAF7F2" /><circle cx="200" cy="200" r="3.5" fill="#5E1822" />
      {/* the figure, bracing at the bottom of the dial */}
      <ellipse cx={FIG_X + 6} cy={FIG_Y + 2} rx="34" ry="4" fill="#000" opacity=".45" />
      <g transform={`translate(${FIG_X} ${PELVIS_Y}) scale(${S})`}><Mannequin ref={fig} initial={STAND} /></g>
    </svg>
  );
});
export default ClockArt;
