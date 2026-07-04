import {
  ITEMS,
  JOB_KINDS,
  JOB_MAX_REWARD,
  JOB_MIN_REWARD,
  isSupplyItem,
  type JobKind,
  type JobView,
  type JobsStatePayload,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * Player-to-player Job Board: hire other players (post a contract with an
 * escrowed gold reward) or get hired (accept a job from the board, do the
 * work, get paid automatically). Opened from the ⚙️ menu; works in every zone
 * and player World.
 */
export function JobsPanel() {
  const open = useGameStore((s) => s.jobsOpen);
  const setOpen = useGameStore((s) => s.setJobsOpen);
  const gold = useGameStore((s) => s.playerGold);
  const [state, setState] = useState<JobsStatePayload | null>(null);
  const [tab, setTab] = useState<"board" | "hire">("board");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Post form
  const [kind, setKind] = useState<JobKind>("supply");
  const [itemId, setItemId] = useState<string>(
    () => Object.values(ITEMS).find((d) => isSupplyItem(d.id))?.id ?? "",
  );
  const [qty, setQty] = useState(10);
  const [reward, setReward] = useState(100);

  const supplyItems = useMemo(
    () =>
      Object.values(ITEMS)
        .filter((d) => isSupplyItem(d.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  useEffect(() => {
    const offState = networkManager.onJobsState((s) => {
      setState(s);
      setPending(false);
    });
    const offResult = networkManager.onJobResult((r) => {
      setPending(false);
      setNotice(r.ok ? (r.message ?? "Done!") : (r.error ?? "Something went wrong."));
      if (r.ok) playSfx("ui_open");
    });
    const offChanged = networkManager.onJobsChanged(() => {
      if (useGameStore.getState().jobsOpen) networkManager.requestJobs();
    });
    return () => {
      offState();
      offResult();
      offChanged();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setNotice(null);
      networkManager.requestJobs();
    }
  }, [open]);

  if (!open) return null;

  const act = (action: "jobCancel" | "jobAccept" | "jobAbandon" | "jobDeliver" | "jobCollect" | "jobDismiss", id: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendJobAction(action, id);
  };

  const post = () => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendJobPost(kind, JOB_KINDS[kind].needsItem ? itemId : null, qty, reward);
  };

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  const def = JOB_KINDS[kind];
  const itemName = (id: string | null) => (id && ITEMS[id] ? ITEMS[id].name : "items");

  const jobCard = (j: JobView, actions: React.ReactNode, extra?: string) => {
    const d = JOB_KINDS[j.kind];
    const pct = j.qty > 0 ? Math.round((j.progress / j.qty) * 100) : 0;
    return (
      <div key={j.id} className="chibi-card" style={{ marginTop: 6, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: "1.3rem" }}>{d.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{d.describe(j.qty, itemName(j.itemId))}</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
              by {j.employerName} · pays <b style={{ color: "#b8860b" }}>{j.rewardGold.toLocaleString()}g</b>
              {j.workerName ? ` · worker: ${j.workerName}` : ""}
              {extra ? ` · ${extra}` : ""}
            </div>
            {j.status === "taken" && (
              <div style={{ marginTop: 4, height: 8, borderRadius: 999, background: "#f0e4c8", border: "1.5px solid #e6d3aa", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "#e0a92e", transition: "width .3s ease" }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{actions}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 440, width: "92vw", maxHeight: "82vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🧑‍🌾 Job Board</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" className={`chibi-btn ${tab === "board" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "8px 10px" }} onClick={() => setTab("board")}>
          🧺 Find Work
        </button>
        <button type="button" className={`chibi-btn ${tab === "hire" ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ flex: 1, padding: "8px 10px" }} onClick={() => setTab("hire")}>
          📜 Hire Players
        </button>
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}

      {!state && (
        <div className="chibi-text-muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
          Loading the job board…
        </div>
      )}

      {state && tab === "board" && (
        <>
          {state.myJob &&
            (() => {
              const j = state.myJob;
              return (
                <>
                  <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Your active job</div>
                  {jobCard(
                    j,
                    <>
                      {j.kind === "supply" && (
                        <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={() => act("jobDeliver", j.id)}>
                          📦 Deliver
                        </button>
                      )}
                      <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={() => act("jobAbandon", j.id)}>
                        Abandon
                      </button>
                    </>,
                    `${j.progress}/${j.qty} done`,
                  )}
                  <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4 }}>
                    {j.kind === "supply"
                      ? "Get the items into your bag, then press Deliver."
                      : "Progress counts automatically while you play — anywhere in the world."}
                  </div>
                </>
              );
            })()}

          <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Open jobs</div>
          {state.board.length === 0 && (
            <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>
              No open jobs right now — check back soon, or post one yourself!
            </div>
          )}
          {state.board.map((j) =>
            jobCard(
              j,
              <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending || !!state.myJob} onClick={() => act("jobAccept", j.id)}>
                Accept
              </button>,
            ),
          )}
        </>
      )}

      {state && tab === "hire" && (
        <>
          <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Post a job</div>
          <div className="chibi-card" style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.values(JOB_KINDS).map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  className={`chibi-btn ${kind === k.kind ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
                  style={{ padding: "6px 10px", fontSize: "0.72rem" }}
                  onClick={() => setKind(k.kind)}
                >
                  {k.emoji} {k.label}
                </button>
              ))}
            </div>

            {def.needsItem && (
              <label style={{ display: "block", marginTop: 8, fontSize: "0.72rem" }}>
                Item to deliver
                <select className="chibi-input" style={{ width: "100%", marginTop: 4 }} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  {supplyItems.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <label style={{ flex: 1, fontSize: "0.72rem" }}>
                Quantity ({def.minQty}–{def.maxQty})
                <input
                  type="number"
                  className="chibi-input"
                  style={{ width: "100%", marginTop: 4 }}
                  min={def.minQty}
                  max={def.maxQty}
                  value={qty}
                  onChange={(e) => setQty(Math.floor(Number(e.target.value) || 0))}
                />
              </label>
              <label style={{ flex: 1, fontSize: "0.72rem" }}>
                Reward (gold)
                <input
                  type="number"
                  className="chibi-input"
                  style={{ width: "100%", marginTop: 4 }}
                  min={JOB_MIN_REWARD}
                  max={JOB_MAX_REWARD}
                  value={reward}
                  onChange={(e) => setReward(Math.floor(Number(e.target.value) || 0))}
                />
              </label>
            </div>

            <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
              {def.describe(qty, def.needsItem ? itemName(itemId) : undefined)} — the {reward.toLocaleString()}g reward
              is taken from your gold now and held in escrow until the job is done (refunded if you cancel). You have{" "}
              {gold.toLocaleString()}g.
            </div>

            <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }} disabled={pending || reward > gold} onClick={post}>
              📜 Post job ({reward.toLocaleString()}g escrow)
            </button>
          </div>

          <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Your posted jobs</div>
          {state.posted.length === 0 && (
            <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>
              You haven't posted any jobs yet.
            </div>
          )}
          {state.posted.map((j) =>
            jobCard(
              j,
              <>
                {j.status === "open" && (
                  <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={() => act("jobCancel", j.id)}>
                    Cancel
                  </button>
                )}
                {j.itemsToCollect > 0 && (
                  <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={() => act("jobCollect", j.id)}>
                    📦 Collect {j.itemsToCollect}
                  </button>
                )}
                {j.status === "done" && j.itemsToCollect <= 0 && (
                  <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={() => act("jobDismiss", j.id)}>
                    ✓ Dismiss
                  </button>
                )}
              </>,
              j.status === "open" ? "waiting for a worker" : j.status === "taken" ? `${j.progress}/${j.qty} in progress` : "completed",
            ),
          )}
        </>
      )}
    </div>
  );
}
