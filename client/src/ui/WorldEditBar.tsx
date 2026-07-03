import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { playSfx } from "../audio/soundEffects";
import {
  beginWorldEdit,
  endWorldEdit,
  getGameCanvas,
  getWorldEditDraft,
  placeWorldEditAt,
  setWorldEditTool,
  type EditTool,
} from "../game/inputControl";
import { networkManager } from "../game/network";
import { zoneAssetPrice } from "@metricbase/shared";
import { ZONE_ASSETS, type ZoneAssetCategory } from "../game/zoneAssets";
import { useGameStore } from "../store/gameStore";

const CATEGORIES: { id: ZoneAssetCategory; label: string }[] = [
  { id: "ground", label: "Ground" },
  { id: "structure", label: "Build" },
  { id: "resource", label: "Nodes" },
  { id: "decor", label: "Decor" },
];

export function WorldEditBar() {
  const zoneId = useGameStore((state) => state.zoneId);
  const setWorldEditing = useGameStore((state) => state.setWorldEditing);
  const setBuildShopOpen = useGameStore((state) => state.setBuildShopOpen);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<ZoneAssetCategory>("structure");
  const [tool, setTool] = useState<EditTool | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Floating drag ghost while dragging a palette item onto the map.
  const [ghost, setGhost] = useState<{ file: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const off = networkManager.onMyWorlds((worlds) => {
      setOwnedIds(new Set(worlds.map((w) => w.zoneId)));
    });
    networkManager.requestMyWorlds();
    const offResult = networkManager.onZoneResult((r) => {
      if (r.message) setNotice(r.message);
      else if (r.error) setNotice(r.error);
      window.setTimeout(() => setNotice(null), 2500);
    });
    const offInv = networkManager.onAssetInventory(setOwned);
    return () => {
      off();
      offResult();
      offInv();
    };
  }, []);

  // Refresh ownership whenever we enter a zone, so the Build button reliably
  // appears right after transferring into a World we own.
  useEffect(() => {
    networkManager.requestMyWorlds();
  }, [zoneId]);

  // Leaving the zone (or losing ownership) ends any active edit session.
  useEffect(() => {
    if (editing && !ownedIds.has(zoneId)) {
      endWorldEdit();
      setEditing(false);
      setTool(null);
      setWorldEditing(false);
    }
  }, [zoneId, ownedIds, editing, setWorldEditing]);

  const assetsInCategory = useMemo(
    () => ZONE_ASSETS.filter((a) => a.category === category),
    [category],
  );

  if (!ownedIds.has(zoneId)) return null;

  const startEdit = () => {
    playSfx("ui_open");
    beginWorldEdit(zoneId);
    setEditing(true);
    setWorldEditing(true);
  };

  const pick = (assetId: string, cat: ZoneAssetCategory) => {
    playSfx("ui_click");
    const t: EditTool = { type: cat === "ground" ? "ground" : "prop", value: assetId };
    setTool(t);
    setWorldEditTool(t);
  };

  const pickErase = () => {
    playSfx("ui_click");
    const t: EditTool = { type: "erase", value: "" };
    setTool(t);
    setWorldEditTool(t);
  };

  const pickSpawn = () => {
    playSfx("ui_click");
    const t: EditTool = { type: "spawn", value: "" };
    setTool(t);
    setWorldEditTool(t);
  };

  // Drag a palette item out onto the map: select it as the tool, follow the
  // pointer with a ghost, and drop it on whatever tile is under the cursor.
  const startDrag = (asset: { id: string; file: string; category: ZoneAssetCategory }, e: ReactPointerEvent) => {
    e.preventDefault();
    pick(asset.id, asset.category);
    setGhost({ file: asset.file, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setGhost((g) => (g ? { ...g, x: ev.clientX, y: ev.clientY } : g));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      // Only place if released over the game canvas (not over the palette / UI).
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (el && el === getGameCanvas()) {
        placeWorldEditAt(ev.clientX, ev.clientY);
        playSfx("ui_click");
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const save = () => {
    playSfx("ui_click");
    const draft = getWorldEditDraft();
    if (draft) networkManager.sendZoneBuildSave(zoneId, draft);
  };

  const exit = () => {
    playSfx("ui_close");
    endWorldEdit();
    setEditing(false);
    setTool(null);
    setWorldEditing(false);
  };

  if (!editing) {
    return (
      <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 18, pointerEvents: "auto" }}>
        <button
          type="button"
          className="chibi-btn chibi-btn--gold"
          style={{ padding: "10px 16px", fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={startEdit}
        >
          🔨 Build
        </button>
      </div>
    );
  }

  return (
    <div
      className="chibi-panel chibi-panel--floating"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: "min(300px, 82vw)",
        maxHeight: "calc(100% - 16px)",
        overflowY: "auto",
        zIndex: 23,
        pointerEvents: "auto",
      }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm">🔨 Build Mode</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={exit} aria-label="Exit build">
          ✕
        </button>
      </div>
      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.72rem", margin: "4px 0" }}>
          {notice}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chibi-btn ${category === c.id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
            style={{ flex: 1, padding: "8px 4px", fontSize: "0.72rem" }}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          marginTop: 8,
          maxHeight: "34vh",
          overflowY: "auto",
        }}
      >
        {assetsInCategory.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chibi-btn ${tool?.value === a.id ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
            style={{ padding: "8px 6px", fontSize: "0.72rem", touchAction: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            onPointerDown={(e) => startDrag(a, e)}
            onClick={() => pick(a.id, a.category)}
          >
            <img src={`/assets/${a.file}`} alt="" draggable={false} style={{ width: 40, height: 40, objectFit: "contain", pointerEvents: "none" }} />
            {a.label}
            <span style={{ fontSize: "0.62rem", opacity: 0.85 }}>
              {zoneAssetPrice(a.id) === 0
                ? "Free"
                : (owned[a.id] ?? 0) > 0
                  ? `×${owned[a.id]}`
                  : `${zoneAssetPrice(a.id).toLocaleString()}g`}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="chibi-btn chibi-btn--gold"
        style={{ width: "100%", marginTop: 6, padding: "8px 10px" }}
        onClick={() => {
          playSfx("ui_open");
          setBuildShopOpen(true);
        }}
      >
        🛒 Build Shop
      </button>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className={`chibi-btn ${tool?.type === "erase" ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
          style={{ flex: 1, padding: "10px 12px" }}
          onClick={pickErase}
        >
          🧹 Erase
        </button>
        <button
          type="button"
          className={`chibi-btn ${tool?.type === "spawn" ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
          style={{ flex: 1, padding: "10px 12px" }}
          onClick={pickSpawn}
        >
          📍 Spawn
        </button>
        <button type="button" className="chibi-btn chibi-btn--mint" style={{ flex: 1, padding: "10px 12px" }} onClick={save}>
          💾 Save
        </button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 6 }}>
        {tool?.type === "erase"
          ? "Tap a tile to remove what's on it."
          : tool?.type === "spawn"
            ? "Tap a tile to set where visitors arrive (📍)."
            : "Drag an item onto the map to place it — or tap it, then tap tiles."}
      </div>

      {ghost && (
        <img
          src={`/assets/${ghost.file}`}
          alt=""
          draggable={false}
          style={{
            position: "fixed",
            left: ghost.x,
            top: ghost.y,
            width: 64,
            height: 64,
            objectFit: "contain",
            transform: "translate(-50%, -60%)",
            pointerEvents: "none",
            opacity: 0.85,
            zIndex: 9999,
          }}
        />
      )}
    </div>
  );
}
