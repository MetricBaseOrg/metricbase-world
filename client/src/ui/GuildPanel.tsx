import {
  GUILD_CREATE_COST,
  GUILD_MAX_TAX_RATE,
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
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const playerGold = useGameStore((s) => s.playerGold);
  const playerName = useGameStore((s) => s.playerName);

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
  const rank = myGuild?.myRank ?? "member";
  const isLeader = rank === "leader";
  const isOfficerPlus = rank === "leader" || rank === "officer";
  const amountNum = Math.max(0, Math.floor(Number(amount) || 0));
  const taxOptions = [0, 0.02, 0.05, GUILD_MAX_TAX_RATE];

  const numberInputProps = {
    onFocus: () => setUiTypingActive(true),
    onBlur: () => setUiTypingActive(false),
  };

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
        <div className="chibi-who-list" style={{ width: 260, maxHeight: "70vh", overflowY: "auto" }}>
          {myGuild ? (
            <>
              <div className="chibi-who-title">
                [{myGuild.tag}] {myGuild.name}
              </div>
              <div className="chibi-text-muted" style={{ fontSize: "0.72rem", marginBottom: 6 }}>
                {myGuild.memberCount} member{myGuild.memberCount === 1 ? "" : "s"} · You are{" "}
                {rank === "leader" ? "the Leader 👑" : rank === "officer" ? "an Officer ⭐" : "a Member"}
              </div>

              {/* Guild bank */}
              <div className="chibi-card" style={{ fontSize: "0.76rem", padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontWeight: 800 }}>🏦 Bank: {myGuild.bank.toLocaleString()} gold</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    className="chibi-input"
                    value={amount}
                    inputMode="numeric"
                    placeholder="amount"
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    {...numberInputProps}
                    style={{ padding: "4px 6px", fontSize: "0.74rem", width: 70 }}
                    aria-label="Bank amount"
                  />
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--mint"
                    disabled={amountNum <= 0 || amountNum > playerGold}
                    onClick={() => networkManager.sendGuildDeposit(amountNum)}
                    style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                  >
                    Deposit
                  </button>
                  {isOfficerPlus && (
                    <button
                      type="button"
                      className="chibi-btn chibi-btn--gold"
                      disabled={amountNum <= 0 || amountNum > myGuild.bank}
                      onClick={() => networkManager.sendGuildWithdraw(amountNum)}
                      style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>

              {/* Income tax */}
              <div className="chibi-card" style={{ fontSize: "0.76rem", padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontWeight: 800 }}>🧾 Income tax: {Math.round(myGuild.taxRate * 100)}%</div>
                {isLeader && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {taxOptions.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={`chibi-btn ${myGuild.taxRate === rate ? "chibi-btn--gold" : "chibi-btn--secondary"}`}
                        onClick={() => networkManager.sendGuildSetTax(rate)}
                        style={{ padding: "3px 8px", fontSize: "0.7rem" }}
                      >
                        {Math.round(rate * 100)}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Members + rank actions */}
              {myGuild.members.map((member) => {
                const memberRank =
                  member === myGuild.leaderName
                    ? "leader"
                    : myGuild.officers.includes(member)
                      ? "officer"
                      : "member";
                const isSelf = member === playerName;
                return (
                  <div key={member} className="chibi-who-row" style={{ alignItems: "center" }}>
                    <span className="chibi-who-name">
                      {member}
                      {memberRank === "leader" ? " 👑" : memberRank === "officer" ? " ⭐" : ""}
                    </span>
                    {!isSelf && (
                      <span style={{ display: "flex", gap: 4 }}>
                        {isLeader && memberRank === "member" && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--secondary"
                            title="Promote to officer"
                            onClick={() => networkManager.sendGuildPromote(member)}
                            style={{ padding: "2px 6px", fontSize: "0.66rem" }}
                          >
                            ↑
                          </button>
                        )}
                        {isLeader && memberRank === "officer" && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--secondary"
                            title="Demote to member"
                            onClick={() => networkManager.sendGuildDemote(member)}
                            style={{ padding: "2px 6px", fontSize: "0.66rem" }}
                          >
                            ↓
                          </button>
                        )}
                        {isOfficerPlus && memberRank !== "leader" && (
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--danger"
                            title="Kick"
                            onClick={() => networkManager.sendGuildKick(member)}
                            style={{ padding: "2px 6px", fontSize: "0.66rem" }}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Wars */}
              <div className="chibi-who-title" style={{ marginTop: 10 }}>
                ⚔️ Wars
              </div>
              {myGuild.wars.length === 0 ? (
                <div className="chibi-text-muted" style={{ fontSize: "0.7rem" }}>
                  No active wars.
                </div>
              ) : (
                myGuild.wars.map((war) => (
                  <div key={war.id} className="chibi-who-row">
                    <span className="chibi-who-name" style={{ color: "var(--chibi-danger)" }}>
                      [{war.tag}] {war.name}
                    </span>
                    {isOfficerPlus && (
                      <button
                        type="button"
                        className="chibi-btn chibi-btn--secondary"
                        onClick={() => networkManager.sendGuildEndWar(war.id)}
                        style={{ padding: "2px 8px", fontSize: "0.68rem" }}
                      >
                        Peace
                      </button>
                    )}
                  </div>
                ))
              )}

              {isOfficerPlus &&
                state.guilds.filter(
                  (g) => g.id !== myGuild.id && !myGuild.wars.some((w) => w.id === g.id),
                ).length > 0 && (
                  <>
                    <div className="chibi-text-muted" style={{ fontSize: "0.7rem", margin: "6px 0 2px" }}>
                      Declare war:
                    </div>
                    {state.guilds
                      .filter((g) => g.id !== myGuild.id && !myGuild.wars.some((w) => w.id === g.id))
                      .map((g) => (
                        <div key={g.id} className="chibi-who-row">
                          <span className="chibi-who-name">
                            [{g.tag}] {g.name}
                          </span>
                          <button
                            type="button"
                            className="chibi-btn chibi-btn--danger"
                            onClick={() => networkManager.sendGuildDeclareWar(g.id)}
                            style={{ padding: "2px 8px", fontSize: "0.68rem" }}
                          >
                            War
                          </button>
                        </div>
                      ))}
                  </>
                )}

              <button
                type="button"
                className="chibi-btn chibi-btn--secondary"
                style={{ marginTop: 10, width: "100%", padding: "6px 10px", fontSize: "0.76rem" }}
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
