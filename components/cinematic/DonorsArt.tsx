"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import Mannequin, { FigureDefs, MannequinHandle, Pose, STAND } from "./Mannequin";

/**
 * Shared artwork for stages 2 and 3 (viewBox 500×440):
 *   - the hourglass (BEHIND)
 *   - two sculptural figures shaking hands (IN FRONT, the focal point)
 *   - the blood-network (stage 3 only)
 * Everything is driven by CSS variables on the <svg>, so the same component is used by the cinematic
 * overlay (animated by the orchestrator) and by the static "For Donors" section (settled=true).
 *   --dim   hourglass visibility before the droplet arrives
 *   --lit   hourglass illumination        --top / --bot  sand levels       --flow  falling stream
 *   --fig   figures appear (0..1)         --clasp  handshake light
 *   --net   network nodes visible         --edges  network lines drawn
 */
const GLASS = "M 36 26 C 36 94 92 120 94 150 C 92 180 36 206 36 274 L 164 274 C 164 206 108 180 106 150 C 108 120 164 94 164 26 Z";

export const HANDSHAKE_A: Pose = { ...STAND, lean: 3, rA: [35, 55], lA: [-8, 6] };
export const FIG_S = 0.8;
export const FIG_Y = 284;
export const HAND = { x: 250, y: 254 };

export const NODES = {
  B1: { x: 78, y: 96, t: "bank", label: "Blood bank" },
  B2: { x: 428, y: 88, t: "bank", label: "Blood bank" },
  D1: { x: 52, y: 262, t: "donor", label: "Donor" },
  D2: { x: 128, y: 372, t: "donor", label: "Donor" },
  D3: { x: 448, y: 284, t: "donor", label: "Donor" },
  H: { x: 372, y: 372, t: "hospital", label: "Hospital" },
  M: { x: 250, y: 220, t: "hub", label: "LifeLine match" },
} as const;
const EDGES: [keyof typeof NODES, keyof typeof NODES][] = [["B1", "M"], ["B2", "M"], ["D1", "M"], ["D2", "M"], ["D3", "M"], ["M", "H"], ["B1", "D1"], ["D2", "H"], ["D3", "H"], ["B2", "D3"]];
export const ROUTE = "M 428 88 C 360 118 300 168 250 220 C 292 262 338 318 372 372";

export type DonorsArtHandle = { svg: SVGSVGElement | null; a: MannequinHandle | null; b: MannequinHandle | null };

