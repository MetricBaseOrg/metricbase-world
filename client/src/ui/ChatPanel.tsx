import { CHAT_MAX_LENGTH } from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { panelPosition } from "./chibiTheme";

export function ChatPanel() {
  const [draft, setDraft] = useState("");
  const messages = useGameStore((state) => state.chatMessages);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    networkManager.sendChat(body);
    setDraft("");
  };

  return (
    <div
      className="chibi-panel chibi-panel--floating"
      style={{
        ...panelPosition("bottom-left"),
        width: 360,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        zIndex: 17,
      }}
    >
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