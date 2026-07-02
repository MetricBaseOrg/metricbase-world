import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import {
  beginWorldEdit,
  endWorldEdit,
  getWorldEditDraft,
  setWorldEditTool,
  type EditTool,
} from "../game/inputControl";
import { networkManager } from "../game/network";
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
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<ZoneAssetCategory>("structure");
  const [tool, setTool] = useState<EditTool | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    return () => {
      off();
      offResult();
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
    }
  }, [zoneId, ownedIds, editing]);

  const assetsInCategory = useMemo(
    () => ZONE_ASSETS.filter((a) => a.category === category),
    [category],
  );

  if (!ownedIds.has(zoneId)) return null;

  const startEdit = () => {
    playSfx("ui_open");
    beginWorldEdit(zoneId);
    setEditing(true);
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
  };

  if (!editing) {
    return (
      <div className="chibi-anchor chibi-anchor--bottom-left" style={{ pointerEvents: "auto", margin: 12 }}>
        <button type="button" className="chibi-btn chibi-btn--gold" onClick={startEdit}>
          🔨 Build World
        </button>
      </div>
    );
  }

  return (
    <div
      className="chibi-panel chibi-anchor chibi-anchor--bottom-left"
      style={{ pointerEvents: "auto", margin: 12, maxWidth: 300, width: "80vw" }}
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
            className={`chibi-btn ${category === c.id ? "chibi-btn--primary" : "chibi-btn--secondary"}`}
            style={{ flex: 1, padding: "4px 2px", fontSize: "0.72rem" }}
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
            className={`chibi-btn ${tool?.value === a.id ? "chibi-btn--mint" : "chibi-btn--secondary"}`}
            style={{ padding: "6px 4px", fontSize: "0.72rem" }}
            onClick={() => pick(a.id, a.category)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className={`chibi-btn ${tool?.type === "erase" ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
          style={{ flex: 1 }}
          onClick={pickErase}
        >
          🧹 Erase
        </button>
        <button type="button" className="chibi-btn chibi-btn--mint" style={{ flex: 1 }} onClick={save}>
          💾 Save
        </button>
      </div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 6 }}>
        Tap a tile to {tool?.type === "erase" ? "remove" : tool ? "place" : "…pick a tool first"}.
      </div>
    </div>
  );
}
