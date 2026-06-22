import { CHAT_MAX_LENGTH } from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";

export function ChatPanel() {
  const [draft, setDraft] = useState("");
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"zone" | "guild">("zone");
  const [inGuild, setInGuild] = useState(false);
  const messages = useGameStore((state) => state.chatMessages);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileLayout) setOpen(true);
  }, [mobileLayout]);

  useEffect(() => {
    const unsubscribe = networkManager.onGuildState((state) => setInGuild(!!state.myGuild));
    return () => {
      unsubscribe();
    };
  }, []);

  // Fall back to zone chat if the player isn't (or is no longer) in a guild.
  useEffect(() => {
    if (!inGuild && channel === "guild") setChannel("zone");
  }, [inGuild, channel]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    playSfx("chat_send");
    if (channel === "guild") {
      networkManager.sendGuildChat(body);
    } else {
      networkManager.sendChat(body);
    }
    setDraft("");
  };

  const renderMessage = (message: (typeof messages)[number]) => {
    if (message.channel === "system") {
      return <span className="chibi-chat-system">{message.body}</span>;
    }
    if (message.channel === "guild") {
      return (
        <>
          <span className="chibi-chat-guild">[Guild] {message.senderName}: </span>
          <span>{message.body}</span>
        </>
      );
    }
    if (message.channel === "party") {
      return (
        <>
          <span className="chibi-chat-party">[Party] {message.senderName}: </span>
          <span>{message.body}</span>
        </>
      );
    }
    return (
      <>
        <span className="chibi-chat-name">{message.senderName}: </span>
        <span>{message.body}</span>
      </>
    );
  };

  const channelToggle = inGuild ? (
    <button
      type="button"
      className={`chibi-btn ${channel === "guild" ? "chibi-btn--mint" : "chibi-btn--secondary"}`}
      style={{ padding: "0 10px", fontSize: "0.72rem", minHeight: 44 }}
      onClick={() => setChannel((c) => (c === "guild" ? "zone" : "guild"))}
      title="Toggle chat channel"
    >
      {channel === "guild" ? "Guild" : "Zone"}
    </button>
  ) : null;

  if (mobileLayout && !open) {
    return (
      <button
        type="button"
        className="chibi-chat-fab"
        onClick={() => {
          playSfx("ui_open");
          setOpen(true);
        }}
        aria-label="Open chat"
      >
        💬
        {messages.length > 0 && <span className="chibi-chat-fab__badge">{messages.length}</span>}
      </button>
    );
  }

  if (mobileLayout) {
    return (
      <>
        <button
          type="button"
          className="chibi-chat-backdrop"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
        />
        <div className="chibi-chat-sheet">
          <div className="chibi-chat-sheet__header">
            <span className="chibi-title chibi-title--sm">Zone Chat</span>
            <button
              type="button"
              className="chibi-btn chibi-btn--ghost"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="chibi-chat-log chibi-card" style={{ background: "#fff" }}>
            {messages.length === 0 ? (
              <div className="chibi-text-muted">💬 Zone chat is live. Say hello!</div>
            ) : (
              messages.map((message) => (
                <div key={message.id} style={{ marginBottom: 6, fontSize: "0.84rem", lineHeight: 1.45 }}>
                  {renderMessage(message)}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="chibi-chat-sheet__form">
            {channelToggle}
            <input
              className="chibi-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))}
              onFocus={() => {
                setUiTypingActive(true);
                networkManager.sendInput(0, 0);
              }}
              onBlur={() => setUiTypingActive(false)}
              placeholder={channel === "guild" ? "Message your guild..." : "Type a message..."}
              style={{ flex: 1, minHeight: 44 }}
            />
            <button
              type="submit"
              className="chibi-btn chibi-btn--mint"
              style={{ padding: "10px 14px", fontSize: "0.82rem" }}
            >
              Send
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <div className="chibi-panel chibi-panel--floating chibi-panel--chat chibi-anchor chibi-anchor--bottom-left">
      <div ref={listRef} className="chibi-chat-log chibi-card" style={{ background: "#fff" }}>
        {messages.length === 0 ? (
          <div className="chibi-text-muted">💬 Zone chat is live. Say hello!</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 6, fontSize: "0.84rem", lineHeight: 1.45 }}>
              {renderMessage(message)}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        {channelToggle}
        <input
          className="chibi-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))}
          onFocus={() => {
            setUiTypingActive(true);
            networkManager.sendInput(0, 0);
          }}
          onBlur={() => setUiTypingActive(false)}
          placeholder={channel === "guild" ? "Guild chat — press Enter..." : "Press Enter to chat..."}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="chibi-btn chibi-btn--mint"
          style={{ padding: "10px 14px", fontSize: "0.82rem" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}