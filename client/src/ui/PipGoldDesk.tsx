// Pip's currency desk: buy in-game gold 1:1 with $BASE, paid to the treasury
// wallet. Extracted from WorldsPanel so it embeds anywhere (Worlds panel,
// Pip's shop). Paid-but-uncredited purchases are stashed in localStorage and
// re-submitted (the server is idempotent) so a real payment is never lost.
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager, type PipGoldInfoPayload } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { sendMetricbaseTokenPayment } from "../wallet/tokenPayment";

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

export function PipGoldDesk() {
  const walletAddress = useGameStore((state) => state.walletAddress);
  const [pipInfo, setPipInfo] = useState<PipGoldInfoPayload | null>(null);
  const [buyGold, setBuyGold] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const offInfo = networkManager.onPipGoldInfo(setPipInfo);
    const offResult = networkManager.onPipGoldResult((r) => {
      setPending(false);
      if (r.ok) {
        if (r.signature) removeUnclaimed(r.signature);
        setNotice(
          r.viaPending
            ? `Bought ${(r.gold ?? 0).toLocaleString()} gold — it'll appear on your next relog.`
            : `Bought ${(r.gold ?? 0).toLocaleString()} gold from Rudi!`,
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
    networkManager.requestPipGoldInfo();
    return () => {
      offInfo();
      offResult();
    };
  }, []);

  // Recover any paid-but-uncredited purchases: re-submit each stashed
  // signature. The server is idempotent, so this safely finishes a purchase
  // that failed to credit earlier (slow confirmation, reload, dropped socket).
  useEffect(() => {
    if (!walletAddress) return;
    const unclaimed = loadUnclaimed();
    if (unclaimed.length === 0) return;
    setNotice("Recovering a previous $BASE payment…");
    for (const buy of unclaimed) networkManager.sendBuyGoldFromPip(buy.signature, buy.amount);
  }, [walletAddress]);

  const buyGoldFromPip = async () => {
    const amount = Number(buyGold) || 0;
    if (!walletAddress) return setNotice("Connect your wallet first.");
    if (!pipInfo?.enabled || !pipInfo.treasury) return setNotice("Rudi's gold desk is closed right now.");
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
    <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px" }}>
      <div className="chibi-label" style={{ marginBottom: 4 }}>💰 Buy gold from Rudi (1 gold = 1 $BASE)</div>
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
      {notice && (
        <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 6 }}>
          {notice}
        </div>
      )}
    </div>
  );
}
