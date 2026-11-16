"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

/**
 * A faceless, sculptural figure built from a skeleton: every limb is a group that rotates around its joint.
 * Angles are in degrees, measured "from hanging straight down, positive = towards the way the figure faces".
 * `lean` is forward tilt of the whole body. Draw it facing right; use `flip` to face left.
 */
export type Pose = { lean: number; head: number; rA: [number, number]; lA: [number, number]; rL: [number, number]; lL: [number, number] };
export const STAND: Pose = { lean: 0, head: 0, rA: [6, 4], lA: [-5, 3], rL: [2, 0], lL: [-2, 0] };
export const FIG = { upper: 44, fore: 40, shoulderX: 11, shoulderY: -74, height: 218 };

export type MannequinHandle = { setPose: (p: Partial<Pose>) => void; get: () => Pose };

const TORSO = "M -12 4 C -15 -20 -19 -48 -18 -70 C -18 -80 -10 -86 0 -86 C 10 -86 18 -80 18 -70 C 19 -48 15 -20 12 4 Z";

export const FigureDefs = () => (
  <defs>
    <linearGradient id="mq-lit" gradientUnits="userSpaceOnUse" x1="-24" y1="0" x2="26" y2="0">
      <stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#F1EBE2" /><stop offset="1" stopColor="#C9BFB3" />
    </linearGradient>
    <linearGradient id="mq-back" gradientUnits="userSpaceOnUse" x1="-24" y1="0" x2="26" y2="0">
      <stop offset="0" stopColor="#E4DCD1" /><stop offset="1" stopColor="#A89E94" />
    </linearGradient>
    <filter id="mq-fx" x="-30%" y="-20%" width="160%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#000" floodOpacity=".55" />
      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#E0485E" floodOpacity=".22" />
    </filter>
  </defs>
);

const Mannequin = forwardRef<MannequinHandle, { initial?: Pose }>(function Mannequin({ initial = STAND }, ref) {
  const pose = useRef<Pose>({ ...initial });
  const g = useRef<Record<string, SVGGElement | null>>({});
  const reg = (k: string) => (el: SVGGElement | null) => { g.current[k] = el; };

  const apply = () => {
    const p = pose.current, n = g.current;
    n.torso?.setAttribute("transform", `rotate(${p.lean})`);
    n.head?.setAttribute("transform", `rotate(${p.head} 0 -90)`);
    n.rA1?.setAttribute("transform", `translate(${FIG.shoulderX} ${FIG.shoulderY}) rotate(${-p.rA[0]})`);
    n.rA2?.setAttribute("transform", `translate(0 ${FIG.upper}) rotate(${-p.rA[1]})`);
    n.lA1?.setAttribute("transform", `translate(${-FIG.shoulderX} ${FIG.shoulderY}) rotate(${-p.lA[0]})`);
    n.lA2?.setAttribute("transform", `translate(0 ${FIG.upper}) rotate(${-p.lA[1]})`);
    n.rL1?.setAttribute("transform", `translate(6 2) rotate(${-p.rL[0]})`);
    n.rL2?.setAttribute("transform", `translate(0 52) rotate(${-p.rL[1]})`);
    n.lL1?.setAttribute("transform", `translate(-6 2) rotate(${-p.lL[0]})`);
    n.lL2?.setAttribute("transform", `translate(0 52) rotate(${-p.lL[1]})`);
  };
  useImperativeHandle(ref, () => ({
    setPose: (p) => { pose.current = { ...pose.current, ...p }; apply(); },
    get: () => pose.current,
  }));
  // paint initial pose on first render
  const first = useRef(true);
  const initRef = (el: SVGGElement | null) => { if (el && first.current) { first.current = false; queueMicrotask(apply); } };

  return (
    <g ref={initRef} filter="url(#mq-fx)">
      {/* back arm + back leg (darker, behind the body) */}
      <g ref={reg("lL1")}><line x1="0" y1="0" x2="0" y2="52" stroke="url(#mq-back)" strokeWidth="13" strokeLinecap="round" />
        <g ref={reg("lL2")}><line x1="0" y1="0" x2="0" y2="50" stroke="url(#mq-back)" strokeWidth="10" strokeLinecap="round" /><ellipse cx="5" cy="52" rx="9" ry="3.8" fill="url(#mq-back)" /></g></g>
      <g ref={reg("torso")}>
        <g ref={reg("lA1")}><line x1="0" y1="0" x2="0" y2={FIG.upper} stroke="url(#mq-back)" strokeWidth="10" strokeLinecap="round" />
          <g ref={reg("lA2")}><line x1="0" y1="0" x2="0" y2={FIG.fore} stroke="url(#mq-back)" strokeWidth="8" strokeLinecap="round" /><ellipse cx="0" cy={FIG.fore + 2} rx="4.3" ry="5.8" fill="url(#mq-back)" /></g></g>
        <path d={TORSO} fill="url(#mq-lit)" />
        <ellipse cx="0" cy="2" rx="14" ry="8" fill="url(#mq-lit)" />
        <g ref={reg("head")}><line x1="0" y1="-82" x2="0" y2="-94" stroke="url(#mq-lit)" strokeWidth="8" strokeLinecap="round" /><ellipse cx="1.5" cy="-104" rx="10" ry="12.5" fill="url(#mq-lit)" /></g>
        <g ref={reg("rA1")}><line x1="0" y1="0" x2="0" y2={FIG.upper} stroke="url(#mq-lit)" strokeWidth="10.5" strokeLinecap="round" />
          <g ref={reg("rA2")}><line x1="0" y1="0" x2="0" y2={FIG.fore} stroke="url(#mq-lit)" strokeWidth="8.5" strokeLinecap="round" /><ellipse cx="0" cy={FIG.fore + 2} rx="4.6" ry="6" fill="url(#mq-lit)" /></g></g>
      </g>
      <g ref={reg("rL1")}><line x1="0" y1="0" x2="0" y2="52" stroke="url(#mq-lit)" strokeWidth="14" strokeLinecap="round" />
        <g ref={reg("rL2")}><line x1="0" y1="0" x2="0" y2="50" stroke="url(#mq-lit)" strokeWidth="10.5" strokeLinecap="round" /><ellipse cx="5" cy="52" rx="9.5" ry="4" fill="url(#mq-lit)" /></g></g>
    </g>
  );
});
export default Mannequin;
