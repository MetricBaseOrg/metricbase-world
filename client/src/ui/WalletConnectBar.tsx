import type { AuthVerifyResponse } from "@metricbase/shared";
import { useRef, useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import type { WalletConnector } from "../wallet/discovery";
import {
  connectAndVerifyWallet,
  getValidWalletSession,
  listAvailableWallets,
  resolveWalletConnector,
} from "../wallet/tokenGate";
import { shortenWallet } from "../wallet/solanaProvider";
import { WalletPicker } from "./WalletPicker";

interface WalletConnectBarProps {
  compact?: boolean;
  hint?: string;
}

export function WalletConnectBar({ compact, hint }: WalletConnectBarProps) {
  const walletAddress = useGameStore((state) => state.walletAddress);
  const setWalletAddress = useGameStore((state) => state.setWalletAddress);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const resolver = useRef<{
    resolve: (value: AuthVerifyResponse) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  const syncWalletToServer = async (session: AuthVerifyResponse) => {
    networkManager.setAccessToken(session.accessToken);
    const linked = await networkManager.linkWallet();
    if (!linked) {
      throw new Error("Could not link wallet to your game session. Try again.");
    }
    setWalletAddress(session.wallet);
  };

  const connectSelectedWallet = async (wallet: WalletConnector) => {
    const verified = await connectAndVerifyWallet(wallet);
    await syncWalletToServer(verified);
    return verified;
  };

  const requestWalletConnection = async () => {
    const existing = await getValidWalletSession();
    if (existing) {
      await syncWalletToServer(existing);
      return existing;
    }

    const wallets = listAvailableWallets();
    if (wallets.length === 0) {
      throw new Error(
        "No Solana wallet detected. Install Jupiter or Phantom, then refresh this page.",
      );
    }

    const wallet = resolveWalletConnector();
    if (wallet) {
      return connectSelectedWallet(wallet);
    }

    setDetectedWallets(wallets);
    setPickerOpen(true);
    return new Promise<AuthVerifyResponse>((resolve, reject) => {
      resolver.current = { resolve, reject };
    });
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await requestWalletConnection();
    } catch (connectError) {
      if (connectError instanceof Error && connectError.message === "Wallet connection cancelled.") {
        return;
      }
      const message =
        connectError instanceof Error ? connectError.message : "Wallet connection failed.";
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleWalletPicked = async (wallet: WalletConnector) => {
    setPickerOpen(false);
    setConnecting(true);
    setError(null);
    try {
      const verified = await connectSelectedWallet(wallet);
      resolver.current?.resolve(verified);
    } catch (connectError) {
      const message =
        connectError instanceof Error ? connectError.message : "Wallet verification failed.";
      setError(message);
      resolver.current?.reject(connectError);
    } finally {
      resolver.current = null;
      setConnecting(false);
    }
  };

  const handlePickerClose = () => {
    setPickerOpen(false);
    resolver.current?.reject(new Error("Wallet connection cancelled."));
    resolver.current = null;
  };

  if (walletAddress && compact) {
    return (
      <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>
        💳 <span style={{ color: "var(--chibi-mint-deep)", fontWeight: 700 }}>{shortenWallet(walletAddress)}</span>
      </div>
    );
  }

  if (walletAddress) {
    return (
      <div className="chibi-card" style={{ padding: "10px 12px", background: "#f0fff9", borderColor: "var(--chibi-mint)" }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Wallet connected: <span style={{ color: "var(--chibi-mint-deep)" }}>{shortenWallet(walletAddress)}</span>
        </div>
        <button
          type="button"
          className="chibi-btn chibi-btn--secondary"
          onClick={() => void handleConnect()}
          disabled={connecting}
          style={{ marginTop: 8, padding: "6px 10px", fontSize: "0.75rem" }}
        >
          {connecting ? "Verifying..." : "Reconnect Wallet"}
        </button>
        {error && <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.75rem", padding: "6px 8px" }}>{error}</div>}
        {pickerOpen && (
          <WalletPicker
            wallets={detectedWallets}
            onSelect={(wallet) => void handleWalletPicked(wallet)}
            onClose={handlePickerClose}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="chibi-card chibi-card--gold" style={{ padding: compact ? "10px 12px" : "14px 16px" }}>
        <div style={{ fontSize: compact ? "0.8rem" : "0.9rem", fontWeight: 800, marginBottom: 6 }}>
          Wallet required
        </div>
        <div className="chibi-text-muted" style={{ marginBottom: 10, lineHeight: 1.45 }}>
          {hint ??
            "Connect your Solana wallet to trade gold on the open market. Payments go directly between players."}
        </div>
        <button
          type="button"
          className="chibi-btn chibi-btn--primary"
          onClick={() => void handleConnect()}
          disabled={connecting}
          style={{ width: "100%", padding: compact ? "9px 12px" : "11px 14px", fontSize: compact ? "0.8rem" : "0.9rem" }}
        >
          {connecting ? "Connecting wallet..." : "Connect Wallet"}
        </button>
        {error && (
          <div className="chibi-card chibi-card--danger" style={{ marginTop: 10, fontSize: "0.75rem", padding: "8px" }}>{error}</div>
        )}
      </div>
      {pickerOpen && (
        <WalletPicker
          wallets={detectedWallets}
          onSelect={(wallet) => void handleWalletPicked(wallet)}
          onClose={handlePickerClose}
        />
      )}
    </>
  );
}