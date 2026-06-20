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
  const messages = useGameStore((state) => state.chatMessages);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileLayout) setOpen(true);
  }, [mobileLayout]);

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
    networkManager.sendChat(body);
    setDraft("");
  };

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
                  {message.channel === "system" ? (
                    <span className="chibi-chat-system">{message.body}</span>
                  ) : (
                    <>
                      <span className="chibi-chat-name">{message.senderName}: </span>
                      <span>{message.body}</span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="chibi-chat-sheet__form">
            <input
              className="chibi-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))}
              onFocus={() => {
                setUiTypingActive(true);
                networkManager.sendInput(0, 0);
              }}
              onBlur={() => setUiTypingActive(false)}
              placeholder="Type a message..."
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
              {message.channel === "system" ? (
                <span className="chibi-chat-system">{message.body}</span>
              ) : (
                <>
                  <span className="chibi-chat-name">{message.senderName}: </span>
                  <span>{message.body}</span>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          className="chibi-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))}
          onFocus={() => {
            setUiTypingActive(true);
            networkManager.sendInput(0, 0);
          }}
          onBlur={() => setUiTypingActive(false)}
          placeholder="Press Enter to chat..."
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