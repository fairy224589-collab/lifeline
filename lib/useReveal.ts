"use client";
import { RefObject, useEffect, useRef, useState } from "react";
import { ease, tween } from "@/lib/cine";

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { setR(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  return r;
}

/** true once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(ref: RefObject<T | null>, threshold = 0.25) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return seen;
}

/** 0 → 1 over `ms` whenever `run` becomes true or `key` changes. Jumps straight to 1 for reduced motion. */
export function useProgress(run: boolean, key: unknown, ms = 1300) {
  const reduced = useReducedMotion();
  const [p, setP] = useState(0);
  const token = useRef({ cancelled: false });
  useEffect(() => {
    if (!run) return;
    if (reduced) { setP(1); return; }
    token.current.cancelled = true;
    const c = { cancelled: false }; token.current = c;
    setP(0);
    tween(ms, setP, ease.out3, c);
    return () => { c.cancelled = true; };
  }, [run, key, ms, reduced]);
  return p;
}
