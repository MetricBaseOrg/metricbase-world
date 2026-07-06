import {
  MAIL_MAX_BODY,
  MAIL_MAX_SUBJECT,
  MAIL_SEND_COST,
  type MailMessage,
} from "@metricbase/shared";
import { useEffect, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { renderMarkdown } from "./markdown";
import { filterMentionNames, MentionDropdown, useMentionAutocomplete } from "./mentionPicker";

type Tab = "inbox" | "compose";

export function MailPanel() {
  const open = useGameStore((s) => s.mailOpen);
  const setOpen = useGameStore((s) => s.setMailOpen);

  const [tab, setTab] = useState<Tab>("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [to, setTo] = useState("");
  const [toFocused, setToFocused] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [gold, setGold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // One-shot compose preload from the profile card's "Send mail" button.
  const mailComposeTo = useGameStore((s) => s.mailComposeTo);
  useEffect(() => {
    if (!mailComposeTo) return;
    setTab("compose");
    setTo(mailComposeTo.name);
    useGameStore.getState().setMailComposeTo(null);
  }, [mailComposeTo]);

  // Recipient picker: suggest known player names while the field is focused.
  const toQuery = to.trim();
  const toSuggestions =
    toFocused && toQuery.length > 0
      ? filterMentionNames(toQuery, 5).filter((n) => n.toLowerCase() !== toQuery.toLowerCase())
      : [];
  // "@" autocomplete inside the letter body.
  const bodyMention = useMentionAutocomplete(body, (next) => setBody(next.slice(0, MAIL_MAX_BODY)));

  useEffect(() => {
    const offState = networkManager.onMailState((s) => setMessages(s.messages));
    const offResult = networkManager.onMailResult((r) => {
      setBusy(false);
      if (!r.ok) {
        playSfx("shop_fail");
        setError(r.error ?? "Could not send.");
        return;
      }
      playSfx("shop_sell");
      setNotice("Letter sent!");
      setTo("");
      setSubject("");
      setBody("");
      setGold("");
      setTab("inbox");
      networkManager.requestMailState();
      window.setTimeout(() => setNotice(null), 2500);
    });
    return () => {
      offState();
      offResult();
    };
  }, []);

  useEffect(() => {
    if (open) networkManager.requestMailState();
  }, [open]);

  if (!open) return null;

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const openMessage = (m: MailMessage) => {
    setSelectedId(m.id);
    if (!m.read) networkManager.mailRead(m.id);
  };

  const send = () => {
    const g = Number(gold) || 0;
    if (!to.trim() || !subject.trim()) {
      setError("Recipient and subject are required.");
      return;
    }
    setBusy(true);
    setError(null);
    networkManager.sendMail(to.trim(), subject.trim(), body, g);
  };

  return (
    <div className="chibi-overlay-scrim" role="dialog" aria-label="Mail">
      <div className="chibi-panel chibi-panel--floating chibi-mail">
        <div className="chibi-close-row">
          <div className="chibi-mail__tabs">
            <button
              type="button"
              className={`chibi-btn ${tab === "inbox" ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
              style={{ padding: "4px 10px", fontSize: "0.76rem" }}
              onClick={() => {
                setTab("inbox");
                setError(null);
              }}
            >
              📥 Inbox{messages.some((m) => !m.read) ? ` (${messages.filter((m) => !m.read).length})` : ""}
            </button>
            <button
              type="button"
              className={`chibi-btn ${tab === "compose" ? "chibi-btn--primary" : "chibi-btn--ghost"}`}
              style={{ padding: "4px 10px", fontSize: "0.76rem" }}
              onClick={() => {
                setTab("compose");
                setError(null);
              }}
            >
              ✍️ Write
            </button>
          </div>
          <button
            type="button"
            className="chibi-btn chibi-btn--ghost"
            onClick={() => {
              playSfx("ui_close");
              setOpen(false);
            }}
            aria-label="Close mail"
          >
            ×
          </button>
        </div>

        {tab === "inbox" ? (
          <div className="chibi-mail__body">
            {messages.length === 0 ? (
              <div className="chibi-card chibi-text-muted" style={{ padding: "18px 0", textAlign: "center" }}>
                Your mailbox is empty.
              </div>
            ) : selected ? (
              <div className="chibi-mail__read">
                <button
                  type="button"
                  className="chibi-btn chibi-btn--ghost"
                  style={{ alignSelf: "flex-start", padding: "3px 8px", fontSize: "0.72rem" }}
                  onClick={() => setSelectedId(null)}
                >
                  ‹ Back
                </button>
                <div className="chibi-mail__subject">{selected.subject}</div>
                <div className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>
                  From{" "}
                  <strong
                    className="chibi-chat-name-btn"
                    style={{ color: "#2f74c0", cursor: "pointer" }}
                    onClick={() => useGameStore.getState().setProfileFor(selected.sender)}
                  >
                    {selected.sender}
                  </strong>{" "}
                  · {new Date(selected.sentAt).toLocaleDateString()}
                </div>
                <div className="chibi-mail__text">
                  {selected.body ? renderMarkdown(selected.body) : <em>(no message)</em>}
                </div>
                {selected.gold > 0 && (
                  <button
                    type="button"
                    className="chibi-btn chibi-btn--gold"
                    disabled={selected.claimed}
                    onClick={() => {
                      playSfx("item_use");
                      networkManager.mailClaim(selected.id);
                    }}
                  >
                    {selected.claimed ? "Gold claimed" : `🪙 Claim ${selected.gold.toLocaleString()} gold`}
                  </button>
                )}
                <button
                  type="button"
                  className="chibi-btn chibi-btn--secondary"
                  style={{ padding: "5px 10px", fontSize: "0.74rem" }}
                  onClick={() => {
                    networkManager.mailDelete(selected.id);
                    setSelectedId(null);
                  }}
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="chibi-mail__list">
                {messages.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chibi-mail__row${m.read ? "" : " unread"}`}
                    onClick={() => openMessage(m)}
                  >
                    <span className="chibi-mail__dot" aria-hidden="true">{m.read ? "" : "●"}</span>
                    <span className="chibi-mail__rowmain">
                      <span className="chibi-mail__rowsubject">{m.subject}</span>
                      <span className="chibi-mail__rowfrom">{m.sender}</span>
                    </span>
                    {m.gold > 0 && (
                      <span className="chibi-mail__rowgold" title="Has a gold attachment">
                        {m.claimed ? "✓" : "🪙"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="chibi-mail__compose">
            <div style={{ position: "relative" }}>
              <input
                className="chibi-input"
                placeholder="Recipient name"
                value={to}
                maxLength={64}
                style={{ width: "100%" }}
                onChange={(e) => setTo(e.target.value)}
                onFocus={() => setToFocused(true)}
                onBlur={() => setToFocused(false)}
              />
              {toSuggestions.length > 0 && (
                <div className="chibi-mention-dd" style={{ top: "100%", marginTop: 4 }}>
                  {toSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="chibi-mention-dd__item"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setTo(name);
                        setToFocused(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              className="chibi-input"
              placeholder="Subject"
              value={subject}
              maxLength={MAIL_MAX_SUBJECT}
              onChange={(e) => setSubject(e.target.value)}
            />
            <div style={{ position: "relative" }}>
              <MentionDropdown {...bodyMention} placement="below" />
              <textarea
                className="chibi-input"
                placeholder="Message (optional) — @Name to tag someone"
                value={body}
                maxLength={MAIL_MAX_BODY}
                rows={4}
                style={{ width: "100%" }}
                onChange={(e) => {
                  setBody(e.target.value);
                  bodyMention.update(e.target);
                }}
                onKeyDown={(e) => {
                  bodyMention.onKeyDown(e);
                }}
                onBlur={() => bodyMention.close()}
              />
            </div>
            <input
              className="chibi-input"
              inputMode="numeric"
              placeholder="Attach gold (optional)"
              value={gold}
              onChange={(e) => setGold(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <div className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>
              Postage: {MAIL_SEND_COST} gold{Number(gold) > 0 ? ` + ${Number(gold).toLocaleString()} attached` : ""}.
            </div>
            <button type="button" className="chibi-btn chibi-btn--primary" disabled={busy} onClick={() => send()}>
              {busy ? "Sending…" : "Send Letter"}
            </button>
          </div>
        )}

        {notice && <div className="chibi-text-muted" style={{ marginTop: 8, fontSize: "0.76rem" }}>{notice}</div>}
        {error && (
          <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, fontSize: "0.78rem" }}>{error}</div>
        )}
      </div>
    </div>
  );
}
