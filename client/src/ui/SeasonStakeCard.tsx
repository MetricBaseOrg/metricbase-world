// Season deposit vault: the $BASE a player stakes toward the prize pool. See
// shared/src/season.ts for the economics.
//
// Playing is free and always stays free — this card only ever governs the prize
// race, and a player who ignores it keeps earning points and keeps their
// leaderboard rank. What the deposit buys is a share of the split and a
// season-point multiplier; what it costs is the withdrawal fee and the lockup.
//
// Deposits are real on-chain transfers, so they use the same paid-but-unclaimed
// localStorage recovery as PipGoldDesk: the signature is stashed BEFORE the
// server is told, and re-submitted on next open if the reply never arrived.
import {
  seasonStakeMultiplier,
  seasonWithdrawSplit,
  SEASON_STAKE_MULT_CAP,
  type SeasonStatePayload,
} from "@metricbase/shared";
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
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  // Only retry a stashed signature once per mount, or a server that keeps
  // failing would be re-hit on every re-render of the panel.
  const recovered = useRef(false);

  const vault = season.vault;

  useEffect(() => {
    const offInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offResult = networkManager.onSeasonStakeResult((r) => {
      setPending(false);
      if (r.ok) {
        savePending(null);
        setDepositInput("");
        setNotice(r.message ?? "Deposit received.");
        playSfx("ui_open");
        return;
      }
      // "Already used" means the deposit landed — stop retrying. Anything else
      // may be transient, so keep it stashed.
      if (r.error && /already/i.test(r.error)) savePending(null);
      setNotice(r.error ?? "Deposit failed.");
    });
    const offWithdraw = networkManager.onSeasonWithdrawResult((r) => {
      setPending(false);
      setNotice(r.ok ? r.message ?? "Withdrawn." : r.error ?? "Withdrawal failed.");
      if (r.ok) {
        setWithdrawInput("");
        playSfx("coin_pile");
      }
    });
    networkManager.requestPipGoldInfo();
    return () => {
      offInfo();
      offResult();
      offWithdraw();
    };
  }, []);

  // Finish a deposit that was paid for but never confirmed (reload, dropped
  // socket, slow confirmation). The server dedupes by signature, so
  // re-submitting is safe.
  useEffect(() => {
    if (recovered.current || !walletAddress) return;
    const stash = loadPending();
    if (!stash || stash.seasonId !== season.seasonId) return;
    recovered.current = true;
    setNotice("Finishing your earlier deposit…");
    setPending(true);
    networkManager.sendSeasonStake(stash.signature);
  }, [walletAddress, season.seasonId]);

  // Seasons before the stake was introduced have no entry deposit at all.
  if (season.stakeAmount <= 0) return null;

  const isTelegramAccount = Boolean(walletAddress?.startsWith("tg:"));
  const floor = season.stakeAmount;
  // A first deposit must clear the floor; a top-up can be any size.
  const minDeposit = vault.balance >= floor ? 1 : floor;
  const depositAmount = Math.max(0, Math.floor(Number(depositInput) || 0));
  // What the multiplier would become — the whole reason to deposit more.
  const projected = seasonStakeMultiplier(vault.balance + depositAmount, season.seasonNumber);
  const atCap = vault.balance >= vault.capAt;

  const withdrawAmount = Math.max(0, Math.floor(Number(withdrawInput) || 0));
  const { fee, net } = seasonWithdrawSplit(Math.min(withdrawAmount, vault.withdrawable));

  const deposit = async () => {
    if (!walletAddress || isTelegramAccount) return setNotice("Link a Solana wallet to deposit.");
    if (!pipInfo?.enabled || !pipInfo.treasury) return setNotice("Deposits aren't available right now.");
    if (depositAmount < minDeposit) {
      return setNotice(`Minimum ${minDeposit.toLocaleString()} $BASE.`);
    }
    playSfx("ui_click");
    setPending(true);
    setNotice(null);
    try {
      const signature = await sendMetricbaseTokenPayment({
        payerWallet: walletAddress,
        recipientWallet: pipInfo.treasury,
        mint: pipInfo.mint,
        uiAmount: depositAmount,
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

  const withdraw = () => {
    if (withdrawAmount <= 0) return setNotice("Enter an amount to withdraw.");
    if (withdrawAmount > vault.withdrawable) {
      return setNotice(`You can withdraw up to ${vault.withdrawable.toLocaleString()} $BASE.`);
    }
    playSfx("ui_click");
    setPending(true);
    setNotice(null);
    networkManager.sendSeasonWithdraw(withdrawAmount);
  };

  const presets = [floor, floor * 2, vault.capAt].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      className="chibi-card"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        ...(season.staked ? { borderColor: "#C9A84C", background: "rgba(201,168,76,0.08)" } : {}),
      }}
    >
      <div style={{ fontWeight: 800, fontSize: "0.78rem" }}>
        {season.staked ? "🏅 You're in the prize race" : "🏁 Enter the prize race"}
      </div>

      {season.staked ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: "0.7rem" }}>
          <span>
            Deposited <b>{vault.balance.toLocaleString()}</b> $BASE
          </span>
          <span>
            Earning <b>{vault.multiplier.toFixed(2)}×</b> points{atCap ? " (max)" : ""}
          </span>
          <span className="chibi-text-muted">
            {season.entrants.toLocaleString()} {season.entrants === 1 ? "entrant" : "entrants"}
          </span>
        </div>
      ) : (
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
          The {season.rewardPool.toLocaleString()} $BASE pool is split between players who enter. Entry is a{" "}
          <b>{floor.toLocaleString()} $BASE deposit</b> you can withdraw after the season ends. Playing, earning points
          and climbing the leaderboard stay free either way.
        </div>
      )}

      {isTelegramAccount ? (
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 8 }}>
          You signed in with Telegram. Link a Solana wallet to enter the prize race — your points keep counting
          meanwhile.
        </div>
      ) : (
        <>
          {/* ---- Deposit ---- */}
          <div style={{ marginTop: 8 }}>
            <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginBottom: 4 }}>
              {atCap ? (
                <>You're at the maximum multiplier — more deposit won't add points.</>
              ) : (
                <>
                  Deposit more to raise your multiplier, up to <b>{SEASON_STAKE_MULT_CAP}×</b> at{" "}
                  {vault.capAt.toLocaleString()} $BASE.
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                type="number"
                min={minDeposit}
                step={1000}
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                placeholder={`${minDeposit.toLocaleString()}`}
                className="chibi-input"
                style={{ flex: "1 1 110px", minWidth: 0 }}
                aria-label="Deposit amount in $BASE"
              />
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chibi-btn chibi-btn--ghost"
                  style={{ padding: "6px 8px", fontSize: "0.68rem" }}
                  onClick={() => setDepositInput(String(Math.max(minDeposit, p - vault.balance)))}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
            {depositAmount > 0 && (
              <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4 }}>
                → vault {(vault.balance + depositAmount).toLocaleString()} $BASE, earning{" "}
                <b>{projected.toFixed(2)}×</b> season points
                {projected >= SEASON_STAKE_MULT_CAP ? " (max)" : ""}. Locked until Season {season.seasonNumber} ends.
              </div>
            )}
            <button
              type="button"
              className="chibi-btn chibi-btn--gold"
              style={{ width: "100%", padding: "9px 12px", marginTop: 6, fontWeight: 800 }}
              onClick={() => void deposit()}
              disabled={pending || !walletAddress || depositAmount < minDeposit}
            >
              {pending
                ? "Confirming…"
                : season.staked
                  ? `Deposit ${depositAmount ? depositAmount.toLocaleString() : ""} $BASE`
                  : `Enter for ${(depositAmount || floor).toLocaleString()} $BASE`}
            </button>
          </div>

          {/* ---- Withdraw ---- */}
          {vault.balance > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 8 }}>
              {vault.withdrawable <= 0 ? (
                <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>
                  🔒 Your {vault.locked.toLocaleString()} $BASE is locked until Season {season.seasonNumber} ends —
                  that's what it's competing with. You'll withdraw it yourself afterwards.
                </div>
              ) : !showWithdraw ? (
                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  style={{ width: "100%", padding: "7px 10px", fontSize: "0.72rem" }}
                  onClick={() => setShowWithdraw(true)}
                >
                  Withdraw ({vault.withdrawable.toLocaleString()} available)
                </button>
              ) : (
                <>
                  <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginBottom: 4 }}>
                    Withdraw any amount up to <b>{vault.withdrawable.toLocaleString()}</b> $BASE. A{" "}
                    <b>{vault.feePct}% fee</b> is kept by the treasury; what you leave in keeps earning its multiplier.
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      max={vault.withdrawable}
                      value={withdrawInput}
                      onChange={(e) => setWithdrawInput(e.target.value)}
                      placeholder="Amount"
                      className="chibi-input"
                      style={{ flex: "1 1 auto", minWidth: 0 }}
                      aria-label="Withdraw amount in $BASE"
                    />
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--ghost"
                      style={{ padding: "6px 8px", fontSize: "0.68rem" }}
                      onClick={() => setWithdrawInput(String(vault.withdrawable))}
                    >
                      Max
                    </button>
                  </div>
                  {withdrawAmount > 0 && (
                    <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 4 }}>
                      You receive <b>{net.toLocaleString()}</b> $BASE ({fee.toLocaleString()} fee).
                      {vault.balance - withdrawAmount < floor && (
                        <>
                          {" "}
                          ⚠️ Leaves {(vault.balance - withdrawAmount).toLocaleString()} — below the{" "}
                          {floor.toLocaleString()} entry floor, so you'd drop out of the prize split.
                        </>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--secondary"
                    style={{ width: "100%", padding: "8px 10px", marginTop: 6 }}
                    onClick={withdraw}
                    disabled={pending || withdrawAmount <= 0 || withdrawAmount > vault.withdrawable}
                  >
                    {pending ? "Sending…" : `Withdraw ${net > 0 ? net.toLocaleString() : ""} $BASE`}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          {notice}
        </div>
      )}
    </div>
  );
}
