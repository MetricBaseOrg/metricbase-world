import {
  GUILD_CREATE_COST,
  GUILD_NAME_MAX_LENGTH,
  GUILD_TAG_MAX_LENGTH,
  isValidGuildName,
  isValidGuildTag,
  sanitizeGuildTag,
  type GuildStatePayload,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

export function GuildPanel() {
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GuildStatePayload>({ myGuild: null, guilds: [] });
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const playerGold = useGameStore((s) => s.playerGold);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = networkManager.onGuildState((payload) => setState(payload));
    const unsubscribeResult = networkManager.onGuildResult((payload) => {
      if (payload.ok) {
        playSfx("craft");
        setError(null);
        setName("");
        setTag("");
      } else {
        playSfx("shop_fail");
        setError(payload.error ?? "Action failed.");
      }
    });
    networkManager.requestGuilds();
    return () => {
      unsubscribe();
      unsubscribeResult();
    };
  }, [open]);

  const myGuild = state.myGuild;
  const canAfford = playerGold >= GUILD_CREATE_COST;
  const canCreate = canAfford && isValidGuildName(name.trim()) && isValidGuildTag(sanitizeGuildTag(tag));

  return (
    <div className="chibi-guild">
      <button
        type="button"
        className={`chibi-who-toggle${open ? " active" : ""}${mobileLayout ? " chibi-who-toggle--fab" : ""}`}
        aria-label="Guild"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          playSfx(open ? "ui_close" : "ui_open");
          setOpen((v) => !v);
        }}
      >
        {mobileLayout ? "🛡️" : myGuild ? `🛡️ [${myGuild.tag}]` : "🛡️ Guild"}
      </button>

      {open && (
        <div className="chibi-who-list" style={{ width: 248 }}>
          {myGuild ? (
            <>
              <div className="chibi-who-title">
                [{myGuild.tag}] {myGuild.name}
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginBottom: 6 }}>
                {myGuild.memberCount} member{myGuild.memberCount === 1 ? "" : "s"} · Leader{" "}
                {myGuild.leaderName}
              </div>
              {myGuild.members.map((member) => (
                <div key={member} className="chibi-who-row">
                  <span className="chibi-who-name">
                    {member}
                    {member === myGuild.leaderName ? " 👑" : ""}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="chibi-btn chibi-btn--secondary"
                style={{ marginTop: 8, width: "100%", padding: "6px 10px", fontSize: "0.76rem" }}
                onClick={() => networkManager.sendGuildLeave()}
              >
                Leave Guild
              </button>
            </>
          ) : (
            <>
              <div className="chibi-who-title">Found a Guild</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  className="chibi-input"
                  value={name}
                  maxLength={GUILD_NAME_MAX_LENGTH}
                  placeholder="Guild name"
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setUiTypingActive(true)}
                  onBlur={() => setUiTypingActive(false)}
                  style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                  aria-label="Guild name"
                />
                <input
                  className="chibi-input"
                  value={tag}
                  maxLength={GUILD_TAG_MAX_LENGTH}
                  placeholder="Tag (2-4, A-Z/0-9)"
                  onChange={(e) => setTag(sanitizeGuildTag(e.target.value))}
                  onFocus={() => setUiTypingActive(true)}
                  onBlur={() => setUiTypingActive(false)}
                  style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                  aria-label="Guild tag"
                />
                <button
                  type="button"
                  className="chibi-btn chibi-btn--gold"
                  disabled={!canCreate}
                  onClick={() => networkManager.sendGuildCreate(name.trim(), sanitizeGuildTag(tag))}
                  style={{ padding: "6px 10px", fontSize: "0.76rem" }}
                >
                  Found · 🪙 {GUILD_CREATE_COST}
                </button>
                {!canAfford && (
                  <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                    You need {GUILD_CREATE_COST - playerGold} more gold.
                  </div>
                )}
              </div>

              {state.guilds.length > 0 && (
                <>
                  <div className="chibi-who-title" style={{ marginTop: 10 }}>
                    Join a Guild
                  </div>
                  {state.guilds.map((guild) => (
                    <div key={guild.id} className="chibi-who-row">
                      <span className="chibi-who-name">
                        [{guild.tag}] {guild.name}
                      </span>
                      <button
                        type="button"
                        className="chibi-btn chibi-btn--primary"
                        style={{ padding: "3px 8px", fontSize: "0.7rem" }}
                        onClick={() => networkManager.sendGuildJoin(guild.id)}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {error && (
            <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.74rem" }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
