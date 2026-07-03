import { MAX_ZONE_PASS_PRICE, ZONE_SLOT_COST } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import {
  networkManager,
  type MyWorldEntry,
  type PipGoldInfoPayload,
  type WorldDirectoryEntry,
} from "../game/network";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
import { useGameStore } from "../store/gameStore";

type Tab = "directory" | "mine";
type DirSort = "popular" | "new";

// Paid-but-uncredited Pip gold purchases are stashed locally so the payment is
// never lost: if verification is slow, the tab reloads, or the connection drops
// mid-credit, the client re-submits the SAME signature until the (idempotent)
// server credits it.
const UNCLAIMED_KEY = "pipUnclaimedGold";
type UnclaimedBuy = { signature: string; amount: number };

function loadUnclaimed(): UnclaimedBuy[] {
  try {
    const raw = JSON.parse(localStorage.getItem(UNCLAIMED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.signature === "string") : [];
  } catch {
    return [];
  }
}
function saveUnclaimed(list: UnclaimedBuy[]) {
  try {
    localStorage.setItem(UNCLAIMED_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — best effort */
  }
}
function addUnclaimed(buy: UnclaimedBuy) {
  const list = loadUnclaimed();
  if (!list.some((x) => x.signature === buy.signature)) {
    list.push(buy);
    saveUnclaimed(list);
  }
}
function removeUnclaimed(signature: string) {
  saveUnclaimed(loadUnclaimed().filter((x) => x.signature !== signature));
}

export function WorldsPanel() {
  const open = useGameStore((state) => state.worldsOpen);
  const setWorldsOpen = useGameStore((state) => state.setWorldsOpen);
  const playerGold = useGameStore((state) => state.playerGold);
  const playerName = useGameStore((state) => state.playerName);
  const walletAddress = useGameStore((state) => state.walletAddress);

  const [tab, setTab] = useState<Tab>("directory");
  const [dirSort, setDirSort] = useState<DirSort>("popular");
  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [buyGold, setBuyGold] = useState("");
  const [directory, setDirectory] = useState<WorldDirectoryEntry[]>([]);
  const [mine, setMine] = useState<MyWorldEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Local edits to a world's meta before saving.
  const [drafts, setDrafts] = useState<Record<string, { displayName: string; passPrice: string; gatherTax: string }>>({});

  useEffect(() => {
    const offDir = networkManager.onWorldsList(setDirectory);
    const offMine = networkManager.onMyWorlds((worlds) => {
      setMine(worlds);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const w of worlds) {
          if (!next[w.zoneId]) next[w.zoneId] = { displayName: w.displayName, passPrice: String(w.passPrice), gatherTax: String(w.gatherTax) };
        }
        return next;
      });
    });
    const offResult = networkManager.onZoneResult((r) => {
      setPending(false);
      setNotice(r.ok ? r.message ?? "Done." : r.error ?? "Something went wrong.");
      // Refresh after any mutation.
      networkManager.requestMyWorlds();
      networkManager.requestWorldsList();
    });
    const offPipInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offPipResult = networkManager.onPipGoldResult((r) => {
      setPending(false);
      if (r.ok) {
        if (r.signature) removeUnclaimed(r.signature);
        setNotice(
          r.viaPending
            ? `Bought ${(r.gold ?? 0).toLocaleString()} gold — it'll appear on your next relog.`
            : `Bought ${(r.gold ?? 0).toLocaleString()} gold from Pip!`,
        );
        return;
      }
      // Failure: keep the signature stashed for another try UNLESS it's terminal
      // (already credited, or an on-chain rejection that will never succeed).
      const terminal =
        !!r.error &&
        (/already/i.test(r.error) || (r.retryable === false && /(on-chain|too few|did not send|failed)/i.test(r.error)));
      if (r.signature && terminal) removeUnclaimed(r.signature);
      setNotice(r.error ?? "Purchase failed.");
    });
    return () => {
      offDir();
      offMine();
      offResult();
      offPipInfo();
      offPipResult();
    };
  }, []);

  // Fetch fresh lists whenever the panel opens.
  useEffect(() => {
    if (open) {
      networkManager.requestWorldsList();
      networkManager.requestMyWorlds();
      networkManager.requestPipGoldInfo();
      setNotice(null);
    }
  }, [open]);

  // Recover any paid-but-uncredited Pip purchases: re-submit each stashed
  // signature. The server is idempotent, so this safely finishes a purchase that
  // failed to credit earlier (slow confirmation, reload, or a dropped socket).
  useEffect(() => {
    if (!open || !walletAddress) return;
    const unclaimed = loadUnclaimed();
    if (unclaimed.length === 0) return;
    setNotice("Recovering a previous $BASE payment…");
    for (const buy of unclaimed) networkManager.sendBuyGoldFromPip(buy.signature, buy.amount);
  }, [open, walletAddress]);

  if (!open) return null;

  const close = () => {
    playSfx("ui_close");
    setWorldsOpen(false);
  };

  const buySlot = () => {
    // The server waives the cost for admin wallets and otherwise rejects with a
    // clear message, so we send unconditionally rather than gating on gold here.
    playSfx("ui_click");
    setPending(true);
    networkManager.sendBuyZoneSlot();
  };

  const enter = (zoneId: string) => {
    playSfx("ui_click");
    setWorldsOpen(false);
    void networkManager.enterWorld(zoneId);
  };

  const buyPass = (zoneId: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendBuyZonePass(zoneId);
  };

  const saveMeta = (
    w: MyWorldEntry,
    patch: { displayName?: string; passPrice?: number; published?: boolean; gatherTax?: number },
  ) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendZoneMetaSet(w.zoneId, patch);
  };

  const collect = (zoneId: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendZoneEarningsCollect(zoneId);
  };

  const buyGoldFromPip = async () => {
    const amount = Number(buyGold) || 0;
    if (!walletAddress) return setNotice("Connect your wallet first.");
    if (!pipInfo?.enabled || !pipInfo.treasury) return setNotice("Pip's gold desk is closed right now.");
    if (amount <= 0) return setNotice("Enter how much gold to buy.");
    playSfx("ui_click");
    setPending(true);
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: pipInfo.treasury,
        mint: pipInfo.mint,
        uiAmount: amount,
        decimals: pipInfo.decimals,
        rpcUrl: pipInfo.rpcUrl,
      });
      // Record the paid signature BEFORE asking the server to credit it, so a
      // reload or dropped connection can't lose a real payment.
      addUnclaimed({ signature, amount });
      networkManager.sendBuyGoldFromPip(signature, amount);
      setBuyGold("");
    } catch (err) {
      setPending(false);
      setNotice(err instanceof Error ? err.message : "Payment was cancelled.");
    }
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 420, width: "92vw" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🌍 Worlds</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className={`chibi-btn ${tab === "directory" ? "chibi-btn--primary" : "chibi-btn--secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setTab("directory")}
        >
          Explore
        </button>
        <button
          type="button"
          className={`chibi-btn ${tab === "mine" ? "chibi-btn--primary" : "chibi-btn--secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setTab("mine")}
        >
          My Worlds
        </button>
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 10, padding: "8px 12px", fontSize: "0.8rem" }}>
          {notice}
        </div>
      )}

      {tab === "directory" && (
        <div style={{ marginTop: 12, maxHeight: "50vh", overflowY: "auto" }}>
          {directory.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(
                [
                  ["popular", "🔥 Popular"],
                  ["new", "✨ New"],
                ] as [DirSort, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chibi-btn ${dirSort === id ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
                  style={{ flex: 1, padding: "6px 10px", fontSize: "0.74rem", minHeight: 34 }}
                  onClick={() => setDirSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {directory.length === 0 && (
            <div className="chibi-text-muted" style={{ fontSize: "0.82rem" }}>
              No published Worlds yet. Found one from “My Worlds”!
            </div>
          )}
          {(() => {
            const sorted = [...directory].sort((a, b) =>
              dirSort === "new" ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : b.visits - a.visits,
            );
            // The most-visited world (with real traffic) gets a Featured crown.
            const featuredId = [...directory].sort((a, b) => b.visits - a.visits).find((w) => w.visits > 0)?.zoneId;
            return sorted.map((w) => (
              <div key={w.zoneId} className="chibi-card" style={{ marginBottom: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>{w.displayName}</span>
                  {w.zoneId === featuredId && (
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        background: "#ffe9b0",
                        border: "1.5px solid #e0a92e",
                        borderRadius: 999,
                        padding: "1px 8px",
                        color: "#8a6414",
                      }}
                    >
                      👑 Featured
                    </span>
                  )}
                  {(w.online ?? 0) > 0 && (
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        background: "#dcf5e7",
                        border: "1.5px solid #3fae74",
                        borderRadius: 999,
                        padding: "1px 8px",
                        color: "#1d7a4c",
                      }}
                    >
                      🟢 {w.online} here now
                    </span>
                  )}
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.73rem", marginTop: 3, lineHeight: 1.5 }}>
                  by {w.ownerName} · 👣 {w.visits.toLocaleString()} visits · 🧱 {w.props ?? 0} builds
                  <br />
                  {w.passPrice > 0 ? `🎟️ ${w.passPrice.toLocaleString()}g pass` : "🆓 Free entry"}
                  {(w.gatherTax ?? 0) > 0 ? ` · 🌾 ${w.gatherTax}g gather tax` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button type="button" className="chibi-btn chibi-btn--mint" style={{ flex: 1 }} onClick={() => enter(w.zoneId)}>
                    Enter
                  </button>
                  {w.passPrice > 0 && w.ownerName !== playerName && (
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--gold"
                      style={{ flex: 1 }}
                      disabled={pending || playerGold < w.passPrice}
                      onClick={() => buyPass(w.zoneId)}
                    >
                      Buy Pass
                    </button>
                  )}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {tab === "mine" && (
        <div style={{ marginTop: 12, maxHeight: "50vh", overflowY: "auto" }}>
          <button
            type="button"
            className="chibi-btn chibi-btn--primary"
            style={{ width: "100%" }}
            disabled={pending}
            onClick={buySlot}
          >
            + Found a World ({ZONE_SLOT_COST.toLocaleString()}g)
          </button>
          <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
            You have {playerGold.toLocaleString()}g.
          </div>

          {/* Pip's currency desk: buy gold 1:1 with $BASE. */}
          <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
            <div className="chibi-label" style={{ marginBottom: 4 }}>💰 Buy gold from Pip (1 gold = 1 $BASE)</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="chibi-input"
                inputMode="numeric"
                placeholder="Gold amount"
                value={buyGold}
                style={{ flex: 1 }}
                onChange={(e) => setBuyGold(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                className="chibi-btn chibi-btn--gold"
                disabled={pending || !pipInfo?.enabled || !walletAddress}
                onClick={() => void buyGoldFromPip()}
              >
                Buy
              </button>
            </div>
            {!walletAddress && (
              <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
                Connect your wallet to buy gold.
              </div>
            )}
          </div>

          {mine.map((w) => {
            const draft = drafts[w.zoneId] ?? { displayName: w.displayName, passPrice: String(w.passPrice), gatherTax: String(w.gatherTax) };
            return (
              <div key={w.zoneId} className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
                <div className="chibi-label" style={{ marginBottom: 4 }}>Name</div>
                <input
                  className="chibi-input"
                  value={draft.displayName}
                  maxLength={24}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [w.zoneId]: { ...draft, displayName: e.target.value } }))
                  }
                />
                <div className="chibi-label" style={{ margin: "8px 0 4px" }}>Pass price (gold, 0 = free)</div>
                <input
                  className="chibi-input"
                  inputMode="numeric"
                  value={draft.passPrice}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [w.zoneId]: { ...draft, passPrice: e.target.value.replace(/[^0-9]/g, "") } }))
                  }
                />
                <div className="chibi-label" style={{ margin: "8px 0 4px" }}>Gather tax (gold per harvest, 0 = free)</div>
                <input
                  className="chibi-input"
                  inputMode="numeric"
                  value={draft.gatherTax}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [w.zoneId]: { ...draft, gatherTax: e.target.value.replace(/[^0-9]/g, "") } }))
                  }
                />
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 2 }}>
                  Max {MAX_ZONE_PASS_PRICE.toLocaleString()}g pass. Visitors pay the tax to you per node they harvest.
                </div>

                {/* Owner analytics: lifetime performance of this World. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {(
                    [
                      ["👣", "Visits", w.visits],
                      ["🟢", "Here now", w.online ?? 0],
                      ["🎟️", "Passes sold", w.passesSold ?? 0],
                      ["🪙", "Pass gold", w.passGold ?? 0],
                      ["🌾", "Tax gold", w.taxGold ?? 0],
                      ["💰", "Lifetime", w.lifetimeEarnings ?? 0],
                    ] as [string, string, number][]
                  ).map(([em, label, val]) => (
                    <div
                      key={label}
                      title={val.toLocaleString()}
                      style={{
                        background: "#fffdf6",
                        border: "1.5px solid #e6d3aa",
                        borderRadius: 10,
                        padding: "6px 8px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                        {val >= 10000 ? `${(val / 1000).toFixed(val >= 100000 ? 0 : 1)}k` : val.toLocaleString()}
                      </div>
                      <div className="chibi-text-muted" style={{ fontSize: "0.6rem" }}>
                        {em} {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--mint"
                    disabled={pending}
                    onClick={() =>
                      saveMeta(w, {
                        displayName: draft.displayName.trim() || w.displayName,
                        passPrice: Math.min(MAX_ZONE_PASS_PRICE, Number(draft.passPrice) || 0),
                        gatherTax: Number(draft.gatherTax) || 0,
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={`chibi-btn ${w.published ? "chibi-btn--secondary" : "chibi-btn--gold"}`}
                    disabled={pending}
                    onClick={() => saveMeta(w, { published: !w.published })}
                  >
                    {w.published ? "Unpublish" : "Publish"}
                  </button>
                  <button type="button" className="chibi-btn chibi-btn--primary" onClick={() => enter(w.zoneId)}>
                    🔨 Build
                  </button>
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--gold"
                    disabled={pending || w.earnings <= 0}
                    onClick={() => collect(w.zoneId)}
                  >
                    Collect {w.earnings > 0 ? `${w.earnings.toLocaleString()}g` : ""}
                  </button>
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 6 }}>
                  ✏️ Tap “🔨 Build” to enter your World — the Build bar appears bottom-left for placing props & painting ground.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
