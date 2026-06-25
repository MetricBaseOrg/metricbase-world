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
import { CircleGauge } from "./CircleGauge";
import { DayNightClock } from "./DayNightClock";
import { useMobileLayout } from "./useMobileLayout";
import { WalletConnectBar } from "./WalletConnectBar";
import { InvitationsModal } from "./InvitationsModal";

interface TopBarProps {
  onLeave: () => void;
}

/** Compact desktop top bar: glanceable stats up top, settings tucked behind ⚙️. */
export function TopBar({ onLeave }: TopBarProps) {
  const mobileLayout = useMobileLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
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

  const ratio = (p: { current: number; required: number }) =>
    p.required > 0 ? p.current / p.required : 0;
  const xp = xpProgress(playerXp, playerLevel);
  const wood = woodcuttingXpProgress(woodcuttingXp, woodcuttingLevel);
  const mine = miningXpProgress(miningXp, miningLevel);
  const fish = fishingXpProgress(fishingXp, fishingLevel);
  const farm = farmingXpProgress(farmingXp, farmingLevel);
  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
  const energyRatio = playerMaxStamina > 0 ? playerStamina / playerMaxStamina : 0;

  return (
    <div className="chibi-topbar chibi-anchor chibi-anchor--top-left">
      <div className="chibi-topbar__row">
        <span className="chibi-topbar__brand">✦ {playerName}</span>
        <span className="chibi-topbar__lvl">Lv {playerLevel}</span>
        <div className="chibi-stat-pill">🗺️ {zoneName}</div>
        <DayNightClock />
      </div>

      <div className="chibi-topbar__gauges">
        <Badge value={hpRatio} label={`${playerHp}`} caption="HP" color="#ff6b6b" title={`HP ${playerHp}/${playerMaxHp}`} />
        <Badge value={energyRatio} label={`${playerStamina}`} caption="Energy" color="#f5a623" title={`Energy ${playerStamina}/${playerMaxStamina}`} />
        <Badge value={ratio(xp)} label={`${playerLevel}`} caption="Level" color="var(--chibi-lavender)" title={`Combat XP ${xp.current}/${xp.required}`} />
        <Badge value={ratio(wood)} label={`${woodcuttingLevel}`} caption="Wood" color="#43a047" title={`Woodcutting ${wood.current}/${wood.required}`} />
        <Badge value={ratio(mine)} label={`${miningLevel}`} caption="Mining" color="#b0833a" title={`Mining ${mine.current}/${mine.required}`} />
        <Badge value={ratio(fish)} label={`${fishingLevel}`} caption="Fishing" color="#3690cf" title={`Fishing ${fish.current}/${fish.required}`} />
        <Badge value={ratio(farm)} label={`${farmingLevel}`} caption="Farming" color="#e0a82e" title={`Farming ${farm.current}/${farm.required}`} />
        <div className="chibi-topbar__gold">🪙 {playerGold}</div>
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

      {invitationsOpen && (
        <InvitationsModal onClose={() => setInvitationsOpen(false)} />
      )}
    </div>
  );
}

function Badge({ value, label, caption, color, title }: { value: number; label: string; caption: string; color: string; title: string }) {
  return (
    <div className="chibi-topbar__badge">
      <CircleGauge value={value} label={label} title={title} color={color} size={30} strokeWidth={3.5} />
      <span className="chibi-topbar__badge-cap">{caption}</span>
    </div>
  );
}
