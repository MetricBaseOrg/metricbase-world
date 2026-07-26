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
          {/* Say WHY up front rather than after a click. The only thing that
              closes chests is a missing treasury wallet on the server — the
              same TOKEN_TREASURY_WALLET the gold desk needs. Notably it is NOT
              the skins: unfinished skins are simply skipped by the roller, and
              every other reward still drops. */}
          {pipInfo && !pipInfo.enabled && (
            <div
              className="chibi-card"
              style={{ marginTop: 8, padding: "10px 12px", borderColor: "#d85f4f", background: "rgba(216,95,79,0.08)" }}
            >
              <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>⚠️ Chests are closed right now</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
                This server has no payment wallet configured, so a chest can't take payment yet.
                Nothing is wrong with your account — check back shortly.
              </div>
            </div>
          )}
          <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>
            Chests pay out gold, gear, materials and season points — and cosmetics once those land.
            What you spend goes straight into the <b>Season reward pool</b>. Odds are listed on
            every chest, tap <em>Odds</em> to see them.
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
                  disabled={busyTier !== null || (pipInfo != null && !pipInfo.enabled)}
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

          <RecoverPaidChest />

          <div className="chibi-text-muted" style={{ fontSize: "0.64rem", marginTop: 10 }}>
            On average a chest returns more gold than the same $BASE spent at Rudi's desk, so gold
            alone is worth the trip — gear, cosmetics and the rare tiers are the upside on top.
            But <b>a chest is a roll, not a purchase</b>: the odds above are the whole story and a
            quiet run is a real possibility. Need an exact amount of gold instead?{" "}
            <b>Rudi's gold desk</b> pays precisely what you ask for, every time.
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

/**
 * "I paid and got nothing" — paste the transaction signature and claim it.
 *
 * The automatic recovery (localStorage) only helps if the signature was stashed,
 * and before v0.192.2 a confirmation error could throw before that happened,
 * after the tokens had already left the wallet. This is the manual way home.
 * The server decides the tier from the on-chain amount, so there's nothing to
 * choose and nothing to get wrong.
 */
function RecoverPaidChest() {
  const [showing, setShowing] = useState(false);
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string | null>(null);

  // Clear the busy state on the RESULT, not on a timer. The old 4s timeout put
  // the button back with nothing shown, which read as "nothing happened" even
  // while the server was still checking — verification polls Solana for up to
  // ~10s, so beating it with a 4s timer was guaranteed.
  useEffect(() => {
    const off = networkManager.onChestOpenResult((r) => {
      setBusy(false);
      // Show the failure HERE, next to the button, not only in the panel-level
      // notice at the bottom — this panel scrolls, and an error rendered below
      // the fold is indistinguishable from nothing happening at all.
      setLocal(r.ok ? null : (r.error ?? "Couldn't claim that chest."));
    });
    return () => {
      off();
    };
  }, []);

  const submit = () => {
    const value = sig.trim();
    if (!value) return setLocal("Paste the transaction signature first.");
    playSfx("ui_click");
    setBusy(true);
    setLocal("Checking the transaction on Solana — this can take a few seconds…");
    networkManager.sendChestRecover(value);
    // Long backstop only: if the server never answers at all, say so rather
    // than leaving a spinner forever.
    window.setTimeout(() => {
      setBusy((wasBusy) => {
        if (wasBusy) setLocal("No response from the server. Your payment is safe — try again.");
        return false;
      });
    }, 30_000);
  };

  if (!showing) {
    return (
      <button
        type="button"
        className="chibi-btn chibi-btn--ghost"
        style={{ width: "100%", marginTop: 10, padding: "7px 10px", fontSize: "0.72rem" }}
        onClick={() => setShowing(true)}
      >
        Paid but didn't get your chest?
      </button>
    );
  }

  return (
    <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
      <div style={{ fontWeight: 800, fontSize: "0.76rem" }}>🧾 Claim a paid chest</div>
      <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4 }}>
        Paste the transaction signature from your wallet history. We'll check it on-chain and open
        the chest your payment covers — you can't lose value here, the amount you actually paid
        decides the tier.
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          className="chibi-input"
          style={{ flex: 1, fontSize: "0.7rem" }}
          placeholder="Transaction signature"
          value={sig}
          onChange={(e) => setSig(e.target.value)}
        />
        <button
          type="button"
          className="chibi-btn chibi-btn--primary"
          style={{ padding: "8px 12px" }}
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Checking…" : "Claim"}
        </button>
      </div>
      {local && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          {local}
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
