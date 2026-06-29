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
export function TopBar({ onLeave }: TopBarProps) {
  const mobileLayout = useMobileLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const {
    playerName,
    playerLevel,
    playerXp,
    playerGold,
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

  if (mobileLayout) return null;

  const xp = xpProgress(playerXp, playerLevel);
  const wood = woodcuttingXpProgress(woodcuttingXp, woodcuttingLevel);
  const mine = miningXpProgress(miningXp, miningLevel);
  const fish = fishingXpProgress(fishingXp, fishingLevel);
  const farm = farmingXpProgress(farmingXp, farmingLevel);
  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
  const energyRatio = playerMaxStamina > 0 ? playerStamina / playerMaxStamina : 0;

  const characterAppearance = useGameStore((s) => s.characterAppearance);

  return (
    <div className="chibi-topbar chibi-anchor chibi-anchor--top-left">
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
            onClick={() => { playSfx(menuOpen ? "ui_close" : "ui_open"); setMenuOpen((v) => !v); }}
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      )}

      {!spectator && (
        <div className="chibi-currency-strip">
          <span className="chibi-currency-chip" title="Gold">🪙 {playerGold.toLocaleString()}</span>
          <span className="chibi-currency-chip" title="Zone">🗺️ {zoneName}</span>
          <DayNightClock />
        </div>
      )}

      {menuOpen && (
        <div className="chibi-topbar__menu" ref={menuRef}>
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

          <button type="button" className="chibi-btn chibi-btn--primary" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
            onClick={() => { playSfx("ui_open"); setInvitationsOpen(true); setMenuOpen(false); }}>
            ✉️ Invite Friends
          </button>

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
