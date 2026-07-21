import { type LeaderboardEntry, type LeaderboardPayload } from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardPanel() {
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"season" | "level" | "gold" | "skill" | "pvp">("season");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const playerName = useGameStore((s) => s.playerName);

  const seasonTimeLeft = (endsAt: number) => {
    const ms = Math.max(0, endsAt - Date.now());
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  useEffect(() => {
    if (!open) return;
    const unsubscribe = networkManager.onLeaderboard((payload) => setData(payload));
    networkManager.requestLeaderboard();
    const interval = window.setInterval(() => networkManager.requestLeaderboard(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [open]);

  const rows: LeaderboardEntry[] =
    (tab === "season"
      ? data?.topSeason
      : tab === "level"
        ? data?.topLevel
        : tab === "gold"
          ? data?.topGold
          : tab === "skill"
            ? data?.topSkill
            : data?.topPvp) ?? [];

  return (
    <div className="chibi-leaderboard">
      <button
        type="button"
        className={`chibi-who-toggle${open ? " active" : ""}${mobileLayout ? " chibi-who-toggle--fab" : ""}`}
        aria-label="Leaderboard"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          playSfx(open ? "ui_close" : "ui_open");
          setOpen((v) => !v);
        }}
      >
        {mobileLayout ? "🏆" : "🏆 Leaderboard"}
      </button>
      {open && (
        <div className="chibi-who-list" style={{ width: 224 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`chibi-btn ${tab === "season" ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
              style={{ flex: 1, padding: "4px 6px", fontSize: "0.72rem" }}
              onClick={() => setTab("season")}
            >
              🏆 Season
            </button>
            <button
              type="button"
              className={`chibi-btn ${tab === "level" ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
              style={{ flex: 1, padding: "4px 6px", fontSize: "0.72rem" }}
              onClick={() => setTab("level")}
            >
              Level
            </button>
            <button
              type="button"
              className={`chibi-btn ${tab === "gold" ? "chibi-btn--gold" : "chibi-btn--ghost"}`}
              style={{ flex: 1, padding: "4px 6px", fontSize: "0.72rem" }}
              onClick={() => setTab("gold")}
            >
              Richest
            </button>
            <button
              type="button"
              className={`chibi-btn ${tab === "skill" ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
              style={{ flex: 1, padding: "4px 6px", fontSize: "0.72rem" }}
              onClick={() => setTab("skill")}
            >
              Skills
            </button>
            <button
              type="button"
              className={`chibi-btn ${tab === "pvp" ? "chibi-btn--danger" : "chibi-btn--ghost"}`}
              style={{ flex: 1, padding: "4px 6px", fontSize: "0.72rem" }}
              onClick={() => setTab("pvp")}
            >
              PvP
            </button>
          </div>
          {tab === "season" && data && (
            <div
              className="chibi-card"
              style={{ padding: "6px 8px", marginBottom: 6, borderColor: "#4FB8A8", background: "rgba(79,184,168,0.08)", textAlign: "center" }}
            >
              <div style={{ fontWeight: 800, fontSize: "0.74rem" }}>
                Season {data.seasonNumber} · ends in {seasonTimeLeft(data.seasonEndsAt)}
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 2 }}>
                💰 {data.rewardPool.toLocaleString()} $BASE prize pool · split by points
              </div>
            </div>
          )}
          {tab === "gold" && (
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem", textAlign: "center", marginBottom: 4 }}>
              Net worth · gold + items + property
            </div>
          )}
          {tab === "pvp" && (
            <div className="chibi-text-muted" style={{ fontSize: "0.68rem", textAlign: "center", marginBottom: 4 }}>
              Season {(data?.season ?? 0) + 1} · top by rating
            </div>
          )}
          {rows.length === 0 && (
            <div className="chibi-text-muted" style={{ fontSize: "0.76rem", textAlign: "center", padding: "6px 0" }}>
              Loading…
            </div>
          )}
          {rows.map((entry, i) => (
            <div
              key={entry.name}
              className="chibi-who-row"
              style={entry.name === playerName ? { background: "rgba(255, 209, 102, 0.28)" } : undefined}
            >
              <span className="chibi-who-name">
                <span style={{ opacity: 0.7, marginRight: 4 }}>{MEDALS[i] ?? `${i + 1}.`}</span>
                {entry.name}
              </span>
              <span className="chibi-who-lvl">
                {tab === "season"
                  ? `🏆 ${(entry.points ?? 0).toLocaleString()}`
                  : tab === "level"
                    ? `Lv ${entry.level}`
                    : tab === "gold"
                      ? `🪙 ${(entry.netWorth ?? entry.gold).toLocaleString()}`
                      : tab === "skill"
                        ? `⛏️ ${entry.skill ?? 0}`
                        : `⚔️ ${entry.rating ?? 0} · ${entry.rank ?? "Bronze"}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
