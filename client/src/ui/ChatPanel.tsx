import { CHAT_MAX_LENGTH } from "@metricbase/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { isAnyPanelOpen, useGameStore } from "../store/gameStore";
import { useMobileLayout } from "./useMobileLayout";
import { mentionsLocalPlayer, renderMarkdown } from "./markdown";
import { MentionDropdown, useMentionAutocomplete } from "./mentionPicker";

export function ChatPanel() {
  const [draft, setDraft] = useState("");
  const mobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"zone" | "guild" | "party" | "company">("zone");
  const [inGuild, setInGuild] = useState(false);
  const [inParty, setInParty] = useState(false);
  const [inCompany, setInCompany] = useState(false);
  const messages = useGameStore((state) => state.chatMessages);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileLayout) setOpen(true);
  }, [mobileLayout]);

  // Register the mobile chat SHEET with the central panel gate so HUD chrome
  // (hotbar, touch pads, emote button) hides underneath it. The desktop
  // corner chat is persistent and must NOT suppress the HUD.
  const setChatOpen = useGameStore((s) => s.setChatOpen);
  useEffect(() => {
    setChatOpen(mobileLayout && open);
    return () => setChatOpen(false);
  }, [mobileLayout, open, setChatOpen]);

  useEffect(() => {
    const unsubGuild = networkManager.onGuildState((state) => setInGuild(!!state.myGuild));
    const unsubParty = networkManager.onPartyState((state) => setInParty(!!state.party));
    const unsubCompany = networkManager.onCompanyState((state) => setInCompany(!!state.myCompany));
    return () => {
      unsubGuild();
      unsubParty();
      unsubCompany();
    };
  }, []);

  // Fall back to zone chat if the chosen channel is no longer available.
  useEffect(() => {
    if (channel === "guild" && !inGuild) setChannel("zone");
    if (channel === "party" && !inParty) setChannel("zone");
    if (channel === "company" && !inCompany) setChannel("zone");
  }, [inGuild, inParty, inCompany, channel]);

  const channels: Array<"zone" | "guild" | "party" | "company"> = [
    "zone",
    ...(inGuild ? (["guild"] as const) : []),
    ...(inParty ? (["party"] as const) : []),
    ...(inCompany ? (["company"] as const) : []),
  ];
  const cycleChannel = () =>
    setChannel((c) => channels[(channels.indexOf(c) + 1) % channels.length] ?? "zone");
  const channelLabel =
    channel === "guild" ? "Guild" : channel === "party" ? "Party" : channel === "company" ? "Company" : "Global";

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
    } else if (channel === "party") {
      networkManager.sendPartyChat(body);
    } else if (channel === "company") {
      networkManager.sendCompanyChat(body);
    } else {
      networkManager.sendChat(body);
    }
    setDraft("");
  };

  // Tapping a sender's name opens their profile card (tag/mail from there).
  const tagPlayer = (senderName: string) => {
    playSfx("ui_open");
    useGameStore.getState().setProfileFor(senderName);
  };

  // One-shot insert from the profile card's "Tag in chat" button.
  const chatInsert = useGameStore((s) => s.chatInsert);
  useEffect(() => {
    if (!chatInsert) return;
    setDraft((d) => `${d}${d && !d.endsWith(" ") ? " " : ""}${chatInsert.text}`.slice(0, CHAT_MAX_LENGTH));
    useGameStore.getState().setChatInsert(null);
    if (mobileLayout) setOpen(true);
  }, [chatInsert]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderMessage = (message: (typeof messages)[number]) => {
    const body = <span className="chibi-md">{renderMarkdown(message.body)}</span>;
    if (message.channel === "system") {
      return <span className="chibi-chat-system">{renderMarkdown(message.body)}</span>;
    }
    if (message.channel === "guild") {
      return (
        <>
          <span className="chibi-chat-guild chibi-chat-name-btn" onClick={() => tagPlayer(message.senderName)}>
            [Guild] {message.senderName}:{" "}
          </span>
          {body}
        </>
      );
    }
    if (message.channel === "party") {
      return (
        <>
          <span className="chibi-chat-party chibi-chat-name-btn" onClick={() => tagPlayer(message.senderName)}>
            [Party] {message.senderName}:{" "}
          </span>
          {body}
        </>
      );
    }
    if (message.channel === "company") {
      return (
        <>
          <span className="chibi-chat-company chibi-chat-name-btn" onClick={() => tagPlayer(message.senderName)}>
            [Company] {message.senderName}:{" "}
          </span>
          {body}
        </>
      );
    }
    return (
      <>
        <span className="chibi-chat-global">[Global] </span>
        <span className="chibi-chat-name chibi-chat-name-btn" onClick={() => tagPlayer(message.senderName)}>
          {message.senderName}:{" "}
        </span>
        {body}
      </>
    );
  };

  // "@" autocomplete: pick a player name from the dropdown while typing.
  const mention = useMentionAutocomplete(draft, (next) => setDraft(next.slice(0, CHAT_MAX_LENGTH)));

  // Enter sends; Shift+Enter inserts a newline (long-form, markdown-friendly).
  // While the @ dropdown is open, keys navigate/pick instead.
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.onKeyDown(event)) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const channelToggle =
    channels.length > 1 ? (
      <button
        type="button"
        className={`chibi-btn ${channel === "zone" ? "chibi-btn--secondary" : "chibi-btn--mint"}`}
        style={{ padding: "0 10px", fontSize: "0.72rem", minHeight: 44 }}
        onClick={cycleChannel}
        title="Switch chat channel"
      >
        {channelLabel}
      </button>
    ) : null;

  // Hide the chat FAB while any panel is open so it never floats on top.
  const panelOpen = useGameStore(isAnyPanelOpen);
  if (mobileLayout && !open && panelOpen) return null;

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
            <span className="chibi-title chibi-title--sm">Global Chat</span>
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
              <div className="chibi-text-muted">💬 Global chat is live. Say hello!</div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={message.channel !== "system" && mentionsLocalPlayer(message.body) ? "chibi-chat-row--mention" : undefined}
                  style={{ marginBottom: 6, fontSize: "0.84rem", lineHeight: 1.45 }}
                >
                  {renderMessage(message)}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="chibi-chat-sheet__form">
            {channelToggle}
            <div style={{ position: "relative", flex: 1 }}>
              <MentionDropdown {...mention} />
              <textarea
                className="chibi-input chibi-chat-input"
                value={draft}
                rows={1}
                onChange={(event) => {
                  setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH));
                  mention.update(event.target);
                  event.target.style.height = "auto";
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={onInputKeyDown}
                onFocus={() => {
                  setUiTypingActive(true);
                  networkManager.sendInput(0, 0);
                }}
                onBlur={() => {
                  setUiTypingActive(false);
                  mention.close();
                }}
                placeholder={channel === "zone" ? "Type a message… (Markdown ok, Shift+Enter = newline)" : `Message your ${channelLabel.toLowerCase()}…`}
                style={{ width: "100%" }}
              />
            </div>
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
          <div className="chibi-text-muted">💬 Global chat is live. Say hello!</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.channel !== "system" && mentionsLocalPlayer(message.body) ? "chibi-chat-row--mention" : undefined}
              style={{ marginBottom: 6, fontSize: "0.84rem", lineHeight: 1.45 }}
            >
              {renderMessage(message)}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {channelToggle}
        <div style={{ position: "relative", flex: 1 }}>
          <MentionDropdown {...mention} />
          <textarea
            className="chibi-input chibi-chat-input"
            value={draft}
            rows={1}
            onChange={(event) => {
              setDraft(event.target.value.slice(0, CHAT_MAX_LENGTH));
              mention.update(event.target);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={onInputKeyDown}
            onFocus={() => {
              setUiTypingActive(true);
              networkManager.sendInput(0, 0);
            }}
            onBlur={() => {
              setUiTypingActive(false);
              mention.close();
            }}
            placeholder={channel === "zone" ? "Enter to send · Shift+Enter newline · **markdown**" : `${channelLabel} chat — Enter to send…`}
            style={{ width: "100%" }}
          />
        </div>
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