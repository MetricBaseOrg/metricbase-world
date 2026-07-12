import { useEffect, useState } from "react";
import { METRICBASE_TOKEN_MINT } from "@metricbase/shared";
import "./landing.css";

/**
 * Marketing landing page served at "/". A polished front door (styled after
 * modern Solana-game sites) that showcases the key art and routes players
 * into the game at "/play". Self-contained dark theme, scoped under
 * `.mb-landing` so it never touches the in-game chibi theme.
 */

const BUY_URL = `https://pump.fun/coin/${METRICBASE_TOKEN_MINT}`;
// Sign-in flow: Connect Wallet → sign → land on the player dashboard, whose
// Play Now button enters the game. Spectate skips the wallet entirely.
const DASHBOARD_URL = "/dashboard";
const SPECTATE_URL = "/play?spectate=1";

interface LiveStats {
  players: number;
  online: number;
  worlds: number;
  baseBurned: number;
}

function kfmt(n: number): string {
  if (!n) return "0";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

const FEATURES: Array<{ emoji: string; title: string; body: string }> = [
  { emoji: "⛏️", title: "Gather & Craft", body: "Chop, mine, fish, and farm across living zones, then craft gear, tools, and food at the workbench." },
  { emoji: "🌍", title: "Build Your World", body: "Buy a zone, build it from hand-drawn assets, stock it with nodes, set a PvP tier, and charge visitors." },
  { emoji: "⚔️", title: "PvP & Danger Zones", body: "Flag up for opt-in duels or brave red and black zones where loot drops — with guild wars and castle sieges." },
  { emoji: "💰", title: "A Real Economy", body: "Every gold coin is minted by play and burned by sinks. Trade on the P2P market, priced in $BASE." },
  { emoji: "🧑‍🌾", title: "Jobs & Guilds", body: "Hire and get hired for contracts, join a guild, party up for bonus XP, and climb the leaderboards." },
  { emoji: "📣", title: "Earn from Ads", body: "In-world billboards run brand campaigns — and players share 50% of the ad revenue, on-chain." },
];

export function LandingPage() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [copied, setCopied] = useState(false);

  // The game shell locks page scrolling (html/body/#root are height:100% +
  // overflow:hidden for the canvas). The landing is an ordinary web page, so
  // undo that here — otherwise the page can't scroll past the first viewport.
  useEffect(() => {
    const root = document.getElementById("root");
    const targets = [document.documentElement, document.body, root].filter(Boolean) as HTMLElement[];
    const prev = targets.map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
    for (const el of targets) {
      el.style.height = "auto";
      el.style.overflow = "visible";
    }
    document.body.style.overflowY = "auto";
    return () => {
      for (const p of prev) {
        p.el.style.height = p.height;
        p.el.style.overflow = p.overflow;
      }
    };
  }, []);

  useEffect(() => {
    void fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) =>
        setStats({
          players: s?.players?.registered ?? 0,
          online: s?.players?.online ?? 0,
          worlds: s?.worlds?.total ?? 0,
          baseBurned: s?.baseToken?.burned ?? 0,
        }),
      )
      .catch(() => undefined);
  }, []);

  const copyMint = () => {
    void navigator.clipboard?.writeText(METRICBASE_TOKEN_MINT).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="mb-landing">
      {/* ---- Nav ---- */}
      <nav className="mb-nav">
        <a className="mb-brand" href="/">
          <img src="/metricbase-world.png" alt="" className="mb-brand__icon" />
          <span className="mb-brand__name">MetricBase World</span>
          <span className="mb-live">● LIVE MMO</span>
        </a>
        <div className="mb-nav__links">
          <a href={DASHBOARD_URL}>Play</a>
          <a href="/docs">Wiki</a>
          <a href="/stats">Stats</a>
          <a href="/brands">Advertise</a>
        </div>
        <div className="mb-nav__cta">
          <a className="mb-btn mb-btn--ghost" href={DASHBOARD_URL}>Log in</a>
          <a className="mb-btn mb-btn--gold" href={BUY_URL} target="_blank" rel="noopener noreferrer">Buy $BASE</a>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <header className="mb-hero">
        <div className="mb-hero__copy">
          <h1 className="mb-wordmark">METRICBASE WORLD</h1>
          <p className="mb-tagline">
            A browser-based Solana MMO and real-life economic simulation. Gather, craft, farm, and
            fight; build your own World; and trade in a living chibi economy powered by
            <strong> $BASE</strong>. Every coin is earned — nothing is faked.
          </p>
          <div className="mb-hero__cta">
            <a className="mb-btn mb-btn--play" href={DASHBOARD_URL}>🔗 Connect Wallet & Play</a>
            <a className="mb-btn mb-btn--ghost" href={SPECTATE_URL}>👀 Spectate</a>
            <a className="mb-btn mb-btn--gold" href={BUY_URL} target="_blank" rel="noopener noreferrer">Buy $BASE</a>
            <a className="mb-btn mb-btn--ghost" href="/docs">📖 How to Play</a>
          </div>
          {stats && (
            <div className="mb-livestrip">
              <div><b>{kfmt(stats.players)}</b><span>adventurers</span></div>
              <div><b className="mb-green">{kfmt(stats.online)}</b><span>online now</span></div>
              <div><b>{kfmt(stats.worlds)}</b><span>player Worlds</span></div>
              <div><b className="mb-burn">{kfmt(stats.baseBurned)}</b><span>$BASE burned</span></div>
            </div>
          )}
        </div>
        <div className="mb-hero__art">
          <img src="/metricbase-world.png" alt="MetricBase World key art" />
        </div>
      </header>

      {/* ---- Contract address ---- */}
      <section className="mb-ca">
        <div className="mb-ca__label">$BASE CONTRACT ADDRESS</div>
        <button type="button" className="mb-ca__box" onClick={copyMint} title="Click to copy">
          <span className="mb-ca__addr">{METRICBASE_TOKEN_MINT}</span>
          <span className="mb-ca__copy">{copied ? "✓ Copied" : "⧉ Copy"}</span>
        </button>
      </section>

      {/* ---- What is it ---- */}
      <section className="mb-what">
        <h2>What is MetricBase World?</h2>
        <p className="mb-what__lead">
          A persistent, browser-based MMO where a real economy runs on your play. Level combat and
          gathering skills, craft and trade, build and monetize your own zones, and fight other
          players — all transparently tracked and powered by the $BASE token.
        </p>
        <div className="mb-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="mb-feature">
              <div className="mb-feature__emoji">{f.emoji}</div>
              <div className="mb-feature__title">{f.title}</div>
              <div className="mb-feature__body">{f.body}</div>
            </div>
          ))}
        </div>
        <div className="mb-what__cta">
          <a className="mb-btn mb-btn--play mb-btn--lg" href={DASHBOARD_URL}>▶ Play in your browser</a>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="mb-footer">
        <div className="mb-footer__links">
          <a href={DASHBOARD_URL}>Play</a>
          <a href="/docs">Wiki</a>
          <a href="/stats">Live Stats</a>
          <a href="/brands">Advertise</a>
          <a href={BUY_URL} target="_blank" rel="noopener noreferrer">Buy $BASE</a>
        </div>
        <div className="mb-footer__note">
          Powered by the $BASE token on Solana · numbers are live from the game database.
        </div>
      </footer>
    </div>
  );
}
