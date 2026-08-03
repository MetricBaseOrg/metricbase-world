import {
  HOLDER_PERKS,
  HOLDER_SKINS,
  NFT_COLLECTION_NAME,
  NFT_MINT_PRICE_SOL,
  NFT_MINT_URL,
  NFT_SUPPLY,
} from "@metricbase/shared";
import { playSfx } from "../audio/soundEffects";
import { openExternalLink } from "../telegram/telegramApp";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

interface MembershipPanelProps {
  onClose: () => void;
}

/**
 * The NFT membership panel. Shows the player's holder status and the perks a
 * holder gets — which are cosmetic and status ONLY (a character skin + a 👑
 * nameplate badge), never gameplay power. The game stays free to play whether
 * or not you hold one.
 */
export function MembershipPanel({ onClose }: MembershipPanelProps) {
  const mobileLayout = useMobileLayout();
  const holder = useGameStore((s) => s.nftHolder);
  const live = NFT_MINT_URL.length > 0;

  const perks = [
    { icon: HOLDER_PERKS.badge, label: "A 👑 badge on your name, everywhere you go" },
    { icon: "🎨", label: `${HOLDER_SKINS.length} holder-exclusive character skins` },
    { icon: "🪪", label: "Verified holder status on the public dashboard" },
  ];

  return (
    <div className="chibi-overlay" style={{ zIndex: 100 }}>
      <div className="chibi-panel chibi-panel--modal" style={{ maxWidth: 500, position: "relative" }}>
        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          style={{
            position: "absolute",
            right: mobileLayout ? 12 : 20,
            top: mobileLayout ? 12 : 20,
            fontSize: mobileLayout ? "0.95rem" : "1.1rem",
            padding: "4px 8px",
          }}
          onClick={() => {
            playSfx("ui_close");
            onClose();
          }}
        >
          ✖
        </button>

        <h2 style={{ margin: "0 0 6px 0", fontSize: mobileLayout ? "1.15rem" : "1.34rem", paddingRight: 32 }}>
          👑 {NFT_COLLECTION_NAME}
        </h2>
        <p className="chibi-text-muted" style={{ marginTop: 0, fontSize: "0.86rem" }}>
          A membership collectible on Solana. Holding one is a badge of support —
          it grants status and cosmetics, never an advantage. The game is free to
          play with or without it.
        </p>

        {holder ? (
          <div
            className="chibi-card"
            style={{ background: "rgba(245,197,24,0.12)", borderColor: "#e6c34a", margin: "8px 0 14px" }}
          >
            <div style={{ fontWeight: 800 }}>✅ You're a holder</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.82rem" }}>
              Your 👑 badge and holder skin are unlocked. Thanks for backing the world.
            </div>
          </div>
        ) : (
          <div className="chibi-card" style={{ margin: "8px 0 14px" }}>
            <div style={{ fontWeight: 800 }}>Not a holder yet</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.82rem" }}>
              {live
                ? `${NFT_SUPPLY.toLocaleString()} total · ~${NFT_MINT_PRICE_SOL} SOL to mint. Perks apply automatically once your wallet holds one.`
                : "The collection isn't live yet — check back soon."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {perks.map((perk) => (
            <div key={perk.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem" }}>
              <span style={{ fontSize: "1.1rem", width: 24, textAlign: "center" }}>{perk.icon}</span>
              <span>{perk.label}</span>
            </div>
          ))}
        </div>

        <div style={{ fontWeight: 800, fontSize: "0.9rem", margin: "4px 0 8px" }}>🎨 Founder wardrobe</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {HOLDER_SKINS.map((skin) => {
            const unlocked = holder;
            const state = !unlocked
              ? { tag: "🔒 Hold to unlock", color: "var(--chibi-ink, #7a6f5c)" }
              : skin.available
                ? { tag: "✅ Ready to wear", color: "#2a8c5c" }
                : { tag: "🎨 Art coming", color: "#c99a12" };
            return (
              <div
                key={skin.id}
                className="chibi-card"
                style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8, opacity: unlocked ? 1 : 0.7 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{skin.name}</div>
                  <div className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>{skin.blurb}</div>
                </div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: state.color, whiteSpace: "nowrap", alignSelf: "center" }}>
                  {state.tag}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="chibi-text-muted"
          style={{ fontSize: "0.72rem", marginBottom: 14, lineHeight: 1.5 }}
        >
          No pay-to-win: a holder never gets more yield, damage, XP, drop-rate, or
          any economic edge. This is cosmetic and status only.
        </div>

        {live && (
          <button
            type="button"
            className="chibi-btn chibi-btn--primary"
            style={{ width: "100%", padding: "10px 12px", fontSize: "0.92rem" }}
            onClick={() => {
              playSfx("ui_click");
              openExternalLink(NFT_MINT_URL, true);
            }}
          >
            {holder ? "👑 View the collection" : "👑 Mint / view on the marketplace"}
          </button>
        )}
      </div>
    </div>
  );
}
