import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import {
  getInvitationsLeaderboard,
  InvitationsLeaderboardEntry,
} from "../character/invitationsApi";
import { shortenWallet } from "../wallet/solanaProvider";
import { useMobileLayout } from "./useMobileLayout";

interface InvitationsLeaderboardModalProps {
  onClose: () => void;
}

export function InvitationsLeaderboardModal({ onClose }: InvitationsLeaderboardModalProps) {
  const mobileLayout = useMobileLayout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<InvitationsLeaderboardEntry[]>([]);

  useEffect(() => {
    getInvitationsLeaderboard()
      .then((res) => {
        setEntries(res);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="chibi-overlay" style={{ zIndex: 110 }}>
      <div className="chibi-panel chibi-panel--modal" style={{ maxWidth: 440, position: "relative" }}>
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

        <h2 style={{ margin: "0 0 16px 0", fontSize: mobileLayout ? "1.15rem" : "1.34rem", display: "flex", alignItems: "center", gap: 8 }}>
          🏆 Invitation Leaderboard
        </h2>

        {error && (
          <div className="chibi-card chibi-card--error" style={{ marginBottom: 16, padding: "10px 14px", fontSize: "0.85rem" }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.6 }}>
            Loading top inviters...
          </div>
        ) : (
          <div>
            <div style={{ maxHeight: mobileLayout ? 260 : 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.length === 0 ? (
                <div style={{ textAlign: "center", opacity: 0.5, padding: "30px 0", fontSize: "0.85rem" }}>
                  No invitations recorded yet. Be the first to invite your friends!
                </div>
              ) : (
                entries.map((entry, index) => {
                  const isTop3 = index < 3;
                  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`;
                  return (
                    <div
                      key={entry.walletAddress}
                      className="chibi-card"
                      style={{
                        padding: mobileLayout ? "8px 10px" : "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        background: isTop3 ? "rgba(255, 215, 0, 0.05)" : undefined,
                        border: isTop3 ? "2px solid var(--chibi-accent)" : undefined,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: mobileLayout ? 8 : 12, minWidth: 0 }}>
                        <span style={{ fontSize: isTop3 ? "1.15rem" : "0.9rem", fontWeight: "bold", width: 28, display: "inline-block", textAlign: "center" }}>
                          {medal}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "bold",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              maxWidth: mobileLayout ? "140px" : "200px"
                            }}
                          >
                            {entry.playerName || "Traveler"}
                          </div>
                          <div className="chibi-text-muted" style={{ fontSize: "0.72rem", fontFamily: "monospace", marginTop: 1 }}>
                            {shortenWallet(entry.walletAddress)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--chibi-lavender)" }}>
                          {entry.inviteCount}
                        </span>
                        <span className="chibi-text-muted" style={{ fontSize: "0.64rem", textTransform: "uppercase" }}>
                          Invited
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
