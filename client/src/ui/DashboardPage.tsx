import {
  DASHBOARD_UPDATES,
  ITEMS,
  MOTTO_MAX_LENGTH,
  type DashboardResponse,
  type InventoryEntry,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { getHttpServerUrl } from "../game/serverUrl";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { WalletConnector } from "../wallet/discovery";
import { shortenWallet } from "../wallet/solanaProvider";
import {
  connectAndVerifyWallet,
  getValidWalletSession,
  listAvailableWallets,
  resolveWalletConnector,
} from "../wallet/tokenGate";
import { CharacterPreview } from "./CharacterPreview";
import { ItemIcon } from "./ItemIcon";
import { WalletPicker } from "./WalletPicker";
import "./dashboard.css";

/**
 * Player dashboard at /dashboard — the landing spot after a wallet sign-in.
 * Shows the bonded character (PFP, levels, motto, mail, currencies, item
 * collections) with a Play Now button into /play. Signed-out visitors get a
 * connect-wallet hero (plus a spectate escape hatch).
 */

const PLAY_URL = "/play?auto=1";
const SPECTATE_URL = "/play?spectate=1";

/** Evergreen in-game activities surfaced as "events". */
const EVENTS: Array<{ title: string; body: string }> = [
  {
    title: "Daily Quests & Login Streak",
    body: "Three fresh tasks every day plus a login-streak chest. Complete them for gold and gems before the daily reset.",
  },
  {
    title: "PvP Season — Climb the Ladder",
    body: "Flag up for duels or brave the red and black zones. Rating resets each season; the top of the ladder earns honor.",
  },
  {
    title: "Guild Wars & Castle Sieges",
    body: "Declare war, contest territories, and lay siege to the castle with your guild for territory buffs and guild coin.",
  },
];

// Recent release highlights live in shared/src/dashboard.ts (DASHBOARD_UPDATES)
// right next to GAME_VERSION, so every release updates them in one place.

type Status = "loading" | "signedOut" | "connecting" | "ready" | "error";

async function fetchDashboard(accessToken: string): Promise<DashboardResponse> {
  const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/dashboard/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load your dashboard.");
  }
  return response.json() as Promise<DashboardResponse>;
}

