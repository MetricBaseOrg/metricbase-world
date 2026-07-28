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
  CHEST_SHARE_SEASON_POINTS,
  CHEST_TIERS,
  chestShareText,
  expectedGold,
  getChestTier,
  normalizeTxSignature,
  describeSignatureProblem,
  type ChestOpenResultPayload,
  type ChestRarity,
  type ChestTierDef,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { isTelegramMiniApp, openExternalLink } from "../telegram/telegramApp";
import { isTokenPaymentError, jupiterSwapUrl, sendMetricbaseTokenPayment } from "../wallet/tokenPayment";
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

/**
 * A tier's chest art, with its emoji as the fallback.
 *
 * The art is a plain 256px PNG under /assets/items, so a missing or failed
 * file must not leave a blank space where the chest should be — especially on
 * the opening stage, where an empty box mid-animation reads as a broken open
 * rather than a missing image. `onError` drops back to the glyph the panel
 * shipped with.
 */
export function ChestArt({ tier, size }: { tier: ChestTierDef | null; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [tier?.art]);

  if (!tier || failed) {
    return (
      <span style={{ fontSize: size * 0.8, lineHeight: 1 }} aria-hidden="true">
        {tier?.emoji ?? "🎁"}
      </span>
    );
  }
  return (
    <img
      src={`/assets/items/${tier.art}`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/** The chest rattles for at least this long even if the server answers
 * instantly — a reveal that appears the same frame you tap reads as a bug, not
 * a reward. Capped by the round trip, which is usually the longer of the two. */
const MIN_RATTLE_MS = 1100;
/** Burst → first reward. */
const BURST_MS = 520;
/** Gap between rewards landing. */
const REVEAL_STAGGER_MS = 340;
/** Rattle SFX cadence — two turns of the 0.72s CSS rattle, so the sound lands
 * with the movement instead of drifting against it. */
const RATTLE_SFX_MS = 1440;

type OpenPhase = "idle" | "rattling" | "burst" | "reveal";

export function ChestPanel() {
  const open = useGameStore((s) => s.chestOpen);
  const setOpen = useGameStore((s) => s.setChestOpen);
  const walletAddress = useGameStore((s) => s.walletAddress);

  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsTokens, setNeedsTokens] = useState(false);
  const [result, setResult] = useState<ChestOpenResultPayload | null>(null);
  const [oddsFor, setOddsFor] = useState<string | null>(null);
  const [phase, setPhase] = useState<OpenPhase>("idle");
  const [openingTier, setOpeningTier] = useState<ChestTierDef | null>(null);
  const recovered = useRef(false);
  const rattleStartedAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const offInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offResult = networkManager.onChestOpenResult((r) => {
      setBusyTier(null);
      if (r.ok) {
        savePending(null);
        setNotice(null);
        // Let the chest rattle out its minimum before it gives — then burst,
        // then hand over to the staggered reveal.
        const elapsed = Date.now() - rattleStartedAt.current;
        const wait = Math.max(0, MIN_RATTLE_MS - elapsed);
        timers.current.push(
          window.setTimeout(() => {
            setPhase("burst");
            playSfx("chest_burst");
            timers.current.push(
              window.setTimeout(() => {
                setResult(r);
                setPhase("reveal");
              }, BURST_MS),
            );
          }, wait),
        );
        return;
      }
      // Failed: stop the animation so the error isn't hidden behind a rattling
      // chest that will never open.
      clearTimers();
      setPhase("idle");
      setOpeningTier(null);
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

  // The rattle SFX repeats alongside the looping animation, because the wait
  // it covers (approval → broadcast → on-chain verification) has no knowable
  // length. Tied to the phase rather than started next to the animation, so
  // every exit — success, failure, closing the panel — silences it.
  useEffect(() => {
    if (phase !== "rattling") return;
    playSfx("chest_rattle");
    const id = window.setInterval(() => playSfx("chest_rattle"), RATTLE_SFX_MS);
    return () => window.clearInterval(id);
  }, [phase]);

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
    setNeedsTokens(false);
    setResult(null);
    // The rattle starts at the WALLET prompt, not at the server reply, so the
    // whole wait — approval, broadcast, verification — is covered by it.
    setOpeningTier(tier);
    setPhase("rattling");
    rattleStartedAt.current = Date.now();
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
      clearTimers();
      setPhase("idle");
      setOpeningTier(null);
      // Not having the tokens is the single commonest reason a chest fails —
      // the game is free to play, so most wallets hold no $BASE at all. Offer
      // the way to get some instead of just reporting the shortfall.
      setNeedsTokens(isTokenPaymentError(err) && err.kind !== "no-sol");
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

      {phase === "rattling" || phase === "burst" ? (
        <ChestOpeningStage tier={openingTier} bursting={phase === "burst"} />
      ) : result?.ok && result.rewards ? (
        <ChestResult
          result={result}
          onAgain={() => {
            setResult(null);
            setPhase("idle");
            setOpeningTier(null);
          }}
        />
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
                <ChestArt tier={tier} size={54} />
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
      {needsTokens && pipInfo?.mint && (
        <a
          className="chibi-btn chibi-btn--gold"
          href={jupiterSwapUrl(pipInfo.mint)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Telegram's webview swallows a plain target=_blank.
            if (isTelegramMiniApp()) {
              e.preventDefault();
              openExternalLink(jupiterSwapUrl(pipInfo.mint), true);
            }
          }}
          style={{
            display: "block",
            textAlign: "center",
            padding: "9px 12px",
            marginTop: 8,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Get $BASE on Jupiter ↗
        </a>
      )}
    </div>
  );
}

/**
 * The chest itself, mid-open.
 *
 * Rattles on a loop while the wallet and server do their work — a loop rather
 * than a fixed timeline because that wait has no knowable length, and a
 * progress-shaped animation that stalls looks broken. Then one kick, a ring and
 * a spray of sparks when it gives.
 */
function ChestOpeningStage({ tier, bursting }: { tier: ChestTierDef | null; bursting: boolean }) {
  // Sparks fly outward on fixed angles — random per burst would shimmer
  // differently on every re-render while React reconciles.
  const sparks = [
    { x: -70, y: -50, d: 0 },
    { x: 66, y: -58, d: 60 },
    { x: -44, y: -84, d: 110 },
    { x: 48, y: -86, d: 40 },
    { x: -86, y: -14, d: 150 },
    { x: 84, y: -20, d: 95 },
  ];

  return (
    <div
      className={`mb-chest-stage${bursting ? " mb-chest-stage--burst" : ""}`}
      style={{ ["--mb-chest-tint" as string]: tier?.id === "mythic" ? "#8a44c8" : "#c9a84c" }}
      role="status"
      aria-live="polite"
      aria-label={bursting ? "The chest opens" : "Opening your chest"}
    >
      <div className="mb-chest-stage__glow" />
      {bursting && <div className="mb-chest-ring" />}
      {bursting &&
        sparks.map((s, i) => (
          <span
            key={i}
            className="mb-chest-spark"
            style={{
              ["--mb-spark-x" as string]: `${s.x}px`,
              ["--mb-spark-y" as string]: `${s.y}px`,
              animationDelay: `${s.d}ms`,
            }}
          >
            ✨
          </span>
        ))}
      {/* The art goes INSIDE the animated element rather than replacing it, so
          the rattle/pop transforms and the drop-shadow keep working untouched
          and the emoji fallback still inherits the same font-size. */}
      <div className="mb-chest-stage__chest">
        <ChestArt tier={tier} size={104} />
      </div>
      <div className="mb-chest-stage__label">
        {bursting ? "It opens!" : `Opening your ${tier?.name ?? "chest"}…`}
      </div>
      {!bursting && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4, textAlign: "center" }}>
          Approve in your wallet if prompted — we'll verify it on-chain.
        </div>
      )}
    </div>
  );
}

/**
 * Flex the haul on X, for +10 season points.
 *
 * THE BONUS IS PER CHEST, NOT PER TAP — the server keys the claim on this
 * chest's payment signature (`chest_opens.shared_at`), so tapping again pays
 * nothing and the next 10 points cost another chest. Anything else would be a
 * free, unbounded points faucet into a pool that pays out real $BASE.
 *
 * The composer opens FIRST and the claim is sent after, because the composer
 * needs to be a direct result of the tap: a popup opened from a network
 * callback is a popup blocked by the browser. It does mean the points are
 * awarded for opening the composer rather than for a verified post — the chest
 * price is what makes that safe, and the paste-the-URL oEmbed flow the X tasks
 * use is the upgrade path if proof is ever wanted.
 */
function ShareHaul({
  signature,
  tierName,
  rewardLabels,
  alreadyShared,
}: {
  signature: string;
  tierName: string;
  rewardLabels: string[];
  alreadyShared: boolean;
}) {
  const [claimed, setClaimed] = useState(alreadyShared);
  const [awarded, setAwarded] = useState<number | null>(null);

  useEffect(() => {
    const off = networkManager.onChestShareResult((r) => {
      if (!r.ok) return;
      setClaimed(true);
      setAwarded(r.points ?? 0);
    });
    return () => {
      off();
    };
  }, []);

  const share = () => {
    playSfx("ui_click");
    const text = chestShareText(tierName, rewardLabels);
    // openExternalLink, not window.open: inside Telegram's webview the latter
    // is swallowed silently.
    openExternalLink(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, true);
    networkManager.sendChestShare(signature);
  };

  if (claimed) {
    return (
      <div
        className="chibi-card"
        style={{ marginTop: 10, padding: "9px 12px", textAlign: "center", fontSize: "0.72rem" }}
      >
        {awarded && awarded > 0 ? (
          <span style={{ fontWeight: 800 }}>𝕏 Shared — +{awarded} season points!</span>
        ) : (
          <span className="chibi-text-muted">
            𝕏 Already shared this chest. Open another to earn the bonus again.
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="chibi-btn chibi-btn--secondary"
        style={{ width: "100%", padding: "9px 12px", marginTop: 10, fontWeight: 800 }}
        onClick={share}
      >
        𝕏 Share your haul · +{CHEST_SHARE_SEASON_POINTS} season points
      </button>
      <div className="chibi-text-muted" style={{ fontSize: "0.62rem", marginTop: 4, textAlign: "center" }}>
        One bonus per chest.
      </div>
    </>
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
    // Same normalisation the server runs, so a bad paste is caught instantly
    // instead of after a round trip and four RPC lookups.
    const value = normalizeTxSignature(sig);
    const problem = describeSignatureProblem(value);
    if (problem) return setLocal(problem);
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
        Paste the transaction signature from your wallet history — or just the Solscan / Explorer
        link, that works too. We'll check it on-chain and open the chest your payment covers; you
        can't lose value here, the amount you actually paid decides the tier.
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          className="chibi-input"
          style={{ flex: 1, fontSize: "0.7rem" }}
          placeholder="Signature or explorer link"
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

  // Rewards land one at a time. `shown` also gates the summary and the button,
  // so the best-pull line can't spoil a legendary before its card arrives.
  const [shown, setShown] = useState(0);
  const revealTimers = useRef<number[]>([]);
  const stopReveal = () => {
    for (const t of revealTimers.current) window.clearTimeout(t);
    revealTimers.current = [];
  };

  useEffect(() => {
    setShown(0);
    stopReveal();
    for (let i = 0; i < rewards.length; i++) {
      revealTimers.current.push(
        window.setTimeout(() => {
          setShown(i + 1);
          // Rare-and-up gets the brighter cue, so a good pull is audible
          // before the card has been read.
          const rare = RARITY_ORDER.indexOf(rewards[i].rarity) <= RARITY_ORDER.indexOf("rare");
          playSfx(rare ? "chest_reward_rare" : "chest_reward");
        }, i * REVEAL_STAGGER_MS),
      );
    }
    return stopReveal;
    // Re-run per opening, not per render.
  }, [result]);

  const allShown = shown >= rewards.length;
  // Cancel the pending timers too, or "Reveal all" shows every card at once
  // and then keeps firing their sounds one by one into an already-finished
  // reveal.
  const revealAll = () => {
    stopReveal();
    setShown(rewards.length);
  };

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
          {allShown ? (
            <>
              Best pull:{" "}
              <span style={{ color: CHEST_RARITY_COLOR[best] }}>{CHEST_RARITY_LABEL[best]}</span>
            </>
          ) : (
            // Withheld until the last card lands — naming the best rarity up
            // front would spoil the reveal it's meant to cap.
            <span className="chibi-text-muted">
              {shown} of {rewards.length}…
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {rewards.slice(0, shown).map((r, i) => (
          <div
            key={`${r.kind}-${r.id ?? i}-${i}`}
            className={`chibi-card mb-reward-in${r.rarity === "legendary" ? " mb-reward-shine" : ""}`}
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

      {allShown && typeof result.gold === "number" && (
        <div className="chibi-text-muted" style={{ fontSize: "0.7rem", marginTop: 8, textAlign: "center" }}>
          You now have {result.gold.toLocaleString()} gold.
        </div>
      )}

      {/* Held back until every card has landed — offering "share your haul"
          while the haul is still arriving asks people to brag about something
          they haven't seen. */}
      {allShown && result.signature && (
        <ShareHaul
          signature={result.signature}
          tierName={getChestTier(result.tierId ?? "")?.name ?? "chest"}
          rewardLabels={rewards.map((r) => r.label)}
          alreadyShared={Boolean(result.shared)}
        />
      )}

      {/* Skip is essential, not a nicety: the stagger is charming once and
          tedious by the tenth chest. */}
      <button
        type="button"
        className={`chibi-btn ${allShown ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
        style={{ width: "100%", padding: "9px 12px", marginTop: 10, fontWeight: 800 }}
        onClick={allShown ? onAgain : revealAll}
      >
        {allShown ? "Open another" : "Reveal all"}
      </button>
    </div>
  );
}
