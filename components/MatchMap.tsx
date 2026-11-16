"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MatchResult } from "@/lib/types";

/* ── Custom SVG markers (clean vector dots) ── */

function createMarkerIcon(color: string, filled: boolean, size = 14): L.DivIcon {
  const svg = filled
    ? `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      </svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="white" stroke="${color}" stroke-width="2"/>
      </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const hospitalIcon = createMarkerIcon("#1C1917", true, 16);
const bestMatchIcon = createMarkerIcon("#7A1F2B", true, 14);
const otherMatchIcon = createMarkerIcon("#7A1F2B", false, 14);

/* ── Types ── */

interface MatchWithLocation extends MatchResult {
  location?: { lat: number; lng: number; label: string };
}

interface MatchMapProps {
  hospitalLocation: { lat: number; lng: number; label: string };
  matches: MatchWithLocation[];
}

/* Escape text before putting it inside popup HTML */
function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * WHY THIS COMPONENT IS BUILT THIS WAY
 * ------------------------------------
 * The old version removed and re-created the whole Leaflet map every time
 * `hospitalLocation` or `matches` changed, and it called fitBounds() with
 * Leaflet's default animation. map.remove() destroys the internal panes while
 * a zoom/pan animation or tile fade is still queued, and when that queued
 * callback ran it read `_leaflet_pos` from a pane that no longer existed:
 *   "Cannot read properties of undefined (reading '_leaflet_pos')"
 *
 * Now:
 *   1. The map is created ONCE (effect 1) and destroyed once on unmount.
 *   2. Markers live in a LayerGroup that is cleared and refilled (effect 2).
 *   3. Programmatic view changes use { animate: false } so nothing is queued.
 *   4. Before remove(), map.stop() cancels any running animation.
 *   5. A ResizeObserver calls invalidateSize() when the container changes size.
 */
export default function MatchMap({ hospitalLocation, matches }: MatchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  /* Effect 1 — create the map once, destroy it safely on unmount */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [hospitalLocation.lat, hospitalLocation.lng],
      zoom: 11,
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    /* Keep the map correct when the container resizes (animations, mobile rotate) */
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
      });
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
      const current = mapRef.current;
      mapRef.current = null;
      markersRef.current = null;
      if (current) {
        current.stop(); // cancel pending pan/zoom animations first
        current.off();
        current.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Effect 2 — redraw markers and fit the view whenever the data changes */
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    L.marker([hospitalLocation.lat, hospitalLocation.lng], {
      icon: hospitalIcon,
      zIndexOffset: 1000,
    })
      .addTo(layer)
      .bindPopup(
        `<div style="font-family:Inter,sans-serif;font-size:12px;">
          <strong style="color:#1C1917;">Hospital</strong><br/>
          <span style="color:#78716C;font-size:11px;">${esc(hospitalLocation.label)}</span>
        </div>`
      );

    const points: L.LatLng[] = [L.latLng(hospitalLocation.lat, hospitalLocation.lng)];

    matches.forEach((m, i) => {
      if (!m.location) return;
      points.push(L.latLng(m.location.lat, m.location.lng));
      const scorePercent = Math.round(m.score * 100);
      L.marker([m.location.lat, m.location.lng], {
        icon: i === 0 ? bestMatchIcon : otherMatchIcon,
      })
        .addTo(layer)
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:12px;">
            <strong style="color:#1C1917;">${esc(m.sourceName)}</strong>
            <span style="color:#7A1F2B;font-size:10px;font-weight:600;margin-left:4px;">${i === 0 ? "★ BEST" : ""}</span><br/>
            <span style="color:#78716C;font-size:11px;">
              ${esc(m.bloodGroup)} · ${esc(m.distanceKm)} km · score <strong>${scorePercent}/100</strong>
            </span>
          </div>`
        );
    });

    // Make sure Leaflet knows the real size before fitting (container may have just animated in)
    map.invalidateSize({ animate: false });

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [40, 40],
        maxZoom: 13,
        animate: false,
      });
    } else {
      map.setView(points[0], 11, { animate: false });
    }
  }, [hospitalLocation, matches]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 w-full overflow-hidden rounded-2xl border border-ink-10"
      style={{ height: "340px" }}
      role="region"
      aria-label="Map of the hospital and matched blood sources"
    />
  );
}
