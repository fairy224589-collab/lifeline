"use client";
import { useEffect, useRef } from "react";
import ClockArt, { ClockHandle } from "@/components/cinematic/ClockArt";
import RapidFeatures from "@/components/cinematic/RapidFeatures";

/**
 * In-page "Rapid Delivery" — the FINAL DESTINATION of the cinematic journey. Same composition as the
 * overlay's last frame so the hand-off is seamless. The clock hand keeps ticking (and the figure keeps
 * straining) only while the section is on screen, and not at all for visitors who prefer reduced motion.
 */
export default function RapidDeliverySection() {
  const ref = useRef<HTMLElement>(null);
  const clock = useRef<ClockHandle>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let token = { cancelled: false };
    const io = new IntersectionObserver(([e]) => {
      token.cancelled = true;
      if (e.isIntersecting) { token = { cancelled: false }; clock.current?.loop(token); }
    }, { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => { token.cancelled = true; io.disconnect(); };
  }, []);
  return (
    <section ref={ref} id="rapid-delivery" className="fullbleed sec-dark sec-rapid" aria-label="Rapid delivery">
      <div className="cine-stage cine-stage-page cine-s3">
        <div className="cine-clockwrap" style={{ opacity: 1 }}><ClockArt ref={clock} static /></div>
        <div className="cine-grid">
          <div className="cine-textcol"><div className="cine-t3"><RapidFeatures /></div></div>
        </div>
      </div>
    </section>
  );
}
