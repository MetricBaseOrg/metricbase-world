import {
  GAME_VERSION,
  farmingXpProgress,
  fishingXpProgress,
  getItemDefinition,
  miningXpProgress,
  woodcuttingXpProgress,
  xpProgress,
} from "@metricbase/shared";
import { useEffect, useRef, useState } from "react";
import { isMusicEnabled, setMusicEnabled } from "../audio/backgroundMusic";
import { isSoundEnabled, playSfx, setSoundEnabled } from "../audio/soundEffects";
import { nudgeZoom } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { shortenWallet } from "../wallet/solanaProvider";
import { DayNightClock } from "./DayNightClock";
import { PortraitCanvas } from "./PortraitCanvas";
import { useMobileLayout } from "./useMobileLayout";
import { WalletConnectBar } from "./WalletConnectBar";

interface TopBarProps {
  onLeave: () => void;
}

/** Compact desktop top bar: glanceable stats up top, settings tucked behind ⚙️. */
/** Compact relative timestamp for the notification list. */
function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function TopBar({ onLeave }: TopBarProps) {
  const mobileLayout = useMobileLayout();
  const menuOpen = useGameStore((s) => s.settingsOpen);
  const setMenuOpen = useGameStore((s) => s.setSettingsOpen);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);
  const [renaming, setRenaming] = useState(false);

  // Show the outcome of a name change; the network layer reconnects on success.
  useEffect(() => {
    return networkManager.onRenameResult((res) => {
      setRenaming(false);
      if (res.ok && res.newName) {
        useGameStore.getState().setPlayerName(res.newName);
        useGameStore.getState().addNotification("✏️", `Your name is now "${res.newName}".`);
      } else {
        window.alert(res.error ?? "Rename failed.");
      }
    });
  }, []);

  const handleRename = () => {
    const current = useGameStore.getState().playerName;
    const input = window.prompt("Choose a new name (1–16 letters, numbers, underscore):", current);
    if (input == null) return;
    const name = input.trim();
    if (name === current) return;
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
      window.alert("Use 1–16 letters, numbers, or underscores.");
      return;
    }
    setRenaming(true);
    playSfx("ui_click");
    networkManager.sendRename(name);
  };
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem("mb_hud_min") === "1";
    } catch {
      return false;
    }
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Notification centre (🔔) dropdown.
  const [bellOpen, setBellOpen] = useState(false);
  const notifications = useGameStore((s) => s.notifications);
  const notifUnread = notifications.filter((n) => !n.read).length;

  const toggleMinimized = () => {
    setMinimized((v) => {
      const next = !v;
      try {
        localStorage.setItem("mb_hud_min", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
    playSfx("ui_click");
  };

  const {
    playerName,
    playerLevel,
    playerXp,
    playerGold,
    honor,
    gems,
    mailUnread,
    playerHp,
    playerMaxHp,
    playerStamina,
    playerMaxStamina,
    equippedWeaponId,
    equippedToolId,
    lampOn,
    setLampOn,
    walletAddress,
    zoneName,
    woodcuttingLevel,
    woodcuttingXp,
    miningLevel,
    miningXp,
    fishingLevel,
    fishingXp,
    farmingLevel,
    farmingXp,
    setInvitationsOpen,
    spectator,
  } = useGameStore();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const xp = xpProgress(playerXp, playerLevel);
  const wood = woodcuttingXpProgress(woodcuttingXp, woodcuttingLevel);
  const mine = miningXpProgress(miningXp, miningLevel);
  const fish = fishingXpProgress(fishingXp, fishingLevel);
  const farm = farmingXpProgress(farmingXp, farmingLevel);
  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
  const energyRatio = playerMaxStamina > 0 ? playerStamina / playerMaxStamina : 0;

  const characterAppearance = useGameStore((s) => s.characterAppearance);

  // On mobile the player can collapse the HUD to a small portrait pill to free screen space.
  const collapsed = mobileLayout && minimized;

  if (collapsed && !spectator) {
    return (
      <div className={`chibi-topbar chibi-anchor chibi-anchor--top-left chibi-topbar--mobile chibi-topbar--min`}>
        <button type="button" className="chibi-hudcard chibi-hudcard--mini" onClick={toggleMinimized} aria-label="Expand HUD" title="Expand HUD">
          <div className="chibi-hudcard__portrait">
            <PortraitCanvas appearance={characterAppearance} size={40} />
            <span className="chibi-hudcard__lvl">Lv {playerLevel}</span>
          </div>
          <span className="chibi-hudcard__mini-expand">▸</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`chibi-topbar chibi-anchor chibi-anchor--top-left${mobileLayout ? " chibi-topbar--mobile" : ""}`}>
      {spectator ? (
        <span className="chibi-badge" style={{ fontSize: "0.82rem", padding: "6px 12px", background: "#3b82f6", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
          👀 SPECTATOR MODE (FREE FLY)
        </span>
      ) : (
        <div className="chibi-hudcard">
          <div className="chibi-hudcard__portrait">
            <PortraitCanvas appearance={characterAppearance} size={58} />
            <span className="chibi-hudcard__lvl">Lv {playerLevel}</span>
          </div>
          <div className="chibi-hudcard__body">
            <div className="chibi-hudcard__name">{playerName}</div>
            <Bar color="#ff5a5a" track="#5a2230" value={hpRatio} text={`${playerHp} / ${playerMaxHp}`} />
            <Bar color="#4f9bff" track="#1f3a5a" value={energyRatio} text={`${playerStamina} / ${playerMaxStamina}`} />
            <div className="chibi-hudcard__chips">
              <span className="chibi-mini-pip" title={`Combat XP ${xp.current}/${xp.required}`}>⚔️ {playerLevel}</span>
              <span className="chibi-mini-pip" title={`Woodcutting ${wood.current}/${wood.required}`}>🪓 {woodcuttingLevel}</span>
              <span className="chibi-mini-pip" title={`Mining ${mine.current}/${mine.required}`}>⛏️ {miningLevel}</span>
              <span className="chibi-mini-pip" title={`Fishing ${fish.current}/${fish.required}`}>🎣 {fishingLevel}</span>
              <span className="chibi-mini-pip" title={`Farming ${farm.current}/${farm.required}`}>🌾 {farmingLevel}</span>
            </div>
          </div>
          <button
            type="button"
            className={`chibi-btn chibi-btn--ghost chibi-topbar__gear${menuOpen ? " active" : ""}`}
            onClick={() => { playSfx(menuOpen ? "ui_close" : "ui_open"); setMenuOpen(!menuOpen); }}
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
          {mobileLayout && (
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost chibi-topbar__min"
              onClick={toggleMinimized}
              aria-label="Minimize HUD"
              title="Minimize HUD"
            >
              ▾
            </button>
          )}
        </div>
      )}

      {!spectator && (
        <div className="chibi-currency-strip">
          <span className="chibi-currency-chip" title="Gold">🪙 {playerGold.toLocaleString()}</span>
          {honor > 0 && (
            <span className="chibi-currency-chip" title="Honor — earned from PvP wins">🎖️ {honor.toLocaleString()}</span>
          )}
          {gems > 0 && (
            <span className="chibi-currency-chip" title="Gems — rare drops from strong foes">💎 {gems.toLocaleString()}</span>
          )}
          <button
            type="button"
            className="chibi-currency-chip chibi-currency-chip--btn"
            title="Open world map (M)"
            onClick={() => {
              playSfx("ui_open");
              useGameStore.getState().setMapOpen(true);
            }}
          >
            🗺️ {zoneName}
          </button>
          <button
            type="button"
            className="chibi-currency-chip chibi-currency-chip--btn chibi-mail-chip"
            title="Open mailbox"
            onClick={() => {
              playSfx("ui_open");
              useGameStore.getState().setMailOpen(true);
            }}
          >
            📬{mailUnread > 0 && <span className="chibi-mail-badge">{mailUnread}</span>}
          </button>
          <button
            type="button"
            className="chibi-currency-chip chibi-currency-chip--btn chibi-mail-chip"
            title="Notifications"
            onClick={() => {
              playSfx(bellOpen ? "ui_close" : "ui_open");
              setBellOpen((open) => {
                if (!open) useGameStore.getState().markNotificationsRead();
                return !open;
              });
            }}
          >
            🔔{notifUnread > 0 && <span className="chibi-mail-badge">{notifUnread}</span>}
          </button>
          <DayNightClock className="chibi-currency-chip" />
        </div>
      )}

      {bellOpen && (
        <div className="chibi-topbar__menu" style={{ maxHeight: "min(60vh, 420px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>🔔 Notifications</span>
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              style={{ padding: "2px 10px", fontSize: "0.75rem" }}
              onClick={() => {
                playSfx("ui_close");
                setBellOpen(false);
              }}
            >
              ×
            </button>
          </div>
          {notifications.length === 0 ? (
            <div className="chibi-text-muted" style={{ fontSize: "0.78rem", padding: "10px 0" }}>
              Nothing yet — mentions, mail, and duel challenges land here.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                  padding: "6px 4px",
                  borderTop: "1.5px dashed var(--chibi-outline-light)",
                  fontSize: "0.8rem",
                  opacity: n.read ? 0.75 : 1,
                }}
              >
                <span>{n.icon}</span>
                <span style={{ flex: 1, lineHeight: 1.35 }}>{n.text}</span>
                <span className="chibi-text-muted" style={{ fontSize: "0.66rem", whiteSpace: "nowrap" }}>
                  {timeAgo(n.at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {menuOpen && (
        <div
          className="chibi-topbar__menu"
          ref={menuRef}
          style={{ maxHeight: "min(70vh, 520px)", overflowY: "auto" }}
        >
          {(equippedWeaponId || equippedToolId) && (
            <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginBottom: 6 }}>
              {equippedWeaponId && <div>⚔️ {getItemDefinition(equippedWeaponId).name}</div>}
              {equippedToolId && <div>🛠️ {getItemDefinition(equippedToolId).name}</div>}
            </div>
          )}

          {walletAddress ? (
            <div className="chibi-text-muted" style={{ fontSize: "0.74rem", marginBottom: 8 }}>
              💳 {shortenWallet(walletAddress)}
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <WalletConnectBar compact hint="Connect wallet to trade on the gold market." />
            </div>
          )}

          {walletAddress && (
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              style={{ width: "100%", marginBottom: 8, padding: "6px 10px", fontSize: "0.78rem" }}
              disabled={renaming}
              title="Change your display name (progress and items are kept)"
              onClick={handleRename}
            >
              {renaming ? "⏳ Renaming…" : "✏️ Change Name"}
            </button>
          )}

          <div className="chibi-topbar__menu-toggles">
            <button type="button" className="chibi-btn chibi-btn--ghost" title={soundOn ? "Mute sound" : "Enable sound"}
              onClick={() => { const n = !soundOn; setSoundEnabled(n); setSoundOn(n); if (n) playSfx("ui_click"); }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button type="button" className="chibi-btn chibi-btn--ghost" style={{ opacity: musicOn ? 1 : 0.45 }} title={musicOn ? "Mute music" : "Enable music"}
              onClick={() => { const n = !musicOn; setMusicEnabled(n); setMusicOn(n); if (n && soundOn) playSfx("ui_click"); }}>
              🎵
            </button>
            <button type="button" className="chibi-btn chibi-btn--ghost" style={{ opacity: lampOn ? 1 : 0.55 }} title="Toggle lamp (L)"
              onClick={() => { const n = !lampOn; setLampOn(n); networkManager.sendToggleLamp(n); if (soundOn) playSfx("ui_click"); }}>
              {lampOn ? "🔦" : "💡"}
            </button>
            <button type="button" className="chibi-btn chibi-btn--ghost" title="Zoom in" onClick={() => { nudgeZoom(0.3); if (soundOn) playSfx("ui_click"); }}>🔍+</button>
            <button type="button" className="chibi-btn chibi-btn--ghost" title="Zoom out" onClick={() => { nudgeZoom(-0.3); if (soundOn) playSfx("ui_click"); }}>🔍−</button>
          </div>

          <a href="/docs" target="_blank" rel="noopener noreferrer" className="chibi-stat-pill" style={{ display: "inline-flex", gap: 6, marginTop: 8, textDecoration: "none", fontSize: "0.78rem" }}>
            📖 How to Play
          </a>
          <a href="/stats" target="_blank" rel="noopener noreferrer" className="chibi-stat-pill" style={{ display: "inline-flex", gap: 6, marginTop: 8, marginLeft: 8, textDecoration: "none", fontSize: "0.78rem" }}>
            📊 Economy
          </a>
          <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="chibi-stat-pill" style={{ display: "inline-flex", gap: 6, marginTop: 8, marginLeft: 8, textDecoration: "none", fontSize: "0.78rem" }}>
            🧑 Dashboard
          </a>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setDailyOpen(true); setMenuOpen(false); }}>
            📅 Daily Rewards
          </button>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setJobsOpen(true); setMenuOpen(false); }}>
            🧑‍🌾 Job Board
          </button>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setCompanyOpen(true); setMenuOpen(false); }}>
            🏢 Companies
          </button>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setExchangeOpen(true); setMenuOpen(false); }}>
            📈 Stock Exchange
          </button>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setAdsOpen(true); setMenuOpen(false); }}>
            📣 Ads &amp; Earnings
          </button>

          <button type="button" className="chibi-btn chibi-btn--mint" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setWorldsOpen(true); setMenuOpen(false); }}>
            🌍 Worlds
          </button>

          <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); useGameStore.getState().setHousingMarketOpen(true); setMenuOpen(false); }}>
            🏘️ Housing Market
          </button>

          <button type="button" className="chibi-btn chibi-btn--primary" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); setInvitationsOpen(true); setMenuOpen(false); }}>
            ✉️ Invite Friends
          </button>

          {/* Wallet players only — a `tg:` account IS the Telegram side and has
              nothing to link. Lives here because the redemption step was
              otherwise only on /dashboard, which is unreachable on mobile. */}
          {!useGameStore.getState().walletAddress?.startsWith("tg:") && (
            <button type="button" className="chibi-btn chibi-btn--secondary" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
              onClick={() => { playSfx("ui_open"); useGameStore.getState().setTelegramLinkOpen(true); setMenuOpen(false); }}>
              ✈️ Link Telegram
            </button>
          )}

          {isAdmin && (
            <button type="button" className="chibi-btn chibi-btn--danger" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
              onClick={() => { playSfx("ui_open"); useGameStore.getState().setAdminOpen(true); setMenuOpen(false); }}>
              🛡️ Admin
            </button>
          )}

          <button type="button" className="chibi-btn chibi-btn--secondary" style={{ width: "100%", marginTop: 10, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_close"); onLeave(); }}>
            Leave World
          </button>
          <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.66rem", textAlign: "center", opacity: 0.7 }}>
            client v{GAME_VERSION}
          </div>
        </div>
      )}
    </div>
  );
}

/** A horizontal stat bar (HP / Energy) with an overlaid value label. */
function Bar({ value, text, color, track }: { value: number; text: string; color: string; track: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="chibi-hudbar" style={{ background: track }}>
      <div className="chibi-hudbar__fill" style={{ width: `${pct}%`, background: color }} />
      <span className="chibi-hudbar__text">{text}</span>
    </div>
  );
}
