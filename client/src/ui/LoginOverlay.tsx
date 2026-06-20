import { METRICBASE_TOKEN_MINT } from "@metricbase/shared";
import { FormEvent, useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import {
  clearStoredAccessToken,
  connectAndVerifyWallet,
  ensureWalletAccess,
  fetchTokenGateInfo,
  getStoredAccessToken,
} from "../wallet/tokenGate";
import { shortenWallet } from "../wallet/solanaProvider";

interface LoginOverlayProps {
  onJoin: (name: string, accessToken?: string | null) => Promise<void>;
}

export function LoginOverlay({ onJoin }: LoginOverlayProps) {
  const playerName = useGameStore((state) => state.playerName);
  const setWalletAddress = useGameStore((state) => state.setWalletAddress);
  const [name, setName] = useState(playerName);
  const [joining, setJoining] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateEnabled, setGateEnabled] = useState(true);
  const [tokenMint, setTokenMint] = useState(METRICBASE_TOKEN_MINT);
  const [walletAddress, setWalletAddressLocal] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const info = await fetchTokenGateInfo();
        setGateEnabled(info.enabled);
        setTokenMint(info.mint);

        if (!info.enabled || !getStoredAccessToken()) return;

        const session = await ensureWalletAccess();
        if (session) {
          setWalletAddressLocal(session.wallet);
          setWalletAddress(session.wallet);
          setTokenBalance(session.tokenBalance);
        }
      } catch {
        clearStoredAccessToken();
      }
    })();
  }, [setWalletAddress]);

  const handleConnectWallet = async () => {
    setConnectingWallet(true);
    setError(null);
    clearStoredAccessToken();

    try {
      const verified = await connectAndVerifyWallet();
      setWalletAddressLocal(verified.wallet);
      setWalletAddress(verified.wallet);
      setTokenBalance(verified.tokenBalance);
    } catch (walletError) {
      const message =
        walletError instanceof Error ? walletError.message : "Wallet verification failed.";
      setError(message);
      setWalletAddressLocal(null);
      setWalletAddress(null);
      setTokenBalance(null);
    } finally {
      setConnectingWallet(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim() || "Traveler";
    setJoining(true);
    setError(null);

    try {
      let accessToken: string | null = null;

      if (gateEnabled) {
        const session = getStoredAccessToken()
          ? await ensureWalletAccess()
          : await connectAndVerifyWallet();
        if (!session) {
          throw new Error("Wallet verification is required.");
        }
        accessToken = session.accessToken;
        setWalletAddressLocal(session.wallet);
        setWalletAddress(session.wallet);
        setTokenBalance(session.tokenBalance);
      }

      await onJoin(trimmed, accessToken);
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : "Could not connect to the game server.";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  const walletReady = !gateEnabled || Boolean(walletAddress && getStoredAccessToken());

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(5, 8, 18, 0.72)",
        backdropFilter: "blur(4px)",
        zIndex: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          padding: 24,
          borderRadius: 14,
          background: "rgba(12, 18, 34, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#f4f7ff",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Enter the World</h1>
        <p style={{ margin: "8px 0 20px", opacity: 0.75, fontSize: 14 }}>
          Token-gated Solana MMO prototype. Hold the MetricBase token to play.
        </p>

        {gateEnabled && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Required token</div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                wordBreak: "break-all",
                opacity: 0.9,
                marginBottom: 10,
              }}
            >
              {tokenMint}
            </div>

            {walletAddress ? (
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                Wallet: <span style={{ color: "#9ad7ff" }}>{shortenWallet(walletAddress)}</span>
                {tokenBalance !== null && (
                  <span style={{ opacity: 0.75 }}> · Balance: {tokenBalance}</span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 10 }}>
                Connect Phantom (or Solana wallet) and sign to verify holdings.
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleConnectWallet()}
              disabled={connectingWallet || joining}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.06)",
                color: "#fff",
                fontWeight: 600,
                cursor: connectingWallet ? "wait" : "pointer",
              }}
            >
              {connectingWallet
                ? "Verifying wallet..."
                : walletAddress
                  ? "Reconnect Wallet"
                  : "Connect Wallet"}
            </button>
          </div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Character name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={16}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#fff",
            marginBottom: 16,
          }}
        />
        {error && (
          <p
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255, 80, 80, 0.12)",
              border: "1px solid rgba(255, 120, 120, 0.35)",
              color: "#ffb4b4",
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={joining || !walletReady}
          style={{
            width: "100%",
            padding: "11px 12px",
            border: "none",
            borderRadius: 8,
            background:
              joining || !walletReady
                ? "rgba(79, 140, 255, 0.45)"
                : "linear-gradient(135deg, #4f8cff, #6c5ce7)",
            color: "#fff",
            fontWeight: 600,
            cursor: joining || !walletReady ? "not-allowed" : "pointer",
          }}
        >
          {joining ? "Connecting..." : "Join Zone"}
        </button>
      </form>
    </div>
  );
}