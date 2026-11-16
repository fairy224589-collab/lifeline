"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/**
 * Primary links live in the bar. Everything else lives under "More" (desktop)
 * or in the full-screen menu (mobile). Nothing from the old navbar was removed.
 * `id` links scroll to a section on the home page; `href` links open a route.
 */
type NavItem = { label: string; id?: string; href?: string };

const PRIMARY: NavItem[] = [
  { label: "How it works", id: "how-it-works" },
  { label: "Matching Engine", id: "matching-engine" },
  { label: "Safety Check", id: "safety" },
  { label: "Analytics", id: "analytics" },
  { label: "For Donors", id: "for-donors" },
  { label: "Blood Banks", id: "blood-banks" },
];

/** Everything else: remaining sections, plus every original route (portals, Rapid Finder, Unit Passport, Control Room). */
const MORE: NavItem[] = [
  { label: "Rapid Delivery", id: "rapid-delivery" },
  { label: "Live Demo", id: "live-demo" },
  { label: "AI Copilot", id: "ai-copilot" },
  { label: "About Us", id: "about" },
  { label: "Rapid Finder", href: "/rapid-delivery" },
  { label: "Donor Portal", href: "/donor" },
  { label: "Blood Bank Portal", href: "/bank" },
  { label: "Hospital Portal", href: "/hospital" },
  { label: "Unit Passport", href: "/unit-passport" },
  { label: "Control Room", href: "/admin" },
  { label: "Notifications", href: "/notifications" },
];

export default function SiteNav({
  onNavigateSection,
}: {
  /** Called for section links. The page decides how to scroll / animate. */
  onNavigateSection: (id: string) => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Highlight the section currently in view.
  useEffect(() => {
    const ids = [...PRIMARY, ...MORE].filter((n) => n.id).map((n) => n.id!);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the "More" menu when the visitor presses outside it. (A blur timer would close it
  // mid-click and swallow the click, so we never use one.)
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);

  // Lock page scroll while the mobile menu is open; close on Escape.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setMoreOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const dashHref = `/${session?.user?.user_metadata?.role || "hospital"}`;
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    onNavigateSection(id);
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const linkCls = (isActive: boolean) => `nav-link ${isActive ? "nav-link-active" : ""}`;

  return (
    <>
    <header className={`site-nav ${scrolled ? "site-nav-scrolled" : ""}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="LifeLine home">
          <span className="logo-drop" aria-hidden="true" />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">
            Life<span className="italic text-blood">Line</span>
          </span>
        </Link>

        {/* Desktop */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-7">
          {PRIMARY.map((n) =>
            n.id ? (
              <a key={n.label} href={`#${n.id}`} onClick={go(n.id)} className={linkCls(active === n.id)}
                 aria-current={active === n.id ? "location" : undefined}>{n.label}</a>
            ) : (
              <Link key={n.label} href={n.href!} className={linkCls(false)}>{n.label}</Link>
            )
          )}
          <div className="relative" ref={moreRef}>
            <button type="button" className="nav-link" aria-haspopup="menu" aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((v) => !v)}>
              More <span aria-hidden="true" className="ml-0.5 text-[9px]">▾</span>
            </button>
            {moreOpen && (
              <div role="menu" className="nav-more">
                {MORE.map((n) => n.id ? (
                  <a key={n.label} href={`#${n.id}`} role="menuitem" className="nav-more-item" onClick={(e) => { e.preventDefault(); setMoreOpen(false); onNavigateSection(n.id!); }}>{n.label}</a>
                ) : (
                  <Link key={n.label} href={n.href!} role="menuitem" className="nav-more-item" onClick={() => setMoreOpen(false)}>{n.label}</Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link href="/notifications" aria-label="Notifications" className="nav-icon hidden lg:inline-flex">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
          </Link>

          {!checking && (
            session ? (
              <>
                <Link href={dashHref} className="nav-btn-ghost hidden sm:inline-flex">Dashboard</Link>
                <button type="button" onClick={signOut} className="nav-btn-solid hidden sm:inline-flex">Log out</button>
              </>
            ) : (
              <Link href="/login" className="nav-btn-solid hidden sm:inline-flex">Log in</Link>
            )
          )}

          <button type="button" className="nav-burger inline-flex lg:hidden" aria-label={open ? "Close menu" : "Open menu"}
                  aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((v) => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>

      {/* Mobile full-screen menu (sibling of the header: backdrop-filter on a parent would trap position:fixed) */}
      <div id="mobile-menu" className={`mobile-menu ${open ? "mobile-menu-open" : ""}`} aria-hidden={!open}>
        <nav aria-label="Mobile" className="mx-auto flex min-h-full max-w-md flex-col px-6 pt-20">
          <p className="eyebrow mb-4">Explore</p>
          <ul className="space-y-1">
            {PRIMARY.map((n, i) => (
              <li key={n.label} style={{ transitionDelay: open ? `${60 + i * 35}ms` : "0ms" }} className="mobile-item">
                {n.id ? (
                  <a href={`#${n.id}`} onClick={go(n.id)} tabIndex={open ? 0 : -1} className="mobile-link">{n.label}</a>
                ) : (
                  <Link href={n.href!} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="mobile-link">{n.label}</Link>
                )}
              </li>
            ))}
          </ul>
          <p className="eyebrow mb-3 mt-8">More</p>
          <ul className="grid grid-cols-2 gap-2">
            {MORE.map((n) => (
              <li key={n.label}>
                {n.id ? (
                  <a href={`#${n.id}`} onClick={go(n.id)} tabIndex={open ? 0 : -1} className="mobile-chip">{n.label}</a>
                ) : (
                  <Link href={n.href!} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="mobile-chip">{n.label}</Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mobile-cta mt-auto flex gap-3">
            {!checking && (session ? (
              <>
                <Link href={dashHref} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="nav-btn-ghost flex-1 justify-center !py-3.5">Dashboard</Link>
                <button type="button" onClick={signOut} tabIndex={open ? 0 : -1} className="nav-btn-solid flex-1 justify-center !py-3.5">Log out</button>
              </>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="nav-btn-solid flex-1 justify-center !py-3.5">Log in</Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
