"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BloodGroup, MatchResult, UrgencyLevel, Location } from "@/lib/types";

/* Dynamically import the map to avoid SSR issues with Leaflet */
const MatchMap = dynamic(() => import("@/components/MatchMap"), {
  ssr: false,
  loading: () => (
    <div className="skeleton-block w-full" style={{ height: "340px" }} />
  ),
});

interface MatchWithLocation extends MatchResult {
  location?: { lat: number; lng: number; label: string };
}

const BLOOD_GROUPS: BloodGroup[] = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
];

const PRESET_LOCATIONS: Location[] = [
  { label: "AIIMS Trauma Center, Delhi", lat: 28.5672, lng: 77.2100 },
  { label: "Connaught Place, Delhi", lat: 28.6139, lng: 77.2090 },
  { label: "Noida Sector 62", lat: 28.5355, lng: 77.3910 },
  { label: "Gurugram Sector 29", lat: 28.4595, lng: 77.0266 },
  { label: "Rohini, Delhi", lat: 28.7041, lng: 77.1025 },
  { label: "Lilavati Hospital, Mumbai", lat: 19.0519, lng: 72.8291 },
  { label: "Apollo Hospital, Bengaluru", lat: 12.8942, lng: 77.5982 },
];

/* ── Skeleton loader shaped like match cards ── */
function MatchSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="card-2xl p-5"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="skeleton-block"
                  style={{
                    width: "80px",
                    height: "20px",
                    animationDelay: `${i * 150}ms`,
                  }}
                />
                <div
                  className="skeleton-block"
                  style={{
                    width: "160px",
                    height: "18px",
                    animationDelay: `${i * 150 + 50}ms`,
                  }}
                />
              </div>
              <div className="mt-2.5 flex gap-3">
                <div
                  className="skeleton-block"
                  style={{
                    width: "40px",
                    height: "14px",
                    animationDelay: `${i * 150 + 100}ms`,
                  }}
                />
                <div
                  className="skeleton-block"
                  style={{
                    width: "70px",
                    height: "14px",
                    animationDelay: `${i * 150 + 150}ms`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HospitalDashboard() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const [hospitalName, setHospitalName] = useState("AIIMS Trauma Center");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [urgency, setUrgency] = useState<UrgencyLevel>("critical");
  
  // Dynamic Real Location State
  const [locationInput, setLocationInput] = useState("AIIMS Trauma Center, Delhi");
  const [selectedLocation, setSelectedLocation] = useState<Location>(PRESET_LOCATIONS[0]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("✓ Verified GPS Coordinates Active");
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchWithLocation[] | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");

  // Real-time Geocoding via OpenStreetMap Nominatim
  async function handleGeocodeLocation(query?: string) {
    const searchText = query || locationInput || hospitalName;
    if (!searchText.trim()) return;

    setIsGeocoding(true);
    setLocationStatus("Resolving GPS coordinates...");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const newLoc: Location = {
          label: item.display_name.split(",").slice(0, 3).join(","),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
        setSelectedLocation(newLoc);
        setLocationInput(newLoc.label);
        setLocationStatus(`✓ Geocoded: ${newLoc.lat.toFixed(4)}, ${newLoc.lng.toFixed(4)}`);
        return newLoc;
      } else {
        setLocationStatus("⚠️ Exact pin not found, using regional reference point.");
      }
    } catch {
      setLocationStatus("⚠️ Geocoding service busy, using regional coordinates.");
    } finally {
      setIsGeocoding(false);
    }
    return selectedLocation;
  }

  // Detect Current Browser GPS Location
  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsGeocoding(true);
    setLocationStatus("Detecting live device GPS...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const label = `Current Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        const newLoc: Location = { lat, lng, label };
        setSelectedLocation(newLoc);
        setLocationInput(label);
        setLocationStatus(`✓ Live GPS Locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setIsGeocoding(false);
      },
      () => {
        setLocationStatus("⚠️ GPS permission denied, please type hospital name.");
        setIsGeocoding(false);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMatches(null);
    setConfirmedId(null);
    setLoading(true);

    try {
      // Ensure we have geocoded if locationInput changed
      let activeLocation = selectedLocation;
      if (locationInput && locationInput !== selectedLocation.label) {
        const geocoded = await handleGeocodeLocation(locationInput);
        if (geocoded) activeLocation = geocoded;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionData?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }

      const res = await fetch("/api/match", {
        method: "POST",
        headers,
        body: JSON.stringify({
          hospitalName: hospitalName || "Emergency Trauma Center",
          bloodGroup,
          unitsNeeded,
          urgency,
          location: activeLocation,
          includeDemo: isDemoMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 401 && !isDemoMode) {
          setError("Session expired or authentication required. Please log in or enable demo presentation mode.");
          return;
        }
        throw new Error(errData?.error || "Request failed");
      }
      const data = await res.json();
      setMatches(data.matches);
      setEscalated(data.escalated);
      setRequestId(data.request?.id ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(sourceId: string) {
    if (!requestId || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionData?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }

      const res = await fetch("/api/match/confirm", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ requestId, confirmedSourceId: sourceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status !== 409) throw new Error(err.error || "Confirmation failed");
      }
      setConfirmedId(sourceId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Confirmation failed.");
    } finally {
      setConfirmLoading(false);
    }
  }


  if (authChecking) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-center">
        <p className="eyebrow">Authenticating access…</p>
      </main>
    );
  }

  const urgencyOptions: { value: UrgencyLevel; label: string; hint: string }[] = [
    { value: "critical", label: "Critical", hint: "Life-threatening" },
    { value: "high", label: "High", hint: "Within hours" },
    { value: "medium", label: "Medium", hint: "Planned / stable" },
  ];

  return (
    <div className="min-h-screen bg-clay">
      {/* ── Top bar ── */}
      <header className="shell-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-blood animate-heartbeat-ecg" />
            <span className="font-display text-lg font-semibold tracking-tight">LifeLine</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-secondary !py-2 !text-xs">← Home</Link>
            <button onClick={handleLogout} type="button" className="btn btn-secondary !py-2 !text-xs">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-12 page-enter">
        {/* ── Page heading ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Hospital portal</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Emergency Desk
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-60">
              Raise a blood request. LifeLine pins your location, then ranks compatible donors and blood-bank units by urgency, distance, expiry and reliability.
            </p>
          </div>
          <span className="badge badge-ok self-start sm:self-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Matching engine online
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Request form ── */}
          <form onSubmit={handleSubmit} className="card-2xl p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-ink-10 pb-4">
              <h2 className="font-display text-lg font-semibold text-ink">New blood request</h2>
              <span className="badge badge-neutral">Step 1 of 2 · Request</span>
            </div>

            {/* Urgency first: it is the most important decision */}
            <fieldset className="mt-5">
              <legend className="field-label">How urgent is this?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {urgencyOptions.map((o) => {
                  const active = urgency === o.value;
                  const activeStyle =
                    o.value === "critical"
                      ? "border-emergency bg-emergency-soft text-emergency"
                      : "border-blood bg-blood-10 text-blood";
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setUrgency(o.value)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active ? activeStyle : "border-ink-20 bg-white text-ink hover:border-ink-40"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className="block text-[11px] opacity-70">{o.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="hospitalName" className="field-label">Hospital / facility name</label>
                <input
                  id="hospitalName"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. Max Super Speciality Hospital"
                  className="field"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="locationInput" className="field-label">Location / city</label>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    className="text-[11px] font-semibold text-blood hover:underline"
                  >
                    Use my GPS
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    id="locationInput"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onBlur={() => handleGeocodeLocation(locationInput)}
                    placeholder="e.g. Saket New Delhi, Bandra Mumbai"
                    className="field"
                  />
                  <button
                    type="button"
                    onClick={() => handleGeocodeLocation(locationInput)}
                    disabled={isGeocoding}
                    className="btn btn-secondary mt-1.5 flex-shrink-0 !px-3.5"
                    title="Search real GPS coordinates"
                  >
                    {isGeocoding ? "…" : "Pin"}
                  </button>
                </div>
              </div>

              {/* Location status + presets */}
              <div className="sm:col-span-2 -mt-2 rounded-xl bg-clay-deep px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-ink-60">{locationStatus}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-40">Quick pick</span>
                    {PRESET_LOCATIONS.slice(0, 4).map((loc) => (
                      <button
                        key={loc.label}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(loc);
                          setLocationInput(loc.label);
                          setHospitalName(loc.label.split(",")[0]);
                          setLocationStatus(`✓ Lat: ${loc.lat}, Lng: ${loc.lng}`);
                        }}
                        className="rounded-full border border-ink-10 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-60 transition-colors hover:border-blood hover:text-blood"
                      >
                        {loc.label.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="bloodGroup" className="field-label">Blood group needed</label>
                <select
                  id="bloodGroup"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className="field"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="unitsNeeded" className="field-label">Units needed</label>
                <input
                  id="unitsNeeded"
                  type="number"
                  min={1}
                  value={unitsNeeded}
                  onChange={(e) => setUnitsNeeded(Number(e.target.value))}
                  className="field"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading || isGeocoding}
                className={`btn w-full !py-3.5 ${urgency === "critical" ? "btn-urgent" : "btn-primary"}`}
              >
                {loading ? "Calculating live distance & matches…" : "Find matches →"}
              </button>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-ink-20 bg-clay-deep/60 p-3 text-xs leading-relaxed text-ink-60 hover:bg-clay-deep">
                <input
                  type="checkbox"
                  checked={isDemoMode}
                  onChange={(e) => setIsDemoMode(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-20 accent-[#7A1F2B]"
                />
                <span>
                  <span className="font-semibold text-ink">Presentation mode.</span>{" "}
                  Generates isolated mock candidates without touching live database tables.
                </span>
              </label>
            </div>
          </form>

          {/* ── Side panel: how the ranking works ── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card-2xl p-5">
              <p className="eyebrow">Your request</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-60">Blood group</dt>
                  <dd className="font-display text-xl font-semibold text-blood">{bloodGroup}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-60">Units</dt>
                  <dd className="font-semibold text-ink">{unitsNeeded}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-60">Urgency</dt>
                  <dd>
                    <span className={`badge ${urgency === "critical" ? "badge-urgent" : "badge-brand"}`}>
                      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-60">Pinned at</dt>
                  <dd className="max-w-[150px] truncate text-right font-medium text-ink" title={selectedLocation.label}>
                    {selectedLocation.label}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="card-2xl p-5">
              <p className="eyebrow">How matches are ranked</p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-60">
                <li><span className="font-semibold text-ink">Urgency</span> — critical requests weigh nearer sources higher.</li>
                <li><span className="font-semibold text-ink">Proximity</span> — straight-line distance from your pin.</li>
                <li><span className="font-semibold text-ink">Expiry</span> — units closer to expiry are used first.</li>
                <li><span className="font-semibold text-ink">Reliability</span> — donor history and availability.</li>
              </ul>
            </div>
          </aside>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-emergency/30 bg-emergency-soft px-4 py-3 text-sm font-medium text-emergency">
            {error}
          </div>
        )}

        {/* ── Skeleton Loader ── */}
        {loading && <MatchSkeleton />}

        {/* ── Results ── */}
        {matches && (
          <section className="mt-10 animate-fade-in">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Step 2 of 2 · Results</p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold text-ink">
                  {escalated
                    ? "No compatible matches found"
                    : `Ranked matches near ${hospitalName || selectedLocation.label}`}
                  {!escalated && (
                    <span className="ml-2 text-sm font-normal text-ink-40">({matches.length} found)</span>
                  )}
                </h2>
              </div>
              <span className="font-mono text-xs text-ink-40">
                GPS {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </span>
            </div>

            {escalated ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="eyebrow !text-amber-700">Auto-escalated</p>
                <p className="mt-1.5 text-sm text-amber-900">
                  This request has been escalated to the nearest district blood-bank network for broader matching.
                </p>
              </div>
            ) : (
              <>
                {/* ── Map ── */}
                <div className="mt-5 card-2xl overflow-hidden p-2">
                  <MatchMap hospitalLocation={selectedLocation} matches={matches} />
                </div>

                {/* ── Match Cards ── */}
                <div className="mt-5 space-y-3">
                  {matches.map((m, i) => {
                    const isConfirmed = confirmedId === m.sourceId;
                    const isReleased = confirmedId !== null && confirmedId !== m.sourceId;
                    const isBest = i === 0 && !isReleased;
                    const scorePct = Math.round(m.score * 100);

                    return (
                      <div
                        key={`${m.sourceType}-${m.sourceId}`}
                        className={`card-2xl p-5 transition-all duration-500 ${isReleased ? "opacity-40" : ""} ${
                          isBest ? "!border-blood/40 ring-1 ring-blood/20" : ""
                        }`}
                        style={{ animation: "fadeSlideUp 0.4s ease-out both", animationDelay: `${i * 80}ms` }}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blood-10 font-display text-lg font-semibold text-blood">
                              {m.bloodGroup}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {isBest && <span className="badge badge-brand">★ Best match</span>}
                                <p className="font-display text-base font-semibold text-ink sm:text-lg">{m.sourceName}</p>
                              </div>
                              <p className="mt-1 text-xs text-ink-60">
                                {m.sourceType === "donor" ? "Volunteer donor" : "Blood bank unit"} ·{" "}
                                <span className="font-semibold text-ink">{m.distanceKm} km away</span>
                              </p>
                              {/* Score bar */}
                              <div className="mt-2.5 flex items-center gap-3">
                                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-10" aria-hidden="true">
                                  <div className="h-full rounded-full bg-blood" style={{ width: `${Math.min(100, scorePct)}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-ink">
                                  {scorePct}<span className="font-normal text-ink-40">/100</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {isReleased ? (
                              <span className="badge badge-neutral">Released</span>
                            ) : isConfirmed ? (
                              <span className="badge badge-ok !px-4 !py-2">✓ Locked</span>
                            ) : (
                              <button
                                onClick={() => handleConfirm(m.sourceId)}
                                disabled={confirmedId !== null || confirmLoading}
                                className={`btn ${isBest ? "btn-primary" : "btn-secondary"} w-full sm:w-auto`}
                              >
                                {confirmLoading ? "Locking…" : "Confirm"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Score breakdown */}
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink-10 pt-3 sm:grid-cols-4">
                          {[
                            { label: "Urgency", value: m.breakdown.urgency },
                            { label: "Proximity", value: m.breakdown.proximity },
                            { label: "Expiry", value: m.breakdown.expiry },
                            { label: "Reliability", value: m.breakdown.reliability },
                          ].map((item) => (
                            <div key={item.label}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-40">{item.label}</p>
                              <p className="text-sm font-semibold text-ink">{item.value.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {confirmedId && (
              <div
                className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5"
                style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
              >
                <p className="eyebrow !text-green-700">Match confirmed &amp; locked</p>
                <p className="mt-1.5 text-sm text-green-900">
                  First-confirmed-lock active. All other candidate reserves have been automatically released. The confirmed source has been alerted.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
