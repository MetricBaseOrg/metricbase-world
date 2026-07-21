import {
  DEFAULT_APPEARANCE_BY_GENDER,
  DEFAULT_CHARACTER_APPEARANCE,
  defaultAppearanceForGender,
  METRICBASE_TOKEN_MINT,
  normalizeCharacterAppearance,
  type CharacterAppearance,
} from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { lookupBondedCharacter, saveCharacterAppearance } from "../character/characterApi";
import { getInvitationConfig } from "../character/invitationsApi";
import { useGameStore } from "../store/gameStore";
import { playSfx } from "../audio/soundEffects";
import { InvitationsLeaderboardModal } from "./InvitationsLeaderboardModal";
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
    inviteCode?: string,
    spectate?: boolean,
  ) => Promise<void>;
}

// Deep-link auto-joins (/play?auto=1 from the dashboard's Play Now button,
// /play?spectate=1 from the front door). Module-level guard: StrictMode
// remounts the overlay in dev, and a second connect() would double-join.
let autoJoinStarted = false;

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
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateEnabled, setGateEnabled] = useState(true);
  const [tokenMint, setTokenMint] = useState(METRICBASE_TOKEN_MINT);
  const [minTokenAmount, setMinTokenAmount] = useState(1000);
  const [walletAddress, setWalletAddressLocal] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [nameBonded, setNameBonded] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [invitationsActive, setInvitationsActive] = useState(false);
  const [invitationsRequired, setInvitationsRequired] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const walletConnectResolver = useRef<{
    resolve: (value: Awaited<ReturnType<typeof connectAndVerifyWallet>>) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  useEffect(() => {
    getInvitationConfig().then(cfg => {
      setInvitationsActive(cfg.active);
      setInvitationsRequired(Boolean(cfg.required));
    }).catch(err => {
      console.error("Failed to load invitation config", err);
    });

    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get("invite") || params.get("code");
    if (inviteParam) {
      setInviteCode(inviteParam.trim());
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);

      // /play?spectate=1 — jump straight into the world as an anonymous
      // spectator (the server hands out a Guest#### name).
      if (params.get("spectate") === "1" && !autoJoinStarted) {
        autoJoinStarted = true;
        setBootstrapping(false);
        setJoining(true);
        try {
          await onJoin(
            "Guest",
            null,
            normalizeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE),
            undefined,
            true,
          );
        } catch (joinError) {
          const message =
            joinError instanceof Error ? joinError.message : "Could not connect to the game server.";
          setError(message);
        } finally {
          setJoining(false);
        }
        return;
      }

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

          // /play?auto=1 — the dashboard's Play Now button: a signed session
          // with a bonded character skips the form and enters the world.
          if (params.get("auto") === "1" && !autoJoinStarted) {
            const saved = await lookupBondedCharacter(session.accessToken);
            if (saved.found && saved.bonded && saved.name) {
              autoJoinStarted = true;
              setJoining(true);
              try {
                await onJoin(
                  saved.name,
                  session.accessToken,
                  defaultAppearanceForGender(saved.appearance),
                );
              } catch (joinError) {
                const message =
                  joinError instanceof Error
                    ? joinError.message
                    : "Could not connect to the game server.";
                setError(message);
              } finally {
                setJoining(false);
              }
            }
          }
        }
      } catch (bootstrapError) {
        clearStoredAccessToken();
        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Could not reach the game server.";
        setError(message);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [setWalletAddress]);

  const loadBondedCharacter = async (accessToken: string) => {
    setLoadingCharacter(true);
    try {
      const saved = await lookupBondedCharacter(accessToken);
      if (saved.found && saved.bonded && saved.name) {
        setName(saved.name);
        // Everyone now uses their gender's default hero — collapse any legacy
        // custom look (stats/progress are unaffected, server-side).
        setAppearance(defaultAppearanceForGender(saved.appearance));
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
    setError(null);
    clearStoredAccessToken();

    try {
      const wallet = resolveWalletConnector();
      if (wallet) {
        setConnectingWallet(true);
        await connectSelectedWallet(wallet);
        return;
      }

      const wallets = listAvailableWallets();
      if (wallets.length === 0) {
        throw new Error(
          "No Solana wallet detected. Install Jupiter Wallet (or another Solana wallet), then refresh this page.",
        );
      }

      setDetectedWallets(wallets);
      setWalletPickerOpen(true);
      await new Promise<Awaited<ReturnType<typeof connectAndVerifyWallet>>>((resolve, reject) => {
        walletConnectResolver.current = { resolve, reject };
      });
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
      setWalletPickerOpen(false);
      walletConnectResolver.current = null;
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
        let session = await getValidWalletSession();
        if (!session) {
          setConnectingWallet(true);
          try {
            session = await requestWalletConnection();
          } finally {
            setConnectingWallet(false);
            setWalletPickerOpen(false);
          }
        }
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

        const isNew = !(bonded.found && bonded.bonded && bonded.name);
        const codeToUse = inviteCode.trim();
        if (isNew && invitationsActive && invitationsRequired && !codeToUse) {
          throw new Error("Invitation code is required to register.");
        }

        await saveCharacterAppearance(finalName, normalized, accessToken, codeToUse || undefined);
        setNameBonded(true);
        await onJoin(finalName, accessToken, normalized, codeToUse || undefined);
      } else {
        const codeToUse = inviteCode.trim();
        if (invitationsActive && invitationsRequired && !codeToUse) {
          throw new Error("Invitation code is required to register.");
        }
        await onJoin(trimmed, accessToken, normalized, codeToUse || undefined);
      }
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : "Could not connect to the game server.";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  const handleSpectate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter a valid character name (at least 2 characters).");
      return;
    }
    setError(null);
    setJoining(true);

    try {
      const normalized = normalizeCharacterAppearance(appearance);
      await onJoin(trimmed, null, normalized, undefined, true);
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : "Could not connect to the game server.";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  const nameReady = name.trim().length >= 2;
  const enterDisabled = bootstrapping || joining || loadingCharacter || connectingWallet || !nameReady;

  const connectButtonLabel = connectingWallet
    ? "Verifying wallet..."
    : walletPickerOpen
      ? "Choose wallet in popup..."
      : walletAddress
        ? "Reconnect Wallet"
        : "Connect Wallet";

  const enterButtonLabel = bootstrapping
    ? "Checking server..."
    : joining
      ? walletPickerOpen
        ? "Choose wallet to continue..."
        : "Entering world..."
      : gateEnabled && !walletAddress
        ? "Connect Wallet & Enter"
        : "Enter Zone";

  return (
    <div className="chibi-overlay chibi-overlay--login">
      <form onSubmit={handleSubmit} className="chibi-panel chibi-panel--modal chibi-panel--login">
        <div style={{ marginBottom: 24 }}>
          <h1 className="chibi-title chibi-sparkle-title">Create Your Chibi Hero</h1>
          <p className="chibi-subtitle" style={{ maxWidth: 560 }}>
            Connect your wallet to bond your character. Name, avatar, and progress stay linked to
            your wallet across sessions.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="chibi-btn chibi-btn--secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: "0.85rem",
                textDecoration: "none",
              }}
            >
              📖 How-to-Play Guide
            </a>
            <button
              type="button"
              className="chibi-btn chibi-btn--secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: "0.85rem",
              }}
              onClick={() => {
                playSfx("ui_open");
                setLeaderboardOpen(true);
              }}
            >
              🏆 Invitation Leaderboard
            </button>
          </div>
        </div>

        <div className="chibi-login-grid">
          <div className="chibi-login-preview">
            <div className="chibi-label">Preview</div>
            <CharacterPreview appearance={appearance} width={168} height={200} />
            <div className="chibi-text-muted" style={{ marginTop: 12, textAlign: "center" }}>
              {bootstrapping
                ? "Checking wallet status..."
                : loadingCharacter
                  ? "Loading saved character..."
                  : "Your chibi adventurer"}
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

            {invitationsActive && !nameBonded && (
              <div>
                <label className="chibi-label">
                  Invitation Code{invitationsRequired ? "" : " (optional)"}
                </label>
                <input
                  className="chibi-input"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  maxLength={32}
                  placeholder="INV-XXXX-XXXX"
                  required={invitationsRequired}
                />
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                  {invitationsRequired
                    ? "An invitation code is required to register."
                    : "Got a friend's code? Enter it — they'll earn Season points. Otherwise, jump right in."}
                </div>
              </div>
            )}

            {/* Choose your hero — one hand-drawn default per gender. Bonded
                characters keep their saved look; cosmetics arrive later via
                the $BASE lucky wheel. */}
            {!nameBonded && (
              <div>
                <div className="chibi-label">Choose your hero</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {(["male", "female"] as const).map((g) => {
                    const active = (appearance.gender ?? "male") === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        className={`chibi-hero-card${active ? " active" : ""}`}
                        onClick={() => {
                          playSfx("ui_click");
                          setAppearance({ ...DEFAULT_APPEARANCE_BY_GENDER[g] });
                        }}
                      >
                        <CharacterPreview appearance={DEFAULT_APPEARANCE_BY_GENDER[g]} width={92} height={110} />
                        <span className="chibi-hero-card__name">{g === "male" ? "♂ Boy" : "♀ Girl"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                    {tokenMint && (
                      <a
                        href={`https://jup.ag/swap/SOL-${tokenMint}`}
                        target="_blank"
                        rel="noopener"
                        className="chibi-btn chibi-btn--gold"
                        style={{ display: "block", textAlign: "center", padding: "9px 12px", marginBottom: 10, textDecoration: "none" }}
                      >
                        💰 Get $BASE on Jupiter ↗
                      </a>
                    )}
                    {walletAddress && tokenBalance !== null && tokenBalance < minTokenAmount && (
                      <div style={{ fontSize: 12, color: "#ffcaa8", marginBottom: 10 }}>
                        You hold {tokenBalance.toLocaleString()} — grab {(minTokenAmount - tokenBalance).toLocaleString()} more $BASE above to enter.
                      </div>
                    )}
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
                  disabled={connectingWallet || joining || bootstrapping}
                  style={{ width: "100%", padding: "10px 12px" }}
                >
                  {connectButtonLabel}
                </button>
              </div>
          </div>
        </div>

        {error && (
          <p className="chibi-card chibi-card--danger" style={{ margin: "20px 0 0", fontSize: "0.85rem" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            type="submit"
            className="chibi-btn chibi-btn--primary"
            disabled={enterDisabled}
            style={{ flex: 1, padding: "13px 12px", fontSize: "1rem" }}
          >
            {enterButtonLabel}
          </button>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            disabled={bootstrapping || joining || !nameReady}
            onClick={handleSpectate}
            style={{ flex: 1, padding: "13px 12px", fontSize: "1rem" }}
          >
            👀 Spectate World
          </button>
        </div>
      </form>

      {walletPickerOpen && (
        <WalletPicker
          wallets={detectedWallets}
          onSelect={(wallet) => void handleWalletPicked(wallet)}
          onClose={handleWalletPickerClose}
        />
      )}

      {leaderboardOpen && (
        <InvitationsLeaderboardModal onClose={() => setLeaderboardOpen(false)} />
      )}
    </div>
  );
}