export function DashboardPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [playersOnline, setPlayersOnline] = useState<number | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<WalletConnector[]>([]);
  const [motto, setMotto] = useState("");
  const [mottoSaving, setMottoSaving] = useState(false);
  const [mottoSaved, setMottoSaved] = useState(false);

  // The game shell locks page scrolling; this is an ordinary web page.
  useEffect(() => {
    const root = document.getElementById("root");
    const targets = [document.documentElement, document.body, root].filter(Boolean) as HTMLElement[];
    const prev = targets.map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
    for (const el of targets) {
      el.style.height = "auto";
      el.style.overflow = "visible";
    }
    document.body.style.overflowY = "auto";
    return () => {
      for (const p of prev) {
        p.el.style.height = p.height;
        p.el.style.overflow = p.overflow;
      }
    };
  }, []);

  useEffect(() => {
    void fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setPlayersOnline(s?.players?.online ?? null))
      .catch(() => undefined);
  }, []);

  // Resume a stored wallet session; otherwise show the connect hero.
  useEffect(() => {
    void (async () => {
      try {
        const session = await getValidWalletSession();
        if (!session) {
          setStatus("signedOut");
          return;
        }
        await adoptSession(session.wallet, session.accessToken);
      } catch {
        setStatus("signedOut");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adoptSession = async (walletAddress: string, token: string) => {
    setWallet(walletAddress);
    setAccessToken(token);
    const dashboard = await fetchDashboard(token);
    setData(dashboard);
    setMotto(dashboard.motto);
    setStatus("ready");
  };

  const connectSelectedWallet = async (connector: WalletConnector) => {
    setStatus("connecting");
    setError(null);
    try {
      const verified = await connectAndVerifyWallet(connector);
      await adoptSession(verified.wallet, verified.accessToken);
    } catch (walletError) {
      const message =
        walletError instanceof Error ? walletError.message : "Wallet verification failed.";
      setError(message);
      setStatus("signedOut");
    }
  };

  const handleConnectWallet = () => {
    setError(null);
    const preferred = resolveWalletConnector();
    if (preferred) {
      void connectSelectedWallet(preferred);
      return;
    }
    const wallets = listAvailableWallets();
    if (wallets.length === 0) {
      setError(
        "No Solana wallet detected. Install Jupiter Wallet (or another Solana wallet), then refresh this page.",
      );
      return;
    }
    setDetectedWallets(wallets);
    setWalletPickerOpen(true);
  };

  const handleSaveMotto = async () => {
    if (!accessToken) return;
    setMottoSaving(true);
    setMottoSaved(false);
    try {
      const response = await fetchWithTimeout(`${getHttpServerUrl()}/api/dashboard/motto`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ motto }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save motto");
      }
      const body = (await response.json()) as { motto: string };
      setMotto(body.motto);
      setMottoSaved(true);
      window.setTimeout(() => setMottoSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save motto");
    } finally {
      setMottoSaving(false);
    }
  };

  // Split the inventory into the three collection rows. Equipped mount/pet
  // live in equipment slots (not the bag), so they're prepended as items.
  const { gear, cosmetics, mountsPets } = useMemo(() => {
    const gearItems: InventoryEntry[] = [];
    const cosmeticItems: InventoryEntry[] = [];
    const mountPetItems: InventoryEntry[] = [];
    for (const id of [data?.equippedMountId, data?.equippedPetId]) {
      if (id) mountPetItems.push({ itemId: id, quantity: 1 });
    }
    for (const entry of data?.inventory ?? []) {
      const kind = ITEMS[entry.itemId]?.kind;
      if (kind === "mount" || kind === "pet") mountPetItems.push(entry);
      else if (kind === "armor") cosmeticItems.push(entry);
      else gearItems.push(entry);
    }
    return { gear: gearItems, cosmetics: cosmeticItems, mountsPets: mountPetItems };
  }, [data]);

  const equippedIds = useMemo(
    () => new Set([data?.equippedMountId, data?.equippedPetId].filter(Boolean) as string[]),
    [data],
  );

  const lastSeen = data?.lastSeenAt
    ? new Date(data.lastSeenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div className="mb-dash">
      <div className="mb-dash__wrap">
        {/* ---- Nav ---- */}
        <nav className="chibi-panel mb-dash__nav">
          <a className="mb-dash__brand" href="/">
            <img src="/metricbase-world.png" alt="" />
            MetricBase World
          </a>
          <div className="mb-dash__links">
            <a href="/dashboard">Dashboard</a>
            <a href="/docs">Wiki</a>
            <a href="/stats">Stats</a>
            <a href="/brands">Advertise</a>
          </div>
          <div className="mb-dash__nav-right">
            {data && (
              <>
                <span className="mb-dash__chip">🪙 {data.gold.toLocaleString()}</span>
                <span className="mb-dash__chip">💎 {data.gems.toLocaleString()}</span>
              </>
            )}
            {wallet ? (
              <span className="mb-dash__chip mb-dash__chip--connected">
                ✓ {shortenWallet(wallet)}
              </span>
            ) : (
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                onClick={handleConnectWallet}
                disabled={status === "connecting" || status === "loading"}
              >
                {status === "connecting" ? "Verifying..." : "Connect"}
              </button>
            )}
          </div>
        </nav>

        {error && (
          <p className="chibi-card chibi-card--danger" style={{ margin: 0, fontSize: "0.85rem", padding: "12px 16px" }}>
            {error}
          </p>
        )}

        {/* ---- Signed-out hero ---- */}
        {(status === "signedOut" || status === "connecting" || status === "loading") && (
          <section className="chibi-panel mb-dash-card mb-dash-connect">
            <h1>Welcome, adventurer! 🌱</h1>
            <p>
              Connect your Solana wallet and sign to open your player dashboard — your character,
              collections, mail, and events all live here.
            </p>
            <div className="mb-dash-connect__actions">
              <button
                type="button"
                className="chibi-btn chibi-btn--primary"
                style={{ padding: "13px 26px", fontSize: "1rem" }}
                onClick={handleConnectWallet}
                disabled={status === "connecting" || status === "loading"}
              >
                {status === "loading"
                  ? "Checking session..."
                  : status === "connecting"
                    ? "Sign in your wallet..."
                    : "🔗 Connect Wallet"}
              </button>
              <a
                className="chibi-btn chibi-btn--secondary"
                style={{ padding: "13px 26px", fontSize: "1rem", textDecoration: "none" }}
                href={SPECTATE_URL}
              >
                👀 Spectate World
              </a>
            </div>
          </section>
        )}

        {/* ---- Signed-in dashboard ---- */}
        {status === "ready" && data && (
          <div className="mb-dash__grid">
            <div className="mb-dash__col">
              <section className="chibi-panel mb-dash-card">
                <h2>Profile</h2>
                <div className="mb-dash-profile">
                  <div className="mb-dash-profile__pfp">
                    <div className="mb-dash-profile__frame">
                      <CharacterPreview appearance={data.appearance} width={140} height={168} />
                    </div>
                    <a
                      className="chibi-btn chibi-btn--primary"
                      style={{ padding: "12px 30px", fontSize: "1rem", textDecoration: "none" }}
                      href={data.found ? PLAY_URL : "/play"}
                    >
                      ▶ Play Now
                    </a>
                  </div>
                  <div>
                    <h3 className="mb-dash-profile__name">
                      {data.found ? data.name : "New Adventurer"}
                    </h3>
                    {!data.found && (
                      <p style={{ fontSize: "0.85rem", color: "var(--chibi-ink-soft)", marginTop: 0 }}>
                        No hero bonded to this wallet yet — hit Play Now to create your chibi hero.
                      </p>
                    )}
                    <div className="mb-dash-stat">
                      📊 <span>Total Level:</span> <b>{data.totalLevel}</b>
                    </div>
                    <div className="mb-dash-stat" style={{ marginBottom: 2 }}>
                      💬 <span>Motto</span>
                    </div>
                    <div className="mb-dash-motto">
                      <input
                        className="chibi-input"
                        value={motto}
                        maxLength={MOTTO_MAX_LENGTH}
                        placeholder="Enter your motto..."
                        onChange={(event) => setMotto(event.target.value)}
                        disabled={!data.found}
                      />
                      <button
                        type="button"
                        className="chibi-btn chibi-btn--secondary"
                        style={{ padding: "8px 16px", fontSize: "0.8rem" }}
                        onClick={() => void handleSaveMotto()}
                        disabled={mottoSaving || !data.found}
                      >
                        {mottoSaving ? "..." : mottoSaved ? "✓ Saved" : "Save"}
                      </button>
                    </div>
                    <div className="mb-dash-stat">
                      🧑‍🤝‍🧑 <span>Players Online:</span> <b>{playersOnline ?? "—"}</b>
                    </div>
                    <div className="mb-dash-stat">
                      📬 <span>Unread Mail:</span> <b>{data.unreadMail}</b>
                    </div>
                    <div className="mb-dash-stat">
                      🕐 <span>Last Seen:</span> <b>{lastSeen}</b>
                    </div>
                  </div>
                </div>
              </section>

              <section className="chibi-panel mb-dash-card">
                <h2>Events</h2>
                <div className="mb-dash-news">
                  {EVENTS.map((event) => (
                    <div key={event.title} className="mb-dash-news__item">
                      <div className="mb-dash-news__title">{event.title}</div>
                      <div className="mb-dash-news__body">{event.body}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mb-dash__col">
              <SlotRow
                title="Gold & Items"
                chip={`🪙 ${data.gold.toLocaleString()} gold`}
                items={gear}
                equippedIds={equippedIds}
              />
              <SlotRow title="Cosmetics" items={cosmetics} equippedIds={equippedIds} />
              <SlotRow title="Mounts & Pets" items={mountsPets} equippedIds={equippedIds} />

              <section className="chibi-panel mb-dash-card">
                <h2>Recent Updates</h2>
                <div className="mb-dash-news">
                  {DASHBOARD_UPDATES.map((update) => (
                    <div key={update.title} className="mb-dash-news__item">
                      <div className="mb-dash-news__title">{update.title}</div>
                      <div className="mb-dash-news__body">{update.body}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        <footer style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--chibi-ink-soft)" }}>
          MetricBase World — powered by $BASE on Solana.
        </footer>
      </div>

      {walletPickerOpen && (
        <WalletPicker
          wallets={detectedWallets}
          onSelect={(connector) => {
            setWalletPickerOpen(false);
            void connectSelectedWallet(connector);
          }}
          onClose={() => setWalletPickerOpen(false)}
        />
      )}
    </div>
  );
}

function SlotRow({
  title,
  chip,
  items,
  equippedIds,
}: {
  title: string;
  chip?: string;
  items: InventoryEntry[];
  equippedIds: Set<string>;
}) {
  const slotCount = Math.max(8, items.length);
  return (
    <section className="chibi-panel mb-dash-card">
      <div className="mb-dash-card__head">
        <h2>{title}</h2>
        {chip && <span className="mb-dash__chip">{chip}</span>}
        <a className="mb-dash-card__more" href={PLAY_URL}>
          ›
        </a>
      </div>
      <div className="mb-dash-slots">
        {Array.from({ length: slotCount }, (_, i) => {
          const entry = items[i];
          if (!entry) {
            return <div key={i} className="mb-dash-slot" />;
          }
          const equipped = equippedIds.has(entry.itemId);
          return (
            <div
              key={i}
              className={`mb-dash-slot mb-dash-slot--filled${equipped ? " mb-dash-slot--equipped" : ""}`}
              title={ITEMS[entry.itemId]?.name ?? entry.itemId}
            >
              <ItemIcon itemId={entry.itemId} size={34} />
              {entry.quantity > 1 && <span className="mb-dash-slot__qty">{entry.quantity}</span>}
              {equipped && <span className="mb-dash-slot__tag">equipped</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
