// Magic Chests — buy a chest with $BASE, watch it open.
//
// Two things this UI must do, beyond looking nice:
//
//  1. SHOW THE ODDS. Paid loot boxes with hidden odds are indefensible (and
//     outright illegal in several markets). The rarity table is on the card,
//     before the buy button, not buried in a wiki page.
//  2. NEVER LOSE A PAID CHEST. The burn happens on-chain before the server
//     hears about it, so the signature is stashed in localStorage first and
//     re-submitted on next open — same recovery the gold desk and season stake
//     use. The server dedupes by signature, so a retry can't double-open.
import {
  CHEST_RARITY_COLOR,
  CHEST_RARITY_LABEL,
  CHEST_TIERS,
  expectedGold,
  type ChestOpenResultPayload,
  type ChestRarity,
  type ChestTierDef,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
import { ItemIcon } from "./ItemIcon";

const PENDING_KEY = "chestPendingOpen";
type PendingOpen = { tierId: string; signature: string };

function loadPending(): PendingOpen | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    return raw && typeof raw.signature === "string" && typeof raw.tierId === "string" ? raw : null;
  } catch {
    return null;
  }
}
function savePending(entry: PendingOpen | null) {
  try {
    if (entry) localStorage.setItem(PENDING_KEY, JSON.stringify(entry));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
}

const RARITY_ORDER: ChestRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

export function ChestPanel() {
  const open = useGameStore((s) => s.chestOpen);
  const setOpen = useGameStore((s) => s.setChestOpen);
  const walletAddress = useGameStore((s) => s.walletAddress);

  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ChestOpenResultPayload | null>(null);
  const [oddsFor, setOddsFor] = useState<string | null>(null);
  const recovered = useRef(false);

  useEffect(() => {
    const offInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offResult = networkManager.onChestOpenResult((r) => {
      setBusyTier(null);
      if (r.ok) {
        savePending(null);
        setResult(r);
        setNotice(null);
        playSfx("ui_open");
        return;
      }
      // "Already used/opened" is terminal — the chest was paid AND opened, so
      // stop retrying. Anything else may be transient; keep it stashed.
      if (r.error && /already/i.test(r.error)) savePending(null);
      setNotice(r.error ?? "Couldn't open that chest.");
    });
    networkManager.requestPipGoldInfo();
    return () => {
      offInfo();
      offResult();
    };
  }, []);

  // Finish a chest that was paid for but never opened (reload, dropped socket).
  useEffect(() => {
    if (!open || recovered.current || !walletAddress) return;
    const stash = loadPending();
    if (!stash) return;
    recovered.current = true;
    setNotice("Finishing a chest you already paid for…");
    setBusyTier(stash.tierId);
    networkManager.sendChestOpen(stash.tierId, stash.signature);
  }, [open, walletAddress]);

  if (!open) return null;

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
    setResult(null);
    setNotice(null);
  };

  const buy = async (tier: ChestTierDef) => {
    if (!walletAddress) return setNotice("Connect your wallet to open chests.");
    if (!pipInfo?.enabled || !pipInfo.treasury) return setNotice("Chests are closed right now.");
    playSfx("ui_click");
    setBusyTier(tier.id);
    setNotice(null);
    setResult(null);
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: pipInfo.treasury,
        mint: pipInfo.mint,
        uiAmount: tier.price,
        decimals: pipInfo.decimals,
        rpcUrl: pipInfo.rpcUrl,
      });
      // Stash BEFORE telling the server so a dropped reply can't eat a paid chest.
      savePending({ tierId: tier.id, signature });
      networkManager.sendChestOpen(tier.id, signature);
    } catch (err) {
      setBusyTier(null);
      setNotice(err instanceof Error ? err.message : "Payment was cancelled.");
    }
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 420, width: "94vw", maxHeight: "84vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🎁 Magic Chests</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      {result?.ok && result.rewards ? (
        <ChestResult result={result} onAgain={() => setResult(null)} />
      ) : (
        <>
          <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>
            Chests <b>burn</b> $BASE and pay out gold, materials, season points and cosmetics. Odds
            are listed on every chest — tap <em>Odds</em> to see them.
          </div>

          {CHEST_TIERS.map((tier) => (
            <div key={tier.id} className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 30, lineHeight: 1 }}>{tier.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.86rem" }}>{tier.name}</div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>
                    {tier.blurb}
                  </div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 2 }}>
                    {tier.rolls} rewards · ~{expectedGold(tier).toLocaleString()} gold on average
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--gold"
                  style={{ flex: 1, padding: "9px 12px", fontWeight: 800 }}
                  onClick={() => void buy(tier)}
                  disabled={busyTier !== null}
                >
                  {busyTier === tier.id ? "Opening…" : `Open · ${tier.price.toLocaleString()} $BASE`}
                </button>
                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  style={{ padding: "9px 12px" }}
                  onClick={() => setOddsFor(oddsFor === tier.id ? null : tier.id)}
                >
                  Odds
                </button>
              </div>
              {oddsFor === tier.id && (
                <div style={{ marginTop: 8 }}>
                  {RARITY_ORDER.map((rarity) => (
                    <div
                      key={rarity}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.7rem",
                        padding: "2px 0",
                      }}
                    >
                      <span style={{ color: CHEST_RARITY_COLOR[rarity], fontWeight: 800 }}>
                        {CHEST_RARITY_LABEL[rarity]}
                      </span>
                      <span className="chibi-text-muted">
                        {(tier.odds[rarity] * 100).toFixed(tier.odds[rarity] < 0.01 ? 2 : 1)}% per reward
                      </span>
                    </div>
                  ))}
                  <div className="chibi-text-muted" style={{ fontSize: "0.62rem", marginTop: 4 }}>
                    Each chest rolls {tier.rolls} rewards independently at these odds.
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="chibi-text-muted" style={{ fontSize: "0.64rem", marginTop: 10 }}>
            Chests never contain weapons, armour or tools — no paying for power. Gold from a chest
            is worth less than buying gold outright at Rudi's desk; you're paying for the chance at
            rare finds and cosmetics.
          </div>
        </>
      )}

      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 8 }}>
          {notice}
        </div>
      )}
    </div>
  );
}

