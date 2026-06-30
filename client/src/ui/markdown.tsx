import { type ReactNode } from "react";

// A tiny, safe Markdown renderer for chat. It returns React nodes (never raw
// HTML), so user text can't inject markup. Supports: **bold**, *italic*,
// `inline code`, [links](https url), and line breaks.

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyBase}-${key++}`} className="chibi-md-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${keyBase}-${key++}`}>{token.slice(1, -1)}</em>);
    } else {
      const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token);
      if (link) {
        const url = /^https?:\/\//i.test(link[2]) ? link[2] : null;
        nodes.push(
          url ? (
            <a key={`${keyBase}-${key++}`} href={url} target="_blank" rel="noopener noreferrer">
              {link[1]}
            </a>
          ) : (
            link[1]
          ),
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render a chat body string as light Markdown (bold/italic/code/links/newlines). */
export function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const content = bullet ? bullet[1] : line;
    return (
      <span key={i}>
        {bullet ? "• " : null}
        {renderInline(content, String(i))}
        {i < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}
