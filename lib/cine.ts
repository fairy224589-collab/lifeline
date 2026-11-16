/** Small animation toolkit shared by the cinematic scenes. No libraries. */

export type Cancel = { cancelled: boolean };

export const ease = {
  linear: (t: number) => t,
  in2: (t: number) => t * t,
  out3: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut3: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOut2: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Runs `fn(progress 0..1)` every frame for `ms`. The returned promise resolves when it finishes. */
export function tween(ms: number, fn: (p: number) => void, easing: (t: number) => number = ease.inOut3, c?: Cancel): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (c?.cancelled) return resolve();
      const p = clamp((now - t0) / ms);
      fn(easing(p));
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
/** A pause measured on the animation clock (it also pauses if the tab is hidden). */
export const pause = (ms: number, c?: Cancel) => tween(ms, () => {}, ease.linear, c);
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Moves along an SVG path; calls `fn(point, progress)` each frame. */
export function followPath(path: SVGPathElement, ms: number, fn: (x: number, y: number, p: number) => void, easing = ease.inOut2, c?: Cancel) {
  const len = path.getTotalLength();
  return tween(ms, (p) => { const pt = path.getPointAtLength(len * p); fn(pt.x, pt.y, p); }, easing, c);
}

/**
 * Two-bone inverse kinematics: where must a limb (lengths l1, l2) bend so its tip touches (tx, ty)?
 * Angles are "from straight down, positive towards +x" — the convention used by the Mannequin.
 */
export function ik(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number) {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = Math.atan2(dx, dy);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a1 = base - A; // elbow bends downwards
  const ex = sx + l1 * Math.sin(a1), ey = sy + l1 * Math.cos(a1);
  const a2 = Math.atan2(tx - ex, ty - ey) - a1;
  const deg = 180 / Math.PI;
  return { a1: a1 * deg, a2: a2 * deg };
}
