/**
 * LIQUID ENGINE — the "droplets merge and flood the screen" effect (video 1).
 *
 * How it works (plain language):
 *  - Every droplet is a "field": the closer a pixel is to a droplet, the stronger the value.
 *  - We ADD the fields of all droplets together. Where the sum passes a threshold the pixel is
 *    inked. Because fields add, two droplets that get close bulge towards each other and fuse —
 *    that is a real metaball merge, not two circles overlapping.
 *  - We nudge the threshold with fractal noise so edges are rough and feathery like ink in water.
 *  - Later a "flood" term grows every droplet until the whole screen is covered.
 *
 * Runs on a small grid (each cell = a few screen pixels) and is stretched by CSS, which keeps it
 * cheap enough for phones. No libraries.
 */

export const LIQUID_FLOOD_END = 2.3; // seconds when the flood has covered the screen
export const LIQUID_DURATION = 2.4; // seconds when we switch to a solid fill and finish

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise with a seeded permutation table.
const PERM = new Uint8Array(512);
(() => {
  const rnd = mulberry32(7);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = PERM[PERM[X] + Y], b = PERM[PERM[X + 1] + Y], c = PERM[PERM[X] + Y + 1], d = PERM[PERM[X + 1] + Y + 1];
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) / 255;
}
const fbm = (x: number, y: number) => 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.3, y * 2.3) + 0.15 * vnoise(x * 5.1, y * 5.1);

export interface LiquidOptions {
  /** screen pixels per grid cell (bigger = faster, softer). Default 3, use 5 on phones. */
  scale?: number;
  /** number of starting droplets */
  blobs?: number;
  seed?: number;
}

// Colours: crimson where the liquid is thin, deep burgundy where it is thick.
const CRIMSON = [168, 38, 58];
const BURGUNDY = [94, 24, 34]; // #5E1822 — the scene background colour

