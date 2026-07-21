import { type DailyStatePayload, type SeasonStatePayload } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { SeasonShareModal } from "./SeasonShareModal";

/**
 * Daily rewards board: the day's 3 rotating tasks with progress bars + claim
 * buttons, and the consecutive-login streak bonus. Opened from the ⚙️ menu.
 */
export function DailyPanel() {
  const open = useGameStore((s) => s.dailyOpen);
  const setOpen = useGameStore((s) => s.setDailyOpen);
  const [state, setState] = useState<DailyStatePayload | null>(null);
  const [season, setSeason] = useState<SeasonStatePayload | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const offState = networkManager.onDailyState((s) => {
      setState(s);
      setPending(false);
    });
    const offSeason = networkManager.onSeasonState(setSeason);
    const offResult = networkManager.onDailyResult((r) => {
      setPending(false);
      setNotice(r.ok ? r.message ?? "Claimed!" : r.error ?? "Couldn't claim.");
      if (r.ok) playSfx("ui_open");
    });
    return () => {
      offState();
      offSeason();
      offResult();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setNotice(null);
      networkManager.requestDailyState();
      networkManager.requestSeasonState();
    }
  }, [open]);

  if (!open) return null;

  const claimTask = (taskId: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendDailyClaimTask(taskId);
  };
  const claimLogin = () => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendDailyClaimLogin();
  };
  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  const timeLeft = (endsAt: number) => {
    const ms = Math.max(0, endsAt - Date.now());
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 400, width: "92vw", maxHeight: "82vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">📅 Daily &amp; Season</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}

      {/* Season standings */}
      {season && (
        <div
          className="chibi-card"
          style={{ marginTop: 10, padding: "12px 14px", borderColor: "#4FB8A8", background: "rgba(79,184,168,0.08)" }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>🏆 Season {season.seasonNumber}</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>ends in {timeLeft(season.endsAt)}</div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{season.points.toLocaleString()}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.64rem" }}>your points</div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{season.rank > 0 ? `#${season.rank}` : "—"}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.64rem" }}>of {season.totalPlayers.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{season.estimatedReward.toLocaleString()}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.64rem" }}>est. $BASE</div>
            </div>
          </div>
          <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 8 }}>
            {season.rewardPool.toLocaleString()} $BASE prize pool, split by points at season end. Play, win PvP, refer
            friends, and top the Richest board to climb.
          </div>
          {season.leaderboard.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {season.leaderboard.slice(0, 5).map((e) => (
                <div
                  key={e.rank}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", padding: "2px 0" }}
                >
                  <span style={{ fontWeight: 700 }}>
                    #{e.rank} {e.name}
                  </span>
                  <span className="chibi-text-muted">{e.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="chibi-btn chibi-btn--gold"
            style={{ width: "100%", marginTop: 10, padding: "8px 10px", fontWeight: 800 }}
            onClick={() => {
              playSfx("ui_open");
              setShareOpen(true);
            }}
          >
            📢 Share my Season
          </button>
        </div>
      )}

      {shareOpen && season && <SeasonShareModal season={season} onClose={() => setShareOpen(false)} />}

      {!state && (
        <div className="chibi-text-muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
          Loading today's tasks…
        </div>
      )}

      {state && (
        <>
          {/* Login streak */}
          <div className="chibi-card" style={{ marginTop: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "1.5rem" }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Day {state.streak} login streak</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                Log in daily to grow the bonus — today pays {state.loginGold.toLocaleString()}g.
              </div>
            </div>
            <button
              type="button"
              className={`chibi-btn ${state.loginClaimed ? "chibi-btn--secondary" : "chibi-btn--gold"}`}
              style={{ padding: "8px 12px" }}
              disabled={pending || state.loginClaimed}
              onClick={claimLogin}
            >
              {state.loginClaimed ? "✓ Claimed" : `Claim ${state.loginGold.toLocaleString()}g`}
            </button>
          </div>

          {/* Today's tasks */}
          <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Today's tasks</div>
          {state.tasks.map((t) => {
            const done = t.progress >= t.target;
            const pct = Math.round((t.progress / t.target) * 100);
            return (
              <div key={t.id} className="chibi-card" style={{ marginTop: 6, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: "1.3rem" }}>{t.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{t.label}</div>
                    <div
                      style={{
                        marginTop: 4,
                        height: 8,
                        borderRadius: 999,
                        background: "#f0e4c8",
                        border: "1.5px solid #e6d3aa",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: done ? "#3fae74" : "#e0a92e",
                          transition: "width .3s ease",
                        }}
                      />
                    </div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 2 }}>
                      {t.progress}/{t.target} · reward {t.gold.toLocaleString()}g{t.gems > 0 ? ` + ${t.gems}💎` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`chibi-btn ${t.claimed ? "chibi-btn--secondary" : done ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
                    style={{ padding: "8px 12px" }}
                    disabled={pending || t.claimed || !done}
                    onClick={() => claimTask(t.id)}
                  >
                    {t.claimed ? "✓" : done ? "Claim" : "…"}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 8 }}>
            Tasks rotate at midnight UTC. Progress counts automatically while you play.
          </div>
        </>
      )}
    </div>
  );
}
