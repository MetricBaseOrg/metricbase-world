import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import {
  getInvitations,
  generateInvitationCode,
  InvitationStateResponse,
} from "../character/invitationsApi";
import { InvitationsLeaderboardModal } from "./InvitationsLeaderboardModal";

interface InvitationsModalProps {
  onClose: () => void;
}

export function InvitationsModal({ onClose }: InvitationsModalProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InvitationStateResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const fetchStats = async () => {
    const token = networkManager.getAccessToken();
    if (!token) {
      setError("Please log in to manage invitations.");
      setLoading(false);
      return;
    }
    try {
      const res = await getInvitations(token);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  const handleGenerate = async () => {
    const token = networkManager.getAccessToken();
    if (!token) return;

    setGenerating(true);
    setError(null);
    try {
      playSfx("ui_click");
      await generateInvitationCode(token);
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (code: string) => {
    playSfx("ui_click");
    const link = `${window.location.origin}/?invite=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  return (
    <div className="chibi-overlay" style={{ zIndex: 100 }}>
      <div className="chibi-panel chibi-panel--modal" style={{ maxWidth: 540, position: "relative" }}>
        <button
          type="button"
          className="chibi-btn chibi-btn--ghost"
          style={{ position: "absolute", right: 20, top: 20, fontSize: "1.1rem" }}
          onClick={() => {
            playSfx("ui_close");
            onClose();
          }}
        >
          ✖
        </button>

        <h2 style={{ margin: "0 0 16px 0", fontSize: "1.34rem", display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 40 }}>
          <span>✉️ Invitation Portal</span>
          <button
            type="button"
            className="chibi-btn chibi-btn--secondary"
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
            onClick={() => {
              playSfx("ui_open");
              setLeaderboardOpen(true);
            }}
          >
            🏆 Leaderboard
          </button>
        </h2>

        {error && (
          <div className="chibi-card chibi-card--error" style={{ marginBottom: 16, padding: "10px 14px", fontSize: "0.85rem" }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", opacity: 0.6 }}>
            Loading invitations...
          </div>
        ) : (
          <div>
            {data && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div className="chibi-card" style={{ padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{data.invitedCount}</div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                      Friends Invited
                    </div>
                  </div>
                  <div className="chibi-card" style={{ padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{data.codesRemaining}</div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                      Codes Remaining
                    </div>
                  </div>
                </div>

                <div className="chibi-card chibi-card--info" style={{ padding: "12px 14px", marginBottom: 20, fontSize: "0.8rem" }}>
                  <strong>Milestone Progression:</strong>
                  <div style={{ marginTop: 6, lineHeight: "1.4" }}>
                    You start with 5 codes. Get 3 more codes after 5 successful invites, and 3 more for every 3 invites after that!
                  </div>
                  <div style={{ marginTop: 8, fontSize: "0.75rem", opacity: 0.8 }}>
                    Current Limit: {data.maxCodesAllowed} codes (Generated: {data.generatedCount})
                  </div>
                </div>

                <button
                  type="button"
                  className="chibi-btn chibi-btn--primary"
                  style={{ width: "100%", padding: "12px 14px", fontWeight: "bold", marginBottom: 24 }}
                  disabled={data.codesRemaining <= 0 || generating}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating..." : data.codesRemaining > 0 ? "🎫 Generate Invitation Code" : "🔒 No Codes Left (Invite More Friends)"}
                </button>

                <h3 style={{ fontSize: "0.95rem", margin: "0 0 10px 0" }}>Your Invitation Links</h3>
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.codes.length === 0 ? (
                    <div style={{ textAlign: "center", opacity: 0.5, padding: "20px 0", fontSize: "0.85rem" }}>
                      No codes generated yet. Click the button above to get started!
                    </div>
                  ) : (
                    data.codes.map((item) => (
                      <div
                        key={item.code}
                        className="chibi-card"
                        style={{
                          padding: "10px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          background: item.inviteeWallet ? "rgba(255, 255, 255, 0.05)" : undefined,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "bold", fontFamily: "monospace" }}>{item.code}</div>
                          <div
                            className="chibi-text-muted"
                            style={{
                              fontSize: "0.68rem",
                              marginTop: 2,
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.inviteeWallet ? (
                              <span style={{ color: "#7ed6df" }}>
                                Used by {item.inviteeName || item.inviteeWallet.slice(0, 8)}
                              </span>
                            ) : (
                              <span>Unused (Click copy link to share)</span>
                            )}
                          </div>
                        </div>

                        {!item.inviteeWallet && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--secondary"
                            style={{ padding: "4px 8px", fontSize: "0.72rem", flexShrink: 0 }}
                            onClick={() => handleCopy(item.code)}
                          >
                            {copiedCode === item.code ? "✓ Copied!" : "📋 Copy Link"}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {leaderboardOpen && (
        <InvitationsLeaderboardModal onClose={() => setLeaderboardOpen(false)} />
      )}
    </div>
  );
}
