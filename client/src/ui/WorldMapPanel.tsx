import { ZONE_CONFIGS, getZoneDangerTier, type DangerTier } from "@metricbase/shared";
import { playSfx } from "../audio/soundEffects";
import { useGameStore } from "../store/gameStore";

// Hand-authored layout (0–100 box) for the world graph + the travel links.
const NODES: { id: string; x: number; y: number }[] = [
  { id: "zone_interior", x: 18, y: 20 },
  { id: "zone_hub", x: 28, y: 50 },
  { id: "zone_jail", x: 18, y: 80 },
  { id: "zone_wilderness", x: 52, y: 50 },
  { id: "zone_grotto", x: 74, y: 50 },
  { id: "zone_black", x: 92, y: 50 },
];
const LINKS: [string, string][] = [
  ["zone_hub", "zone_interior"],
  ["zone_hub", "zone_jail"],
  ["zone_hub", "zone_wilderness"],
  ["zone_wilderness", "zone_grotto"],
  ["zone_grotto", "zone_black"],
];

const TIER_COLOR: Record<DangerTier, string> = {
  safe: "#6fbf4f",
  yellow: "#e8b54a",
  red: "#d6453b",
  black: "#7a4fb0",
};
const TIER_LABEL: Record<DangerTier, string> = {
  safe: "Safe",
  yellow: "Wilds (opt-in PvP)",
  red: "Dangerous (PvP)",
  black: "Lawless (full-loot)",
};

export function WorldMapPanel() {
  const open = useGameStore((s) => s.mapOpen);
  const setOpen = useGameStore((s) => s.setMapOpen);
  const zoneId = useGameStore((s) => s.zoneId);

  if (!open) return null;

  const nodeById = (id: string) => NODES.find((n) => n.id === id)!;
  const tiersShown = Array.from(new Set(NODES.map((n) => getZoneDangerTier(n.id)))) as DangerTier[];

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="World map">
      <div className="chibi-panel chibi-panel--floating chibi-map">
        <div className="chibi-close-row">
          <div className="chibi-title chibi-title--sm chibi-sparkle-title">🗺️ World Map</div>
          <button
            type="button"
            className="chibi-btn chibi-btn--ghost"
            onClick={() => {
              playSfx("ui_close");
              setOpen(false);
            }}
            aria-label="Close map"
          >
            ×
          </button>
        </div>

        <div className="chibi-map__canvas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="chibi-map__svg">
            {LINKS.map(([a, b]) => {
              const na = nodeById(a);
              const nb = nodeById(b);
              return (
                <line
                  key={`${a}-${b}`}
                  x1={na.x}
                  y1={na.y}
                  x2={nb.x}
                  y2={nb.y}
                  stroke="#b59a78"
                  strokeWidth={1.4}
                  strokeDasharray="3 2"
                  strokeLinecap="round"
                />
              );
            })}
            {NODES.map((node) => {
              const cfg = ZONE_CONFIGS[node.id];
              if (!cfg) return null;
              const tier = getZoneDangerTier(node.id);
              const here = node.id === zoneId;
              return (
                <g key={node.id}>
                  {here && <circle cx={node.x} cy={node.y} r={7.5} fill="none" stroke="#ffcf4a" strokeWidth={1.4} className="chibi-map__ring" />}
                  <circle cx={node.x} cy={node.y} r={5} fill={TIER_COLOR[tier]} stroke="#2c1f14" strokeWidth={1.2} />
                  <text x={node.x} y={node.y - 8} textAnchor="middle" className="chibi-map__label">
                    {cfg.displayName}
                  </text>
                  {here && (
                    <text x={node.x} y={node.y + 11} textAnchor="middle" className="chibi-map__here">
                      You are here
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="chibi-map__legend">
          {tiersShown.map((tier) => (
            <span key={tier} className="chibi-map__legend-item">
              <span className="chibi-map__swatch" style={{ background: TIER_COLOR[tier] }} />
              {TIER_LABEL[tier]}
            </span>
          ))}
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 6, textAlign: "center" }}>
          Travel between zones through the portals inside each area.
        </div>
      </div>
    </div>
  );
}
