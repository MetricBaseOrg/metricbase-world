import { CHAT_MAX_LENGTH } from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

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
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 360,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      <div
        ref={listRef}
        style={{
          height: 180,
          overflowY: "auto",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(8, 12, 24, 0.82)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          color: "#f4f7ff",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ opacity: 0.55 }}>Zone chat is live. Say hello.</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 6 }}>
              {message.channel === "system" ? (
                <span style={{ color: "#9ad7ff", fontStyle: "italic" }}>{message.body}</span>
              ) : (
                <>
                  <span style={{ color: "#ffd27f", fontWeight: 600 }}>{message.senderName}: </span>
                  <span>{message.body}</span>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH))}
          placeholder="Press Enter to chat..."
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(8, 12, 24, 0.9)",
            color: "#fff",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            border: "none",
            borderRadius: 8,
            background: "#4f8cff",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}