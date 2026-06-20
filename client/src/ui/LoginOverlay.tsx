import {
  DEFAULT_CHARACTER_APPEARANCE,
  HAIR_COLORS,
  HAIR_STYLES,
  METRICBASE_TOKEN_MINT,
  normalizeCharacterAppearance,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  SKIN_TONES,
  type CharacterAppearance,
  type HairStyle,
  type OutfitStyle,
} from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { lookupBondedCharacter, saveCharacterAppearance } from "../character/characterApi";
import { useGameStore } from "../store/gameStore";
import type { WalletConnector } from "../wallet/discovery";
import { shortenWallet } from "../wallet/solanaProvider";
import {
  clearStoredAccessToken,
  connectAndVerifyWallet,
  fetchTokenGateInfo,
  getValidWalletSession,
  listAvailableWallets,
  resolveWalletConnector,
} from "../wallet/tokenGate";
import { CharacterPreview } from "./CharacterPreview";
import { WalletPicker } from "./WalletPicker";

interface LoginOverlayProps {
  onJoin: (
    name: string,
    accessToken: string | null | undefined,
    appearance: CharacterAppearance,
  ) => Promise<void>;
}

function ColorSwatches({
  colors,
  selected,
  onSelect,
}: {
  colors: number[];
  selected: number;
  onSelect: (color: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {colors.map((color) => {
        const active = color === selected;
        return (
          <button
            key={color}
            type="button"
            className={`chibi-swatch${active ? " active" : ""}`}
            onClick={() => onSelect(color)}
            style={{ background: `#${color.toString(16).padStart(6, "0")}` }}
            aria-label={`Color ${color}`}
          />
        );
      })}
    </div>
  );
}

function StylePicker<T extends string>({
  options,
  selected,
  labels,
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <button
            key={option}
            type="button"
            className={`chibi-chip${active ? " active" : ""}`}
            onClick={() => onSelect(option)}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

const HAIR_LABELS: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  spiky: "Spiky",
};

const OUTFIT_LABELS: Record<OutfitStyle, string> = {
  robe: "Robe",
  armor: "Armor",
  casual: "Casual",
};

export function LoginOverlay({ onJoin }: LoginOverlayProps) {
  const playerName = useGameStore((state) => state.playerName);
  const setWalletAddress = useGameStore((state) => state.setWalletAddress);
  const [name, setName] = useState(playerName);
  const [appearance, setAppearance] = useState<CharacterAppearance>({
    ...DEFAULT_CHARACTER_APPEARANCE,
  });
  const [joining, setJoining] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [loadingCharacter, setLoadingCharacter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateEnabled, setGateEnabled] = useState(true);
  const [tokenMint, setTokenMint] = useState(METRICBASE_TOKEN_MINT);
  const [minTokenAmount, setMinTokenAmount] = useState(1000);
  const [walletAddress, setWalletAddressLocal] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [nameBonded, setNameBonded] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const walletConnectResolver = useRef<{
    resolve: (value: Awaited<ReturnType<typeof connectAndVerifyWallet>>) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const info = await fetchTokenGateInfo();
        setGateEnabled(info.enabled);
        setTokenMint(info.mint);
        setMinTokenAmount(info.minUiAmount);

        const session = await getValidWalletSession();
        if (session) {
          setWalletAddressLocal(session.wallet);
          setWalletAddress(session.wallet);
          setTokenBalance(session.tokenBalance);
          await loadBondedCharacter(session.accessToken);
        }
      } catch {
        clearStoredAccessToken();
      }
    })();
  }, [setWalletAddress]);

  const loadBondedCharacter = async (accessToken: string) => {
    setLoadingCharacter(true);
    try {
      const saved = await lookupBondedCharacter(accessToken);
      if (saved.found && saved.bonded && saved.name) {
        setName(saved.name);
        setAppearance(normalizeCharacterAppearance(saved.appearance));
        setNameBonded(true);
        return;
      }
      setNameBonded(false);
    } catch {
      setNameBonded(false);
    } finally {
      setLoadingCharacter(false);
    }
  };

  const updateAppearance = (patch: Partial<CharacterAppearance>) => {
    setAppearance((current) => ({ ...current, ...patch }));
  };

  const connectSelectedWallet = async (wallet: WalletConnector) => {
    const verified = await connectAndVerifyWallet(wallet);
    setWalletAddressLocal(verified.wallet);
    setWalletAddress(verified.wallet);
    setTokenBalance(verified.tokenBalance);
    await loadBondedCharacter(verified.accessToken);
    return verified;
  };

  const requestWalletConnection = async () => {
    const wallets = listAvailableWallets();
    if (wallets.length === 0) {
      throw new Error(
        "No Solana wallet detected. Install Jupiter Wallet (or another Solana wallet), then refresh this page.",
      );
    }

    const wallet = resolveWalletConnector();
    if (wallet) {
      return connectSelectedWallet(wallet);
    }

    setDetectedWallets(wallets);
    setWalletPickerOpen(true);
    return new Promise<Awaited<ReturnType<typeof connectAndVerifyWallet>>>((resolve, reject) => {
      walletConnectResolver.current = { resolve, reject };
    });
  };

  const handleWalletPicked = async (wallet: WalletConnector) => {
    setWalletPickerOpen(false);
    setConnectingWallet(true);
    setError(null);

    try {
      const verified = await connectSelectedWallet(wallet);
      walletConnectResolver.current?.resolve(verified);
    } catch (walletError) {
      const message =
        walletError instanceof Error ? walletError.message : "Wallet verification failed.";
      setError(message);
      setWalletAddressLocal(null);
      setWalletAddress(null);
      setTokenBalance(null);
      walletConnectResolver.current?.reject(walletError);
    } finally {
      walletConnectResolver.current = null;
      setConnectingWallet(false);
    }
  };

  const handleWalletPickerClose = () => {
    setWalletPickerOpen(false);
    walletConnectResolver.current?.reject(new Error("Wallet connection cancelled."));
    walletConnectResolver.current = null;
  };

  const handleConnectWallet = async () => {
    setConnectingWallet(true);
    setError(null);
    clearStoredAccessToken();

    try {
      await requestWalletConnection();
    } catch (walletError) {
      if (walletError instanceof Error && walletError.message === "Wallet connection cancelled.") {
        return;
      }
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
      const normalized = normalizeCharacterAppearance(appearance);
      let accessToken: string | null = null;

      if (gateEnabled) {
        const session = (await getValidWalletSession()) ?? (await requestWalletConnection());
        if (!session) {
          throw new Error("Connect your wallet to bond and save your character.");
        }

        accessToken = session.accessToken;
        setWalletAddressLocal(session.wallet);
        setWalletAddress(session.wallet);
        setTokenBalance(session.tokenBalance);

        const bonded = await lookupBondedCharacter(accessToken);
        const finalName =
          bonded.found && bonded.bonded && bonded.name ? bonded.name : trimmed;

        if (bonded.found && bonded.bonded && bonded.name) {
          setName(bonded.name);
          setNameBonded(true);
        }

        await saveCharacterAppearance(finalName, normalized, accessToken);
        setNameBonded(true);
        await onJoin(finalName, accessToken, normalized);
      } else {
        await onJoin(trimmed, accessToken, normalized);
      }
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : "Could not connect to the game server.";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  const nameReady = name.trim().length >= 2;
  const enterDisabled = joining || loadingCharacter || !nameReady;

  return (
    <div className="chibi-overlay">
      <form onSubmit={handleSubmit} className="chibi-panel chibi-panel--modal">
        <div style={{ marginBottom: 24 }}>
          <h1 className="chibi-title chibi-sparkle-title">Create Your Chibi Hero</h1>
          <p className="chibi-subtitle" style={{ maxWidth: 560 }}>
            Connect your wallet to bond your character. Name, avatar, and progress stay linked to
            your wallet across sessions.
          </p>
        </div>

        <div className="chibi-login-grid">
          <div>
            <div className="chibi-label">Preview</div>
            <CharacterPreview appearance={appearance} />
            <div className="chibi-text-muted" style={{ marginTop: 12, textAlign: "center" }}>
              {loadingCharacter ? "Loading saved character..." : "Your chibi adventurer"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <label className="chibi-label">Character name</label>
              <input
                className="chibi-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="At least 2 characters"
                readOnly={nameBonded}
              />
              {nameBonded && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                  Name is bonded to your wallet and cannot be changed.
                </div>
              )}
            </div>

            <div>
              <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0 }}>Skin tone</div>
              <ColorSwatches
                colors={SKIN_TONES}
                selected={appearance.bodyColor}
                onSelect={(bodyColor) => updateAppearance({ bodyColor })}
              />
            </div>

            <div>
              <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0 }}>Hair color</div>
              <ColorSwatches
                colors={HAIR_COLORS}
                selected={appearance.hairColor}
                onSelect={(hairColor) => updateAppearance({ hairColor })}
              />
            </div>

            <div>
              <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0 }}>Outfit color</div>
              <ColorSwatches
                colors={OUTFIT_COLORS}
                selected={appearance.outfitColor}
                onSelect={(outfitColor) => updateAppearance({ outfitColor })}
              />
            </div>

            <div>
              <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0 }}>Hair style</div>
              <StylePicker
                options={HAIR_STYLES}
                selected={appearance.hairStyle}
                labels={HAIR_LABELS}
                onSelect={(hairStyle) => updateAppearance({ hairStyle })}
              />
            </div>

            <div>
              <div className="chibi-label" style={{ textTransform: "none", letterSpacing: 0 }}>Outfit style</div>
              <StylePicker
                options={OUTFIT_STYLES}
                selected={appearance.outfitStyle}
                labels={OUTFIT_LABELS}
                onSelect={(outfitStyle) => updateAppearance({ outfitStyle })}
              />
            </div>

            <div className="chibi-card chibi-card--info" style={{ padding: "14px 16px" }}>
                <div className="chibi-label">Wallet</div>
                {gateEnabled && (
                  <>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      Hold at least{" "}
                      <span style={{ color: "#9ad7ff", fontWeight: 700 }}>
                        {minTokenAmount.toLocaleString()}
                      </span>{" "}
                      tokens to enter
                    </div>
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
                  </>
                )}

                {walletAddress ? (
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    Wallet: <span style={{ color: "#9ad7ff" }}>{shortenWallet(walletAddress)}</span>
                    {tokenBalance !== null && (
                      <span style={{ opacity: 0.75 }}> · Balance: {tokenBalance}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 10 }}>
                    Connect Jupiter, Phantom, or another Solana wallet and sign to verify holdings.
                  </div>
                )}

                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  onClick={() => void handleConnectWallet()}
                  disabled={connectingWallet || joining}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  {connectingWallet
                    ? "Verifying wallet..."
                    : walletAddress
                      ? "Reconnect Wallet"
                      : "Connect Wallet"}
                </button>
              </div>
          </div>
        </div>

        {error && (
          <p className="chibi-card chibi-card--danger" style={{ margin: "20px 0 0", fontSize: "0.85rem" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="chibi-btn chibi-btn--primary"
          disabled={enterDisabled}
          style={{ width: "100%", marginTop: 20, padding: "13px 12px", fontSize: "1rem" }}
        >
          {joining
            ? "Entering world..."
            : gateEnabled && !walletAddress
              ? "Connect Wallet & Enter"
              : "Enter Zone"}
        </button>
      </form>

      {walletPickerOpen && (
        <WalletPicker
          wallets={detectedWallets}
          onSelect={(wallet) => void handleWalletPicked(wallet)}
          onClose={handleWalletPickerClose}
        />
      )}
    </div>
  );
}