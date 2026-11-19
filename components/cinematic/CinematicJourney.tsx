"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLiquid } from "@/lib/liquid";
import { Cancel, ease, followPath, lerp, nextFrame, pause, tween } from "@/lib/cine";
import { STEPS } from "@/components/HowItWorks";
import DonorsArt, { DonorsArtHandle, HANDSHAKE_A, NODES } from "./DonorsArt";
import { STAND } from "./Mannequin";
import ClockArt, { ClockHandle } from "./ClockArt";
import DonorsCopy from "./DonorsCopy";
import RapidFeatures from "./RapidFeatures";

const TITLE = "From emergency request to confirmed match.";

/**
 * THE ONE-CLICK JOURNEY:  Home → How It Works → For Donors → Rapid Delivery.
 *
 * One async function (`run`) plays the three stages one after another. Each step awaits the
 * completion promise of the previous one (liquid canvas promise, Web-Animations `.finished`,
 * tween promises) — nothing starts on a guessed timer. The only deliberate waits are short
 * "reading pauses" so each message can land.
 *
 * Skip / Esc / unmount set `cancel.cancelled`, which every tween checks, so everything stops safely.
 * At the end the overlay fades out over the real #rapid-delivery section, which has the identical
 * composition, so the hand-off is seamless and the visitor keeps normal scrolling.
 */
