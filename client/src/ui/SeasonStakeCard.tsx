// Season prize-race entry: a REFUNDABLE $BASE stake that puts a player into the
// pool split. See shared/src/season.ts for the economics.
//
// Playing is free and always stays free — this card only ever appears for the
// prize race, and a player who ignores it keeps earning points and keeps their
// leaderboard rank. The stake is returned when the season pays out.
//
// The stake is a real on-chain transfer, so it uses the same paid-but-unclaimed
// localStorage recovery as PipGoldDesk: the signature is stashed BEFORE the
// server is told, and re-submitted on next open if the reply never arrived.
import { type SeasonStatePayload } from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

const PENDING_KEY = "seasonStakePending";
type PendingStake = { seasonId: string; signature: string };

function loadPending(): PendingStake | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    return raw && typeof raw.signature === "string" && typeof raw.seasonId === "string" ? raw : null;
  } catch {
    return null;
  }
}
function savePending(entry: PendingStake | null) {
  try {
    if (entry) localStorage.setItem(PENDING_KEY, JSON.stringify(entry));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
}

export function SeasonStakeCard({ season }: { season: SeasonStatePayload }) {
  const walletAddress = useGameStore((s) => s.walletAddress);
  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Only retry a stashed signature once per mount, or a server that keeps
  // failing would be re-hit on every re-render of the panel.
  const recovered = useRef(false);

  useEffect(() => {
    const offInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offResult = networkManager.onSeasonStakeResult((r) => {
      setPending(false);
      if (r.ok) {
        savePending(null);
        setNotice(r.message ?? "You're in the prize race!");
        playSfx("ui_open");
        return;
      }
      // "Already entered" / "already used" mean the stake landed — stop
      // retrying. Anything else may be transient, so keep it stashed.
      if (r.error && /already/i.test(r.error)) savePending(null);
      setNotice(r.error ?? "Entry failed.");
    });
    networkManager.requestPipGoldInfo();
    return () => {
      offInfo();
      offResult();
    };
  }, []);

  // Finish an entry that was paid for but never confirmed (reload, dropped
  // socket, slow confirmation). The server dedupes by signature, so
  // re-submitting is safe.
  useEffect(() => {
    if (recovered.current || !walletAddress || season.staked) return;
    const stash = loadPending();
    if (!stash || stash.seasonId !== season.seasonId) return;
    recovered.current = true;
    setNotice("Finishing your earlier entry…");
    setPending(true);
    networkManager.sendSeasonStake(stash.signature);
  }, [walletAddress, season.staked, season.seasonId]);

  // Seasons before the stake was introduced have no entry fee at all.
  if (season.stakeAmount <= 0) return null;

  const isTelegramAccount = Boolean(walletAddress?.startsWith("tg:"));

  const enter = async () => {
    if (!walletAddress || isTelegramAccount) return setNotice("Link a Solana wallet to enter.");
    if (!pipInfo?.enabled || !pipInfo.treasury) return setNotice("Entry isn't available right now.");
    playSfx("ui_click");
    setPending(true);
    setNotice(null);
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: pipInfo.treasury,
        mint: pipInfo.mint,
        uiAmount: season.stakeAmount,
        decimals: pipInfo.decimals,
        rpcUrl: pipInfo.rpcUrl,
      });
      // Stash BEFORE telling the server, so a dropped reply can't lose a real
      // payment — the effect above re-submits it next time.
      savePending({ seasonId: season.seasonId, signature });
      networkManager.sendSeasonStake(signature);
    } catch (err) {
      setPending(false);
      setNotice(err instanceof Error ? err.message : "Payment was cancelled.");
    }
  };

  if (season.staked) {
    return (
      <div
        className="chibi-card"
        style={{ marginTop: 10, padding: "10px 12px", borderColor: "#C9A84C", background: "rgba(201,168,76,0.08)" }}
      >
        <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>🏅 You're in the prize race</div>
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
          Your {season.stakeAmount.toLocaleString()} $BASE deposit comes back when Season {season.seasonNumber} pays
          out — win or lose. {season.entrants.toLocaleString()} {season.entrants === 1 ? "player has" : "players have"}{" "}
          entered.
        </div>
      </div>
    );
  }

  return (
    <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
      <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>🏁 Enter the prize race</div>
      <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
        The {season.rewardPool.toLocaleString()} $BASE pool is split between players who enter. Entry is a{" "}
        <b>refundable {season.stakeAmount.toLocaleString()} $BASE deposit</b> — you get it back when the season pays
        out. Playing, earning points and climbing the leaderboard stay free either way.
      </div>
      {isTelegramAccount ? (
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 8 }}>
          You signed in with Telegram. Link a Solana wallet to enter the prize race — your points keep counting
          meanwhile.
        </div>
      ) : (
        <button
          type="button"
          className="chibi-btn chibi-btn--gold"
          style={{ width: "100%", padding: "9px 12px", marginTop: 8, fontWeight: 800 }}
          onClick={() => void enter()}
          disabled={pending || !walletAddress}
        >
          {pending ? "Confirming…" : `Enter for ${season.stakeAmount.toLocaleString()} $BASE`}
        </button>
      )}
      {season.entrants > 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.64rem", marginTop: 6, textAlign: "center" }}>
          {season.entrants.toLocaleString()} {season.entrants === 1 ? "player has" : "players have"} entered so far.
        </div>
      )}
      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          {notice}
        </div>
      )}
    </div>
  );
}
