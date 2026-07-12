import { FISH_RARITY_COLORS, getFishSpecies, type FishRarity } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

/**
 * Catch celebration — plays when the server confirms WHICH fish was landed:
 * the fish leaps out of a splash, a rarity-colored sparkle burst fires, and a
 * banner names the species. Rarer fish linger longer, burst harder, and
 * epic/legendary catches get spinning glow rays.
 *
 * Fish art lives in client/public/assets/fish/<art>.png (transparent PNGs the
 * artist drops in); until a file exists the species' emoji stands in.
 */

const LINGER_MS: Record<FishRarity, number> = {
  common: 1700,
  uncommon: 2000,
  rare: 2600,
  epic: 3100,
  legendary: 3600,
};

const SPARKLES: Record<FishRarity, number> = {
  common: 6,
  uncommon: 10,
  rare: 16,
  epic: 22,
  legendary: 30,
};

const RARITY_LABEL: Record<FishRarity, string> = {
  common: "Caught!",
  uncommon: "Uncommon!",
  rare: "RARE!",
  epic: "EPIC!",
  legendary: "LEGENDARY!",
};

const FADE_MS = 350;

export function CatchCelebration() {
  const lastCatch = useGameStore((s) => s.lastCatch);
  const [artFailed, setArtFailed] = useState(false);

  // Auto-dismiss after the rarity's linger time; tap dismisses early.
  useEffect(() => {
    if (!lastCatch) return;
    setArtFailed(false);
    const species = getFishSpecies(lastCatch.itemId);
    const rarity = (species?.rarity ?? "common") as FishRarity;
    if (rarity === "rare" || rarity === "epic" || rarity === "legendary") playSfx("fish_fanfare");
    const t = window.setTimeout(
      () => useGameStore.getState().setLastCatch(null),
      LINGER_MS[rarity],
    );
    return () => window.clearTimeout(t);
  }, [lastCatch]);

  if (!lastCatch) return null;
  const species = getFishSpecies(lastCatch.itemId);
  if (!species) return null;

  const rarity = species.rarity;
  const color = FISH_RARITY_COLORS[rarity];
  const linger = LINGER_MS[rarity];
  const sparkleCount = SPARKLES[rarity];
  const fancy = rarity === "epic" || rarity === "legendary";
  const big = rarity === "rare" || fancy;

  return (
    // pointerEvents none: the celebration must never eat movement taps — a
    // full-screen auto layer left mobile players unable to move (their first
    // taps only dismissed the overlay) for the whole linger. Tap the banner
    // itself to dismiss early; everything else auto-fades.
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        animation: `chibi-catch-fadeout ${FADE_MS}ms ease-in ${linger - FADE_MS}ms forwards`,
      }}
    >
      <div style={{ position: "relative", width: 0, height: 0 }}>
        {/* Spinning glow rays (epic/legendary only) */}
        {fancy && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: `conic-gradient(${Array.from({ length: 12 }, (_, i) =>
                `${i % 2 === 0 ? `${color}55` : "transparent"} ${(i / 12) * 100}% ${((i + 1) / 12) * 100}%`,
              ).join(", ")})`,
              maskImage: "radial-gradient(circle, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 70%)",
              animation: "chibi-catch-rays 6s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Sparkle burst */}
        {Array.from({ length: sparkleCount }, (_, i) => {
          const angle = (360 / sparkleCount) * i + (i % 2) * 9;
          const dist = 70 + (i % 4) * 22 + (big ? 26 : 0);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -4,
                top: -4,
                width: 8,
                height: 8,
                borderRadius: i % 3 === 0 ? 2 : "50%",
                background: i % 4 === 3 ? "#fff" : color,
                boxShadow: `0 0 6px ${color}`,
                // @ts-expect-error CSS custom props
                "--angle": `${angle}deg`,
                "--dist": `${dist}px`,
                animation: `chibi-catch-sparkle ${0.8 + (i % 3) * 0.25}s ease-out ${(i % 5) * 0.06}s both`,
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* Splash ring + droplets at the waterline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 54,
            width: 110,
            height: 26,
            transform: "translateX(-50%)",
            borderRadius: "50%",
            border: "3px solid #9bd4f5",
            background: "rgba(155, 212, 245, 0.25)",
            animation: "chibi-catch-splash 0.7s ease-out both",
            pointerEvents: "none",
          }}
        />
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={`d${i}`}
            style={{
              position: "absolute",
              left: -3 + (i - 3) * 4,
              top: 50,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#9bd4f5",
              // @ts-expect-error CSS custom props
              "--dx": `${(i - 3) * 16}px`,
              "--dy": `${-34 - (i % 3) * 14}px`,
              animation: `chibi-catch-droplet 0.75s ease-out ${i * 0.03}s both`,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* The fish itself, leaping */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              animation: "chibi-catch-leap 1.1s cubic-bezier(0.2, 0.9, 0.3, 1) both",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: big ? 132 : 104,
              height: big ? 132 : 104,
              filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.25)) drop-shadow(0 0 ${big ? 18 : 8}px ${color}88)`,
            }}
          >
            {artFailed ? (
              <span style={{ fontSize: big ? "4.4rem" : "3.4rem" }}>{species.emoji}</span>
            ) : (
              <img
                src={`/assets/fish/${species.art}`}
                alt={species.name}
                onError={() => setArtFailed(true)}
                style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "auto" }}
              />
            )}
          </div>
        </div>

        {/* Rarity banner — the one tappable piece (dismisses early) */}
        <div
          onPointerDown={() => useGameStore.getState().setLastCatch(null)}
          style={{
            position: "absolute",
            left: 0,
            top: big ? -108 : -92,
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: "80vw",
            textAlign: "center",
            animation: "chibi-catch-banner 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) 0.28s both",
            pointerEvents: "auto",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "3px 14px",
              borderRadius: 999,
              background: color,
              color: "#fff",
              fontWeight: 900,
              fontSize: fancy ? "1.05rem" : "0.85rem",
              letterSpacing: "0.06em",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              boxShadow: `0 2px 10px ${color}99`,
            }}
          >
            {RARITY_LABEL[rarity]}
          </div>
          <div
            style={{
              marginTop: 5,
              fontWeight: 900,
              fontSize: fancy ? "1.3rem" : "1.05rem",
              color: "#fff",
              textShadow: "0 2px 4px rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.35)",
            }}
          >
            {species.name}
            {lastCatch.quantity > 1 && (
              <span style={{ opacity: 0.9, fontSize: "0.85em" }}> ×{lastCatch.quantity}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