function Sparkle({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) {
  return <path className="da-twinkle" style={{ animationDelay: `${d}s` }} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4Z" fill="#F6D6A8" />;
}

const DonorsArt = forwardRef<DonorsArtHandle, { settled?: boolean; withNetwork?: boolean; label?: string }>(function DonorsArt({ settled = false, withNetwork = false, label }, ref) {
  const svg = useRef<SVGSVGElement>(null);
  const a = useRef<MannequinHandle>(null);
  const b = useRef<MannequinHandle>(null);
  useImperativeHandle(ref, () => ({ get svg() { return svg.current; }, get a() { return a.current; }, get b() { return b.current; } }));

  const vars = settled
    ? { "--dim": 1, "--lit": 1, "--top": 0.72, "--bot": 0.4, "--flow": 1, "--fig": 1, "--clasp": 1, "--net": 0, "--edges": 0 }
    : { "--dim": 0, "--lit": 0, "--top": 0, "--bot": 0, "--flow": 0, "--fig": 0, "--clasp": 0, "--net": 0, "--edges": 0 };
  const poseA = settled ? HANDSHAKE_A : STAND;

  return (
    <svg ref={svg} viewBox="0 0 500 440" className="da-svg" role="img" aria-label={label ?? "An hourglass behind two figures shaking hands: one donor's decision can give someone more time."} style={vars as React.CSSProperties}>
      <defs>
        <clipPath id="da-glass"><path d={GLASS} /></clipPath>
        <radialGradient id="da-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#E0485E" stopOpacity=".55" /><stop offset=".5" stopColor="#A82638" stopOpacity=".2" /><stop offset="1" stopColor="#5E1822" stopOpacity="0" /></radialGradient>
        <linearGradient id="da-sand-top" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="215"><stop offset="0" stopColor="#C21F45" /><stop offset=".42" stopColor="#D43A5B" /><stop offset="1" stopColor="#F0A5B3" /></linearGradient>
        <linearGradient id="da-sand-bot" gradientUnits="userSpaceOnUse" x1="0" y1="256" x2="0" y2="312"><stop offset="0" stopColor="#D43A5B" /><stop offset=".5" stopColor="#E36A82" /><stop offset="1" stopColor="#F4B3BF" /></linearGradient>
        <linearGradient id="da-cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B5304A" /><stop offset="1" stopColor="#6E1A29" /></linearGradient>
        <linearGradient id="da-glasswall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".16" /><stop offset=".5" stopColor="#FFFFFF" stopOpacity=".02" /><stop offset="1" stopColor="#FFFFFF" stopOpacity=".1" /></linearGradient>
        <radialGradient id="da-clasp" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFF3F0" stopOpacity=".95" /><stop offset=".35" stopColor="#FF8EA0" stopOpacity=".5" /><stop offset="1" stopColor="#E0485E" stopOpacity="0" /></radialGradient>
        <radialGradient id="da-hosp" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#E0485E" stopOpacity=".6" /><stop offset="1" stopColor="#E0485E" stopOpacity="0" /></radialGradient>
        <filter id="da-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .05  0 0 0 0 .12  0 0 0 .9 -.28" /></filter>
        <FigureDefs />
      </defs>

      {/* twinkles */}
      <Sparkle x={58} y={58} s={0.9} /><Sparkle x={452} y={170} s={0.7} d={1.1} /><Sparkle x={96} y={332} s={0.6} d={0.6} /><Sparkle x={420} y={400} s={0.8} d={1.7} /><Sparkle x={330} y={40} s={0.6} d={0.9} />

      {/* ── HOURGLASS (behind) ── */}
      <g data-hg style={{ opacity: "calc(0.38 * var(--dim) + 0.62 * var(--lit))" as unknown as number }}>
        <circle cx="250" cy="220" r="190" fill="url(#da-glow)" style={{ opacity: "var(--lit)" as unknown as number }} />
        <g transform="translate(150 70)">
          <path d={GLASS} fill="rgba(34,10,16,.62)" />
          <g clipPath="url(#da-glass)">
            <g style={{ transform: "translateY(calc(var(--top) * -84px))" }}>
              <path d="M 10 150 Q 35 141 60 150 T 110 150 T 160 150 T 210 150 V 290 H 10 Z" fill="url(#da-sand-top)" />
              <path d="M 10 150 Q 35 141 60 150 T 110 150 T 160 150 T 210 150 V 290 H 10 Z" fill="#fff" filter="url(#da-grain)" opacity=".5" />
            </g>
            <g style={{ transform: "translateY(calc(var(--bot) * -72px))" }}>
              <path d="M 10 274 C 55 274 75 258 100 258 C 125 258 145 274 190 274 V 320 H 10 Z" fill="url(#da-sand-bot)" />
              <path d="M 10 274 C 55 274 75 258 100 258 C 125 258 145 274 190 274 V 320 H 10 Z" fill="#fff" filter="url(#da-grain)" opacity=".5" />
            </g>
            <line className="da-stream" x1="100" y1="150" x2="100" y2="262" stroke="#FFC0CB" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 7" style={{ opacity: "var(--flow)" as unknown as number }} />
            <rect x="30" y="20" width="140" height="260" fill="url(#da-glasswall)" />
          </g>
          <path d={GLASS} fill="none" stroke="rgba(250,247,242,.3)" strokeWidth="1.6" />
          <path d={GLASS} fill="none" stroke="#FF9AAA" strokeWidth="2.2" style={{ opacity: "var(--lit)" as unknown as number }} />
          <rect x="24" y="12" width="152" height="14" rx="7" fill="url(#da-cap)" />
          <rect x="24" y="274" width="152" height="14" rx="7" fill="url(#da-cap)" />
          <circle cx="100" cy="150" r="9" fill="#FF9AAA" style={{ opacity: "calc(var(--flow) * .5)" as unknown as number }} />
        </g>
      </g>

      {/* ── FALLING DROPLET (stage 2 hand-off) ── */}
      <path data-drop d="M0 -13 C 7 -3 9 2 9 6 A 9 9 0 0 1 -9 6 C -9 2 -7 -3 0 -13 Z" fill="#C9304B" opacity="0" transform="translate(250 -40)" />

      {/* ── NETWORK (stage 3) ── */}
      {withNetwork && (
        <g data-net>
          {EDGES.map(([p, q], i) => (
            <line key={i} className="da-edge" pathLength={1} x1={NODES[p].x} y1={NODES[p].y} x2={NODES[q].x} y2={NODES[q].y}
              style={{ strokeDashoffset: "calc(1 - var(--edges))" as unknown as number }} />
          ))}
          <path data-route d={ROUTE} fill="none" stroke="#FF6F86" strokeWidth="2.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: "calc(1 - var(--route, 0))" as unknown as number, filter: "drop-shadow(0 0 5px rgba(255,111,134,.8))" }} />
          {Object.entries(NODES).map(([k, n]) => (
            <g key={k} data-node={k} transform={`translate(${n.x} ${n.y})`} style={{ opacity: "var(--net)" as unknown as number }}>
              {n.t === "hospital" && <circle className="da-pulse" r="34" fill="url(#da-hosp)" />}
              {n.t === "hospital" ? (
                <><rect x="-17" y="-17" width="34" height="34" rx="9" fill="#2A0F16" stroke="#FAF7F2" strokeWidth="1.6" /><path d="M-3.5 -9h7v5.5h5.5v7h-5.5v5.5h-7v-5.5h-5.5v-7h5.5z" fill="#E0485E" /></>
              ) : n.t === "hub" ? (
                <><circle r="15" fill="#2A0F16" stroke="#FF9AAA" strokeWidth="1.6" /><path d="M0 -8 C 4.5 -2 6 1 6 3.5 A 6 6 0 0 1 -6 3.5 C -6 1 -4.5 -2 0 -8Z" fill="#E0485E" /></>
              ) : n.t === "bank" ? (
                <><rect x="-13" y="-13" width="26" height="26" rx="7" fill="#2A0F16" stroke="rgba(250,247,242,.8)" strokeWidth="1.4" /><path d="M0 -7 C 3.5 -2 4.8 0.5 4.8 2.6 A 4.8 4.8 0 0 1 -4.8 2.6 C -4.8 0.5 -3.5 -2 0 -7Z" fill="#E0485E" /></>
              ) : (
                <><circle r="11" fill="#2A0F16" stroke="rgba(250,247,242,.8)" strokeWidth="1.4" /><circle cy="-3" r="3" fill="#FAF7F2" /><path d="M-5.5 6.5 C -5 1.5 5 1.5 5.5 6.5Z" fill="#FAF7F2" /></>
              )}
              <text y={n.t === "hospital" ? 32 : 27} textAnchor="middle" className="da-label">{n.label.toUpperCase()}</text>
            </g>
          ))}
          <g data-unit opacity="0" transform="translate(428 88)">
            <circle r="16" fill="url(#da-hosp)" />
            <rect x="-8" y="-10" width="16" height="20" rx="4" fill="#B3243D" stroke="#FFD9DF" strokeWidth="1.4" />
            <path d="M0 -5 C 2.5 -1.5 3.3 0.3 3.3 1.8 A 3.3 3.3 0 0 1 -3.3 1.8 C -3.3 0.3 -2.5 -1.5 0 -5Z" fill="#FFE9EC" />
          </g>
          <g data-particles />
        </g>
      )}

      {/* ── FIGURES (in front — the focal point) ── */}
      <ellipse cx="250" cy="370" rx="120" ry="7" fill="#000" opacity=".35" style={{ opacity: "calc(var(--fig) * .35)" as unknown as number }} />
      <g data-figwrap="A" style={{ opacity: "var(--fig)" as unknown as number, transform: "translateX(calc((1 - var(--fig)) * -70px))" }}>
        <g transform={`translate(${HAND.x - 61} ${FIG_Y}) scale(${FIG_S})`}><Mannequin ref={a} initial={poseA} /></g>
      </g>
      <g data-figwrap="B" style={{ opacity: "var(--fig)" as unknown as number, transform: "translateX(calc((1 - var(--fig)) * 70px))" }}>
        <g transform={`translate(${HAND.x + 61} ${FIG_Y}) scale(${-FIG_S} ${FIG_S})`}><Mannequin ref={b} initial={settled ? { ...HANDSHAKE_A, lean: 3 } : STAND} /></g>
      </g>
      <circle cx={HAND.x} cy={HAND.y} r="22" fill="url(#da-clasp)" style={{ opacity: "var(--clasp)" as unknown as number }} />
    </svg>
  );
});
export default DonorsArt;