/** The reveal: rewards listed newest-first with their rarity colour. */
function ChestResult({ result, onAgain }: { result: ChestOpenResultPayload; onAgain: () => void }) {
  const rewards = result.rewards ?? [];
  const best = rewards.reduce<ChestRarity>((acc, r) => {
    const order = RARITY_ORDER.indexOf(r.rarity);
    return order < RARITY_ORDER.indexOf(acc) ? r.rarity : acc;
  }, "common");

  return (
    <div>
      <div
        style={{
          textAlign: "center",
          marginTop: 6,
          padding: "12px 10px",
          borderRadius: 12,
          background: `linear-gradient(180deg, ${CHEST_RARITY_COLOR[best]}22, transparent)`,
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>🎉</div>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", marginTop: 4 }}>
          Best pull: <span style={{ color: CHEST_RARITY_COLOR[best] }}>{CHEST_RARITY_LABEL[best]}</span>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {rewards.map((r, i) => (
          <div
            key={`${r.kind}-${r.id ?? i}-${i}`}
            className="chibi-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderColor: CHEST_RARITY_COLOR[r.rarity],
            }}
          >
            {r.kind === "item" && r.id ? (
              <ItemIcon itemId={r.id} size={28} />
            ) : (
              <div style={{ fontSize: 22, width: 28, textAlign: "center" }}>
                {r.kind === "gold" ? "🪙" : r.kind === "seasonPoints" ? "🏆" : "🎨"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>{r.label}</div>
              <div style={{ fontSize: "0.64rem", color: CHEST_RARITY_COLOR[r.rarity], fontWeight: 800 }}>
                {CHEST_RARITY_LABEL[r.rarity]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {typeof result.gold === "number" && (
        <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 8, textAlign: "center" }}>
          You now have {result.gold.toLocaleString()} gold.
        </div>
      )}

      <button
        type="button"
        className="chibi-btn chibi-btn--gold"
        style={{ width: "100%", padding: "9px 12px", marginTop: 10, fontWeight: 800 }}
        onClick={onAgain}
      >
        Open another
      </button>
    </div>
  );
}
