import { FISH_SPECIES, getWeather } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { isUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * Fishing catch minigame — fishing is no longer a passive timer:
 *  1. Wait for the bite (tap too early and the fish spooks — the wait restarts).
 *  2. ❗ BITE — hook it within the reaction window.
 *  3. Reel: a marker sweeps the tension bar; tap while it's inside the green
 *     zone. Three good taps land the fish; two misses snap the line.
 * Better rods widen the green zone, and fish bite more honestly in the rain.
 * The server validates the session and grants loot exactly like a timed catch.
 */

type Phase = "wait" | "bite" | "reel" | "caught" | "escaped";

// Warm the species art cache on the first cast so the catch celebration's
// image is already loaded when the fish lands (~380KB total, once).
let fishArtPreloaded = false;
function preloadFishArt() {
  if (fishArtPreloaded) return;
  fishArtPreloaded = true;
  for (const s of FISH_SPECIES) {
    const img = new Image();
    img.src = `/assets/fish/${s.art}`;
  }
}

const HITS_NEEDED = 3;
const STRIKES_ALLOWED = 2;
const BITE_WINDOW_MS = 1000;

/** Green-zone width (% of the bar) from gear + weather. */
function zoneWidth(toolId: string | null): number {
  let w = 26;
  if (toolId === "item_fishing_rod") w += 5;
  if (toolId === "item_pro_rod" || toolId === "item_harvest_net") w += 9;
  if (toolId === "item_gilded_rod") w += 12;
  if (toolId === "item_abyssal_rod") w += 15;
  if (getWeather().rain > 0) w += 6;
  return w;
}

export function FishingMinigame() {
  const fishing = useGameStore((s) => s.fishing);
  const toolId = useGameStore((s) => s.equippedToolId);

  const [phase, setPhase] = useState<Phase>("wait");
  const [hits, setHits] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [marker, setMarker] = useState(50);
  const [zone, setZone] = useState({ center: 50, width: 26 });
  const [flash, setFlash] = useState<string | null>(null);

  // Mutable loop state (rAF + timers) kept in refs so taps read fresh values.
  const phaseRef = useRef<Phase>("wait");
  const hitsRef = useRef(0);
  const strikesRef = useRef(0);
  const markerRef = useRef(50);
  const zoneRef = useRef({ center: 50, width: 26 });
  const speedRef = useRef(1.55); // sweeps per second, ramps per hit
  const reelT0 = useRef(0);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const resourceIdRef = useRef<string | null>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearTimers = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const resolve = (success: boolean) => {
    const id = resourceIdRef.current;
    clearTimers();
    setPhaseBoth(success ? "caught" : "escaped");
    if (id) networkManager.sendFishingResolve(id, success);
    playSfx(success ? "harvest" : "shop_fail");
    // The server's chopResult/chopCancel clears store.fishing; this is a local
    // fallback so the card never lingers.
    window.setTimeout(() => useGameStore.getState().setFishing(null), 1400);
  };

  const startWait = () => {
    setPhaseBoth("wait");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPhaseBoth("bite");
      playSfx("fish_splash");
      timer.current = window.setTimeout(() => resolve(false), BITE_WINDOW_MS);
    }, 900 + Math.random() * 1700);
  };

  const startReel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const w = zoneWidth(toolId);
    const z = { center: 20 + Math.random() * 60, width: w };
    zoneRef.current = z;
    setZone(z);
    speedRef.current = 1.55;
    reelT0.current = performance.now();
    setPhaseBoth("reel");
    const tick = (t: number) => {
      if (phaseRef.current !== "reel") return;
      const s = (t - reelT0.current) / 1000;
      const pos = 50 + 48 * Math.sin(s * speedRef.current * Math.PI * 2);
      markerRef.current = pos;
      setMarker(pos);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const tap = () => {
    const p = phaseRef.current;
    if (p === "wait") {
      // Spooked it — the wait starts over.
      setFlash("🌊 Too soon…");
      window.setTimeout(() => setFlash(null), 700);
      playSfx("ui_click");
      startWait();
      return;
    }
    if (p === "bite") {
      playSfx("ui_click");
      startReel();
      return;
    }
    if (p === "reel") {
      const z = zoneRef.current;
      const inZone = Math.abs(markerRef.current - z.center) <= z.width / 2;
      if (inZone) {
        const nextHits = hitsRef.current + 1;
        hitsRef.current = nextHits;
        setHits(nextHits);
        playSfx("fish_splash");
        if (nextHits >= HITS_NEEDED) {
          resolve(true);
          return;
        }
        // Fish darts — new zone spot, a bit faster.
        speedRef.current += 0.32;
        const nz = { center: 18 + Math.random() * 64, width: z.width };
        zoneRef.current = nz;
        setZone(nz);
        setFlash("🎣 Hooked!");
        window.setTimeout(() => setFlash(null), 500);
      } else {
        const nextStrikes = strikesRef.current + 1;
        strikesRef.current = nextStrikes;
        setStrikes(nextStrikes);
        playSfx("shop_fail");
        setFlash("💢 Line strains!");
        window.setTimeout(() => setFlash(null), 600);
        if (nextStrikes >= STRIKES_ALLOWED) resolve(false);
      }
    }
  };

  // Session lifecycle: reset state whenever a new fishing session begins.
  useEffect(() => {
    if (!fishing) {
      clearTimers();
      return;
    }
    resourceIdRef.current = fishing.resourceId;
    preloadFishArt();
    hitsRef.current = 0;
    strikesRef.current = 0;
    setHits(0);
    setStrikes(0);
    setFlash(null);
    startWait();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fishing?.resourceId]);

  // Keyboard: Space / G / E act as the tap.
  useEffect(() => {
    if (!fishing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isUiTypingActive() || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "g" || k === "e") {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fishing?.resourceId]);

  if (!fishing) return null;

  const done = phase === "caught" || phase === "escaped";

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: "24%",
        transform: "translateX(-50%)",
        zIndex: 24,
        pointerEvents: "auto",
        width: "min(340px, 92vw)",
      }}
    >
      <div
        className="chibi-panel chibi-panel--floating"
        style={{ padding: "12px 14px", textAlign: "center", cursor: done ? "default" : "pointer", userSelect: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!done) tap();
        }}
      >
        {/* Header: phase title */}
        <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>
          {phase === "wait" && <>🎣 Waiting for a bite…</>}
          {phase === "bite" && <span style={{ color: "#d85f2f" }}>❗ BITE — TAP NOW!</span>}
          {phase === "reel" && <>🐟 Reel it in!</>}
          {phase === "caught" && <span style={{ color: "#2a8c5c" }}>✨ Caught it!</span>}
          {phase === "escaped" && <span style={{ color: "#c0392b" }}>💨 It got away…</span>}
        </div>

        {/* Wait/bite visual: a bobbing bobber */}
        {(phase === "wait" || phase === "bite") && (
          <div style={{ fontSize: "2rem", margin: "8px 0 2px" }}>
            <span
              style={{
                display: "inline-block",
                animation: phase === "wait" ? "chibi-avatar-bob 1.6s ease-in-out infinite" : "chibi-bite-shake 0.18s linear infinite",
              }}
            >
              {phase === "bite" ? "❗" : "🎣"}
            </span>
          </div>
        )}

        {/* Reel bar */}
        {phase === "reel" && (
          <div style={{ margin: "10px 2px 4px" }}>
            <div
              style={{
                position: "relative",
                height: 26,
                borderRadius: 999,
                background: "#dff0fa",
                border: "2px solid #a8cbe0",
                overflow: "hidden",
              }}
            >
              {/* green zone */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${zone.center - zone.width / 2}%`,
                  width: `${zone.width}%`,
                  background: "linear-gradient(180deg, #7edda0, #4bc07f)",
                  opacity: 0.9,
                }}
              />
              {/* marker */}
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  bottom: -2,
                  left: `calc(${marker}% - 3px)`,
                  width: 6,
                  borderRadius: 3,
                  background: "#2b3a49",
                }}
              />
              {/* fish riding the marker */}
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  left: `calc(${marker}% - 11px)`,
                  fontSize: "1.05rem",
                  pointerEvents: "none",
                }}
              >
                🐟
              </div>
            </div>
            {/* hits + line strength */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.78rem", fontWeight: 700 }}>
              <span>
                {Array.from({ length: HITS_NEEDED }, (_, i) => (
                  <span key={i} style={{ opacity: i < hits ? 1 : 0.25 }}>🐟</span>
                ))}
              </span>
              <span title="Line strength">
                {Array.from({ length: STRIKES_ALLOWED }, (_, i) => (
                  <span key={i} style={{ opacity: i < STRIKES_ALLOWED - strikes ? 1 : 0.2 }}>🧵</span>
                ))}
              </span>
            </div>
          </div>
        )}

        {/* Flash message */}
        {flash && (
          <div style={{ fontSize: "0.78rem", fontWeight: 800, marginTop: 4 }}>{flash}</div>
        )}

        {/* Hint + give up */}
        {!done && (
          <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 6 }}>
            Tap the card (or <b>Space</b>/<b>G</b>) ·{" "}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                resolve(false);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#5a97e0",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: "0.68rem",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              give up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