export default function CinematicJourney({ onClose, targetId = "rapid-delivery" }: { onClose: () => void; targetId?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgD = useRef<HTMLDivElement>(null);
  const bgR = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const clockWrap = useRef<HTMLDivElement>(null);
  const scene1 = useRef<HTMLDivElement>(null);
  const t2 = useRef<HTMLDivElement>(null);
  const t3 = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLParagraphElement>(null);
  const tnet = useRef<HTMLDivElement>(null);
  const art = useRef<DonorsArtHandle>(null);
  const clock = useRef<ClockHandle>(null);
  const [filled, setFilled] = useState(false);
  const [phase, setPhase] = useState<"s1" | "s2" | "s3">("s1");
  const cancel = useRef<Cancel>({ cancelled: false });
  const anims = useRef<Animation[]>([]);
  const closing = useRef(false);
  const dead = useRef(false);
  const onCloseRef = useRef(onClose); // always the latest onClose, so `finish` stays stable across parent re-renders
  onCloseRef.current = onClose;

  const finish = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    cancel.current.cancelled = true;
    anims.current.forEach((a) => a.cancel());
    const el = document.getElementById(targetId);
    if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY));
    const root = rootRef.current;
    if (root && !dead.current) { try { await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease", fill: "forwards" }).finished; } catch {} }
    if (!dead.current) onCloseRef.current();
  }, [targetId]);

  useEffect(() => { document.documentElement.classList.add("cinematic-lock"); return () => document.documentElement.classList.remove("cinematic-lock"); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [finish]);

  // ── the whole film ──
  useEffect(() => {
    dead.current = false;
    const c: Cancel = { cancelled: false }; // fresh token per run: a token cancelled by a previous run's cleanup must not freeze this one
    cancel.current = c;
    closing.current = false;
    const canvas = canvasRef.current!;
    const compact = window.innerWidth < 768;
    const liquid = createLiquid(canvas, { scale: 3, blobs: compact ? 6 : 9 });
    const setVar = (n: string, v: number) => art.current?.svg?.style.setProperty(n, String(v));
    const waapi = (el: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) => {
      if (!el) return null;
      const a = el.animate(kf, { fill: "both", easing: "cubic-bezier(.16,1,.3,1)", ...o });
      anims.current.push(a);
      return a;
    };
    const done = (list: (Animation | null)[]) => Promise.all(list.filter(Boolean).map((a) => (a as Animation).finished)).catch(() => {});
    const alive = () => !c.cancelled && !dead.current;

    async function stage1() {
      await liquid.play();
      if (!alive()) return;
      setFilled(true);
      await nextFrame();
      const scene = scene1.current; if (!scene || !alive()) return;
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      const list: (Animation | null)[] = [];
      list.push(waapi(scene.querySelector(".cine-glow"), [{ opacity: 0 }, { opacity: 1 }], { duration: 1000 }));
      list.push(waapi(scene.querySelector(".cine-eyebrow"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 100 }));
      scene.querySelectorAll(".cine-word > span").forEach((w, i) => list.push(waapi(w, [{ transform: "translateY(112%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 750, delay: 200 + i * 55 })));
      const T0 = 800, LINE = 1500;
      list.push(waapi(scene.querySelector(".cine-line i"), desktop ? [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }] : [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: LINE, delay: T0, easing: "cubic-bezier(.45,0,.25,1)" }));
      list.push(waapi(scene.querySelector(".cine-drop"), desktop
        ? [{ left: "0%", opacity: 0 }, { left: "0%", opacity: 1, offset: 0.04 }, { left: "100%", opacity: 1, offset: 0.96 }, { left: "100%", opacity: 0 }]
        : [{ top: "0%", opacity: 0 }, { top: "0%", opacity: 1, offset: 0.04 }, { top: "100%", opacity: 1, offset: 0.96 }, { top: "100%", opacity: 0 }], { duration: LINE, delay: T0, easing: "cubic-bezier(.45,0,.25,1)" }));
      scene.querySelectorAll(".cine-step").forEach((s, i) => {
        const at = T0 + (i / (STEPS.length - 1)) * LINE * 0.92;
        list.push(waapi(s, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 650, delay: at - 200 }));
        list.push(waapi(s.querySelector(".cine-node"), [{ background: "rgba(250,247,242,0)", boxShadow: "0 0 0 0 rgba(250,247,242,0)" }, { background: "rgba(250,247,242,1)", boxShadow: "0 0 0 8px rgba(250,247,242,.14)" }], { duration: 500, delay: at }));
      });
      list.push(waapi(scene.querySelector(".cine-note"), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: T0 + LINE }));
      await done(list);
      if (alive()) await pause(600, c); // reading pause
    }

    async function stage2() {
      if (!alive()) return;
      setPhase("s2");
      const svg = art.current?.svg; if (!svg) return;
      // 1. How It Works content fades out; its burgundy backdrop becomes transparent so the liquid shows.
      const s1 = scene1.current;
      const wrap = s1?.querySelector(".cine-wrap");
      await done([waapi(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease" })]);
      if (s1) s1.style.display = "none"; // the canvas now holds the solid burgundy; this layer must not block clicks
      if (bgD.current) bgD.current.style.opacity = "1";
      // 2. The liquid contracts into a single droplet above the hourglass.
      const ctm = svg.getScreenCTM()!; const pt = svg.createSVGPoint();
      pt.x = 250; pt.y = -64; const tgt = pt.matrixTransform(ctm);
      const unit = ctm.a; // screen px per svg unit
      const dropPx = Math.max(16, Math.min(34, 8 * unit * 3));
      const contraction = liquid.playContract(tgt.x, tgt.y, dropPx, 1200);
      tween(900, (p) => setVar("--dim", p), ease.out3, c);      // the dim hourglass emerges as the liquid retreats
      await contraction;
      if (!alive()) return;
      // 3. Swap the canvas droplet for the falling SVG droplet at the same spot.
      const drop = svg.querySelector("[data-drop]") as SVGPathElement;
      const k = dropPx / unit / 9;
      drop.setAttribute("opacity", "1");
      drop.setAttribute("transform", `translate(250 -64) scale(${k})`);
      liquid.clear();
      await tween(750, (p) => { const y = lerp(-64, 66, p); const st = 1 + 0.35 * p; drop.setAttribute("transform", `translate(250 ${y}) scale(${k * 0.9} ${k * st})`); }, ease.in2, c);
      if (!alive()) return;
      // 4. It enters the hourglass: squash, flash, the glass lights up and the sand starts to flow.
      await tween(110, (p) => { drop.setAttribute("transform", `translate(250 66) scale(${k * (0.9 + 0.5 * p)} ${k * 1.35 * (1 - 0.7 * p)})`); drop.setAttribute("opacity", String(1 - p)); }, ease.linear, c);
      tween(700, (p) => { setVar("--lit", p); }, ease.out3, c);
      tween(300, (p) => setVar("--flow", p), ease.linear, c);
      tween(2600, (p) => setVar("--bot", 0.4 * p), ease.linear, c);
      const fill = tween(1500, (p) => setVar("--top", 0.72 * p), ease.out3, c);
      await pause(550, c);
      // 5. Figures appear in front, then shake hands. Text reveals alongside.
      const a = art.current!;
      const dlist = Array.from(t2.current?.querySelectorAll("[data-dc]") ?? []).map((el, i) =>
        waapi(el, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: 150 + i * 120 }));
      waapi(t2.current, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
      await tween(850, (p) => setVar("--fig", p), ease.out3, c);
      await tween(950, (p) => {
        const r1 = lerp(STAND.rA[0], HANDSHAKE_A.rA[0], p), r2 = lerp(STAND.rA[1], HANDSHAKE_A.rA[1], p), ln = lerp(0, 3, p);
        a.a?.setPose({ lean: ln, rA: [r1, r2], lA: [lerp(-5, -8, p), lerp(3, 6, p)] });
        a.b?.setPose({ lean: ln, rA: [r1, r2], lA: [lerp(-5, -8, p), lerp(3, 6, p)] });
      }, ease.inOut3, c);
      tween(450, (p) => setVar("--clasp", p), ease.out3, c);
      for (let i = 0; i < 2 && alive(); i++) { // two small, warm pumps
        await tween(230, (p) => { const d = -5 * Math.sin(p * Math.PI); a.a?.setPose({ rA: [HANDSHAKE_A.rA[0] + d, HANDSHAKE_A.rA[1]] }); a.b?.setPose({ rA: [HANDSHAKE_A.rA[0] + d, HANDSHAKE_A.rA[1]] }); }, ease.linear, c);
      }
      await Promise.all([fill, done(dlist)]);
      if (alive()) await pause(700, c);
    }

    async function stage3() {
      if (!alive()) return;
      setPhase("s3");
      const svg = art.current!.svg!;
      const hold = (n: string) => svg.querySelector(n) as SVGGElement | null;
      // 1. donor copy and figures leave; background deepens
      const bg = bgR.current!;
      const out = waapi(t2.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease" });
      tween(700, (p) => { bg.style.opacity = String(p); }, ease.inOut2, c); // fade the darker backdrop IN over the charcoal one (never both semi-transparent)
      tween(650, (p) => { setVar("--fig", 1 - p); setVar("--clasp", 1 - p); }, ease.inOut2, c);
      await done([out]);
      // 2. hourglass particles lift off and turn into glowing red particles, flying to the network nodes
      const group = hold("[data-particles]")!;
      const ns = "http://www.w3.org/2000/svg";
      const targets = Object.values(NODES);
      const P = Array.from({ length: compact ? 12 : 18 }, (_, i) => {
        const el = document.createElementNS(ns, "circle"); el.setAttribute("r", "2.4"); el.setAttribute("opacity", "0");
        group.appendChild(el);
        const t = targets[i % targets.length];
        const sx = 250 + (Math.random() - 0.5) * 34, sy = 215 + (Math.random() - 0.5) * 120;
        const mx = (sx + t.x) / 2 + (Math.random() - 0.5) * 60, my = (sy + t.y) / 2 + (Math.random() - 0.5) * 60;
        return { el, sx, sy, tx: t.x, ty: t.y, mx, my, d: Math.random() * 0.35 };
      });
      tween(900, (p) => setVar("--lit", 1 - p), ease.inOut2, c).then(() => { setVar("--dim", 0); setVar("--flow", 0); });
      tween(700, (p) => setVar("--top", 0.72 * (1 - p)), ease.inOut2, c);
      tween(700, (p) => setVar("--bot", 0.4 * (1 - p)), ease.inOut2, c);
      tween(600, (p) => setVar("--net", p), ease.out3, c).catch(() => {});
      const flight = tween(1500, (P_) => {
        P.forEach((q) => {
          const p = Math.max(0, Math.min(1, (P_ - q.d) / (1 - q.d)));
          const u = 1 - p, x = u * u * q.sx + 2 * u * p * q.mx + p * p * q.tx, y = u * u * q.sy + 2 * u * p * q.my + p * p * q.ty;
          q.el.setAttribute("cx", String(x)); q.el.setAttribute("cy", String(y));
          q.el.setAttribute("r", String(lerp(2.2, 3.4, p)));
          q.el.setAttribute("fill", `rgb(255,${Math.round(lerp(192, 62, p))},${Math.round(lerp(203, 96, p))})`);
          q.el.setAttribute("opacity", String(p <= 0 ? 0 : p > 0.96 ? Math.max(0, (1 - p) * 25) : 1));
          q.el.setAttribute("style", "filter:drop-shadow(0 0 4px rgba(255,80,110,.9))");
        });
      }, ease.inOut2, c);
      setTimeout(() => { if (alive()) tween(900, (p) => setVar("--edges", p), ease.out3, c); }, 650);
      await flight;
      P.forEach((q) => q.el.remove());
      if (!alive()) return;
      waapi(cap.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
      waapi(tnet.current, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 800 });
      // 3. the blood unit travels the route to the destination hospital
      await tween(600, (p) => setVar("--route", p), ease.inOut2, c);
      const routePath = hold("[data-route]") as unknown as SVGPathElement;
      const unitEl = hold("[data-unit]")!;
      unitEl.setAttribute("opacity", "1");
      await followPath(routePath, 1500, (x, y) => unitEl.setAttribute("transform", `translate(${x} ${y})`), ease.inOut2, c);
      await tween(450, (p) => unitEl.setAttribute("transform", `${unitEl.getAttribute("transform")?.replace(/ scale.*/, "")} scale(${1 + 0.5 * Math.sin(p * Math.PI)})`), ease.linear, c);
      if (!alive()) return;
      await pause(250, c);
      // 4. network recedes; the big clock takes over the background, the figure strains against the hand
      stageRef.current?.classList.add("cine-s3");
      await tween(650, (p) => { setVar("--net", 1 - p); setVar("--edges", 1 - p); setVar("--route", 1 - p);  unitEl.setAttribute("opacity", String(1 - p)); }, ease.inOut2, c);
      waapi(cap.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease" });
      waapi(tnet.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease" });
      clock.current?.setHand(92);
      const cw = clockWrap.current!;
      const clockIn = tween(1000, (p) => { cw.style.opacity = String(p); cw.style.scale = String(lerp(1.08, 1, p)); }, ease.out3, c);
      await clockIn;
      waapi(t3.current, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
      const rf = Array.from(t3.current?.querySelectorAll("[data-rf]") ?? []).map((el, i) =>
        waapi(el, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: i * 110 }));
      await Promise.all([clock.current!.play(c, { fast: true }), done(rf)]);
      if (alive()) await pause(400, c);
    }

    (async () => {
      await stage1(); await stage2(); await stage3();
      if (alive()) finish();
    })();

    return () => { dead.current = true; c.cancelled = true; liquid.cancel(); anims.current.forEach((a) => a.cancel()); };
  }, [finish]);

  return (
    <div ref={rootRef} className={`cine-root cine-phase-${phase}`} role="dialog" aria-modal="true" aria-label="Introduction: how LifeLine works, for donors, and rapid delivery">
      <div ref={bgD} className="cine-bg cine-bg-d" />
      <div ref={bgR} className="cine-bg cine-bg-r" />

      <div ref={stageRef} className="cine-stage">
        <div ref={clockWrap} className="cine-clockwrap"><ClockArt ref={clock} /></div>
        <div className="cine-grid">
          <div className="cine-textcol">
            <div ref={t2} className="cine-t2"><DonorsCopy /></div>
            <div ref={tnet} className="cine-t2 cine-tnet">
              <p className="rf-eyebrow">Matching network</p>
              <h2 className="rf-title">Banks, donors and hospitals, <em>connected.</em></h2>
              <p className="rf-lede">Each compatible candidate is scored on urgency, proximity, expiry and reliability. The hospital then confirms the best match. This route is an illustration.</p>
            </div>
            <div ref={t3} className="cine-t3"><RapidFeatures /></div>
          </div>
          <div className="cine-artcol">
            <DonorsArt ref={art} withNetwork />
            <p ref={cap} className="cine-cap">Illustrative route · not live tracking</p>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="cine-canvas" aria-hidden="true" />
      {!filled ? null : (
        <div ref={scene1} className="cine-scene">
          <div className="cine-glow" aria-hidden="true" />
          <div className="cine-wrap">
            <p className="cine-eyebrow">Operations manual</p>
            <h2 className="cine-title" aria-label={TITLE}>
              {TITLE.split(" ").map((w, i) => (<span key={i} className="cine-word" aria-hidden="true"><span>{w}</span></span>))}
            </h2>
            <div className="cine-steps">
              <div className="cine-line" aria-hidden="true"><i /><b className="cine-drop" /></div>
              {STEPS.map((s) => (
                <div key={s.step} className="cine-step">
                  <span className="cine-node" aria-hidden="true" />
                  <div><p className="cine-step-label">{s.step} · {s.label}</p><h3 className="cine-step-title">{s.title}</h3><p className="cine-step-desc">{s.desc}</p></div>
                </div>
              ))}
            </div>
            <p className="cine-note">Illustrative animation — the steps describe how the LifeLine prototype works.</p>
          </div>
        </div>
      )}
      <div className="cine-top">
        <span className="cine-logo">Life<em>Line</em></span>
        <button type="button" className="cine-skip" onClick={finish}>Skip intro <span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}
