import { useState } from "react";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";

/**
 * @mention autocomplete shared by chat and mail: type "@" and pick a player
 * from a dropdown. Candidates = everyone online in the zone + recent chat
 * senders (covers cross-zone guild/party friends), excluding yourself.
 */

export function getMentionCandidates(): string[] {
  const me = useGameStore.getState().playerName;
  const names = new Set<string>();
  for (const p of networkManager.getRemotePlayers()) {
    if (!p.spectator && p.name) names.add(p.name);
  }
  for (const m of useGameStore.getState().chatMessages) {
    if (m.channel !== "system" && m.senderName) names.add(m.senderName);
  }
  if (me) names.delete(me);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Rank candidates for a query: prefix matches first, then substring. */
export function filterMentionNames(query: string, limit = 6): string[] {
  const q = query.toLowerCase();
  const all = getMentionCandidates();
  const starts = all.filter((n) => n.toLowerCase().startsWith(q));
  const within = q ? all.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q)) : [];
  return [...starts, ...within].slice(0, limit);
}

interface MentionToken {
  /** Index of the "@" in the value. */
  start: number;
  /** Caret position the token runs up to. */
  caret: number;
  query: string;
}

/** The @token being typed at the caret (start-of-text or after whitespace). */
function findMentionToken(value: string, caret: number): MentionToken | null {
  const before = value.slice(0, caret);
  const match = /@([^\s@]{0,16})$/.exec(before);
  if (!match) return null;
  if (match.index > 0 && !/\s/.test(before[match.index - 1])) return null;
  return { start: match.index, caret, query: match[1] };
}

/**
 * Headless @-autocomplete for a textarea/input whose value is `value`.
 * Call `update(el)` from onChange/onClick, route onKeyDown through
 * `onKeyDown` (returns true when it consumed the key), render
 * `<MentionDropdown {...dd} />` inside a position:relative wrapper.
 */
export function useMentionAutocomplete(value: string, setValue: (next: string) => void) {
  const [token, setToken] = useState<MentionToken | null>(null);
  const [idx, setIdx] = useState(0);
  const suggestions = token ? filterMentionNames(token.query) : [];
  const open = token !== null && suggestions.length > 0;

  const update = (el: HTMLTextAreaElement | HTMLInputElement) => {
    const caret = el.selectionStart ?? el.value.length;
    const next = findMentionToken(el.value, caret);
    setToken(next);
    if (!next || next.query !== token?.query) setIdx(0);
  };

  const pick = (name: string) => {
    if (!token) return;
    setValue(`${value.slice(0, token.start)}@${name} ${value.slice(token.caret)}`);
    setToken(null);
  };

  const onKeyDown = (event: React.KeyboardEvent): boolean => {
    if (!open) return false;
    if (event.key === "ArrowDown") {
      setIdx((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      setIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      pick(suggestions[idx] ?? suggestions[0]);
    } else if (event.key === "Escape") {
      setToken(null);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };

  return { open, suggestions, idx, pick, onKeyDown, update, close: () => setToken(null) };
}

export function MentionDropdown({
  open,
  suggestions,
  idx,
  pick,
  placement = "above",
}: {
  open: boolean;
  suggestions: string[];
  idx: number;
  pick: (name: string) => void;
  placement?: "above" | "below";
}) {
  if (!open) return null;
  return (
    <div
      className="chibi-mention-dd"
      style={placement === "above" ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }}
    >
      {suggestions.map((name, i) => (
        <button
          key={name}
          type="button"
          className={`chibi-mention-dd__item${i === idx ? " active" : ""}`}
          // pointerdown (not click) so the input never loses focus first.
          onPointerDown={(event) => {
            event.preventDefault();
            pick(name);
          }}
        >
          @{name}
        </button>
      ))}
    </div>
  );
}