export function createLiquid(canvas: HTMLCanvasElement, opts: LiquidOptions = {}) {
  const scale = opts.scale ?? 3;
  const n = opts.blobs ?? 9;
  const rnd = mulberry32(opts.seed ?? 11);

  const gw = Math.max(8, Math.ceil(canvas.clientWidth / scale));
  const gh = Math.max(8, Math.ceil(canvas.clientHeight / scale));
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(gw, gh);
  const px = img.data;

  const u = Math.sqrt(gw * gh); // a size unit that works for wide and tall screens
  const diag = Math.hypot(gw, gh);

  // --- droplet plan (deterministic) ---
  const sx = new Float32Array(n), sy = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n);
  const birth = new Float32Array(n), rmax = new Float32Array(n);
  const placed: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = gw * (0.1 + rnd() * 0.8); y = gh * (0.12 + rnd() * 0.76);
      if (placed.every(([px2, py2]) => Math.hypot(px2 - x, py2 - y) > u * 0.17)) break;
    }
    placed.push([x, y]);
    sx[i] = x; sy[i] = y;
    const pull = 0.4 + rnd() * 0.3;
    tx[i] = x + (gw * 0.5 - x) * pull; ty[i] = y + (gh * 0.5 - y) * pull;
    birth[i] = 0.05 + (i / n) * 0.75 + rnd() * 0.08;
    rmax[i] = u * (0.058 + rnd() * 0.03);
  }

  const cx = new Float32Array(n), cy = new Float32Array(n), cr2 = new Float32Array(n), cw = new Float32Array(n);
  const ox = rnd() * 100, oy = rnd() * 100;

  function renderAt(t: number) {
    if (t >= LIQUID_DURATION) {
      for (let i = 0; i < px.length; i += 4) { px[i] = BURGUNDY[0]; px[i + 1] = BURGUNDY[1]; px[i + 2] = BURGUNDY[2]; px[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      return;
    }
    // 1. where is every droplet right now?
    const move = easeInOut(clamp((t - 0.3) / 1.1));
    // Fields ADD together, so n droplets reach about sqrt(n) times further than one: scale for that.
    const fp = clamp((t - 0.9) / (LIQUID_FLOOD_END - 0.9));
    const flood = (2.1 * diag / Math.sqrt(n)) * Math.pow(fp, 1.7);
    const rough = 0.28 + 0.45 * smooth(0.6, 1.8, t);
    let alive = 0;
    for (let i = 0; i < n; i++) {
      const age = t - birth[i];
      if (age <= 0) { cr2[i] = 0; continue; }
      const grow = easeOut(clamp(age / 0.45)) * (1 + 0.45 * smooth(0.5, 1.6, t));
      const r = rmax[i] * grow + flood;
      cx[i] = sx[i] + (tx[i] - sx[i]) * move;
      cy[i] = sy[i] + (ty[i] - sy[i]) * move;
      cr2[i] = r * r;
      // young droplets are soft blurred dots that sharpen (as in the video)
      cw[i] = 0.05 + 0.5 * (1 - smooth(0, 0.32, age));
      alive++;
    }
    if (!alive) { px.fill(0); ctx.putImageData(img, 0, 0); return; }

    // 2. colour every cell
    const nf = 0.11, tOff = t * 0.9;
    let p = 0;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, p += 4) {
        let f = 0, wsum = 0;
        for (let i = 0; i < n; i++) {
          const r2 = cr2[i]; if (r2 === 0) continue;
          const dx = x - cx[i], dy = y - cy[i];
          const fi = r2 / (dx * dx + dy * dy + 1);
          f += fi; wsum += cw[i] * fi;
        }
        if (f < 0.12) { px[p + 3] = 0; continue; }
        const w = wsum / f;
        let g = f;
        if (f < 3.6) g = f + (fbm(x * nf + ox + tOff, y * nf + oy - tOff) - 0.5) * 2 * rough;
        const a = smooth(1 - w, 1 + w, g);
        if (a <= 0) { px[p + 3] = 0; continue; }
        const d = Math.min(1, 0.75 * fp + 0.25 * smooth(1, 5, f)); // flat ink first, darkens as it floods
        px[p] = CRIMSON[0] + (BURGUNDY[0] - CRIMSON[0]) * d;
        px[p + 1] = CRIMSON[1] + (BURGUNDY[1] - CRIMSON[1]) * d;
        px[p + 2] = CRIMSON[2] + (BURGUNDY[2] - CRIMSON[2]) * d;
        px[p + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let raf = 0, cancelled = false;
  function play(): Promise<void> {
    return new Promise((resolve) => {
      let last = performance.now(), t = 0;
      const frame = (now: number) => {
        if (cancelled) return;
        t += Math.min(0.05, (now - last) / 1000); // cap so a lagging tab can't jump ahead
        last = now;
        renderAt(t);
        if (t >= LIQUID_DURATION) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }
  function cancel() { cancelled = true; cancelAnimationFrame(raf); }

  /**
   * STAGE 2 — the reverse: the screen-filling liquid pulls back together into ONE droplet at (gxPx, gyPx).
   * Resolves when the droplet has formed. `dropPx` is the droplet radius in screen pixels.
   */
  function renderContract(p: number, gx: number, gy: number, dropR: number) {
    const e = easeInOut(p);
    const gather = easeOut(clamp(p * 1.35)); // positions converge a little faster than the radii shrink
    const floodEnd = (2.1 * diag) / Math.sqrt(n);
    const rEnd = dropR / Math.sqrt(n);
    const rough = 0.06 + 0.8 * (1 - e);
    for (let i = 0; i < n; i++) {
      cx[i] = tx[i] + (gx - tx[i]) * gather;
      cy[i] = ty[i] + (gy - ty[i]) * gather;
      const r = (rmax[i] * 1.45 + floodEnd) * (1 - Math.pow(e, 0.85)) + rEnd * Math.pow(e, 0.85);
      cr2[i] = r * r; cw[i] = 0.05;
    }
    const nf = 0.11, tOff = p * 0.9;
    let q = 0;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, q += 4) {
        let f = 0;
        for (let i = 0; i < n; i++) { const dx = x - cx[i], dy = y - cy[i]; f += cr2[i] / (dx * dx + dy * dy + 1); }
        if (f < 0.12) { px[q + 3] = 0; continue; }
        let g = f;
        if (f < 3.6) g = f + (fbm(x * nf + ox - tOff, y * nf + oy + tOff) - 0.5) * 2 * rough;
        const a = smooth(0.95, 1.05, g);
        if (a <= 0) { px[q + 3] = 0; continue; }
        const d = Math.min(1, 0.75 * (1 - e) + 0.25 * smooth(1, 5, f));
        px[q] = CRIMSON[0] + (BURGUNDY[0] - CRIMSON[0]) * d;
        px[q + 1] = CRIMSON[1] + (BURGUNDY[1] - CRIMSON[1]) * d;
        px[q + 2] = CRIMSON[2] + (BURGUNDY[2] - CRIMSON[2]) * d;
        px[q + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function playContract(gxPx: number, gyPx: number, dropPx: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      let last = performance.now(), t = 0;
      const frame = (now: number) => {
        if (cancelled) return resolve();
        t += Math.min(0.05, (now - last) / 1000); last = now;
        const p = clamp(t / (ms / 1000));
        renderContract(p, gxPx / scale, gyPx / scale, dropPx / scale);
        if (p >= 1) resolve(); else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }
  function clear() { ctx.clearRect(0, 0, gw, gh); }
  return { renderAt, play, cancel, playContract, renderContract, clear };
}
