# MetricBase World 🌍

Browser-native isometric MMO and living economic simulation — gather, craft,
trade, fight, build your own World, and take part in a fully transparent
$BASE-powered economy. No download; it runs in your browser — or inside
Telegram, with no wallet at all.

**Free to play.** Entry requires no $BASE. A wallet is your identity (it saves
your character and receives Season rewards), and Telegram players can nominate
a payout address instead — see [Accounts & identity](#accounts--identity).

- **Play (web):** [world.metricbase.org](https://world.metricbase.org)
- **Play (Telegram Mini App):** [t.me/MetricBaseWorldBot/play](https://t.me/MetricBaseWorldBot/play)
- **Wiki / How to play:** [world.metricbase.org/docs](https://world.metricbase.org/docs)
- **Live economy dashboard:** [world.metricbase.org/stats](https://world.metricbase.org/stats)
- **Advertise (Brand Portal):** [world.metricbase.org/brands](https://world.metricbase.org/brands)

## Accounts & identity

Three ways in, one economy:

| Sign-in | Identity key | Can play | Can receive $BASE |
|---|---|---|---|
| Solana wallet | the wallet address | ✅ | ✅ directly |
| Telegram (no wallet) | `tg:<telegram-id>` | ✅ | only after setting a **reward wallet** |
| Spectate | none (`Guest####`) | watch only | — |

- **Entry is free** — `MIN_TOKEN_UI_AMOUNT=0`. $BASE buys optional things
  (gold at Rudi's desk, VIP passes, land, World slots), never entry.
- **A `tg:` identity is not a payable address.** `isWalletIdentity()` guards
  every on-chain path, and season payouts exclude it in SQL. Telegram players
  set a `payout_wallet` (a destination, never an identity — it authenticates
  nothing) from ⚙️ → 📅 Daily & Season.
- **Wallet players can link Telegram** (⚙️ → ✈️ Link Telegram) to sign in from
  the Mini App as their existing character. `telegram_id` is a second *login*
  key; identity stays the wallet, so nothing merges.

⚠️ `TOKEN_GATE_DISABLED` is **not** the free-to-play switch — it bypasses
signature and ban checks and is honoured only under `NODE_ENV=development|test`.
Use `MIN_TOKEN_UI_AMOUNT` to change entry requirements.

Details: [`docs/telegram-mini-app.md`](docs/telegram-mini-app.md).

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Client | Phaser 3, React, Vite | **Vercel** |
| Game server | Colyseus, Express | **Railway** (persistent WebSockets) |
| Database | PostgreSQL | **Neon** |
| Chain | Solana ($BASE SPL token) | Helius / public RPC |
| Shared | TypeScript | Monorepo workspace (pnpm) |

> **Why not all on Vercel?** Colyseus needs a persistent WebSocket server.
> Vercel serverless functions can't host real-time game rooms, so the client
> ships to Vercel while the game server runs on an always-on Node host.

## Local development

```bash
npx pnpm install
npx pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

Runs fine with **zero configuration** — without `DATABASE_URL` characters
simply don't persist, and without a Solana RPC the token features are dormant.

## Configuration & secrets 🔐

All configuration is via **environment variables** — see
[`.env.example`](.env.example) for the full annotated list (database, RPC,
treasury/house wallets, admin list, token mint, …).

**Policy: no real values are ever committed to this repository.**

- `.env` files are gitignored; `.env.example` contains placeholders only.
- Production values live in the Railway/Vercel dashboards, never in code,
  docs, or commit messages.
- `HOUSE_WALLET_SECRET` (the payout signer) is the most sensitive value —
  treat it like a private key, because it is one.
- If a secret ever leaks: rotate it at the provider **first**, then scrub git
  history — deleting the file alone is not enough.

## Deploy

**Client → Vercel:** import the repo; `vercel.json` drives the build and the
`/docs`, `/stats`, `/api/stats` rewrites. Set `VITE_SERVER_URL`
(`wss://<server-host>`) and `VITE_SERVER_HTTP_URL` (`https://<server-host>`).

**Server → Railway:** create a project from the repo; `railway.toml` builds
shared + server and runs `node server/dist/index.js` (health check `/health`).
Set the env vars from `.env.example`. Database schema **auto-migrates on
boot** (idempotent `CREATE TABLE / ADD COLUMN IF NOT EXISTS`).

Both hosts auto-deploy on every push to `main`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Client + server locally |
| `pnpm build:client` | Production client build (Vercel) |
| `pnpm dev:server` | Game server only |
| `pnpm typecheck` | Type-check all packages |

## Project layout

```
client/   Phaser renderer + React UI            →  Vercel
server/   Colyseus zones, economy, APIs         →  Railway
shared/   Maps, protocol types, game constants  →  used by both
docs/     Design docs, changelog, dev notes
assets/   Source art notes
```

## What's in the game (v0.178.x)

- **Everyday loop** — woodcutting, mining, fishing, farming (wheat & carrot),
  cooking, energy/food, quests, day/night & weather.
- **Crafting as a profession** — tool-tier crafting plus six craft families,
  specialization + mastery XP, and Fine/Master quality tiers (real item ids
  with boosted stats) rolled by specialists.
- **Living economy** — NPC shop with supply/demand price pressure, per-town
  demand & **regional prices**, **caravans** that move goods between zones,
  world **economic events** with adaptive policy, P2P gold market ($BASE and
  other currencies), housing + player-run shops (P2P item market), soft
  currencies (honor / guild coin / gems), daily rewards + login streaks.
- **Companies & Stock Exchange** — found a company, issue shares, and trade
  them on an in-game exchange (transfer-only invariants; no gold→$BASE mint).
- **DAO governance** — token-weighted `$BASE` polls at `/dao`.
- **Mail** — player-to-player letters with gold attachments, an outbox with
  delivery/claim receipts, and cross-zone new-mail nudges.
- **PvP endgame** — danger-tier zones, loot drops, crime/bounties/jail, duels,
  guild warfare (ranks/bank/tax/wars), territory control, Castle Siege,
  seasons & ranks, mounts, pets, gear rarity + enhancement.
- **Player Worlds** 🌍 — buy a zone (1M gold), build it with a full in-game
  editor (rivers/bridges, soil farm plots, working crop markets, gatherable
  nodes), sell visitor passes + gather tax, expand the grid by burning $BASE.
- **$BASE utility** — burn sinks (Black Zone, VIP, World & bag expansion),
  Rudi's 1:1 gold desk, casino blackjack. Entry is **not** gated (free to play
  since v0.172.0); see [`docs/base-demand.md`](docs/base-demand.md) for the
  open work on token demand.
- **Seasons** — recurring 30-day competitive seasons scored on normal play,
  paid from a fixed, pre-funded $BASE pool (points never mint tokens). Referral
  points are credited once the invitee actually reaches level 3, so a free
  sign-up can't farm the pool.
- **Telegram Mini App** — the whole game inside Telegram, with walletless
  Telegram login, invite codes carried through `startapp`, share-to-chat, and
  account linking for existing wallet players.
- **Ad marketplace** — brands bid CPM in $BASE; 50% of spend is paid to the
  players viewing; standalone wallet-only **Brand Portal** at `/brands`.
- **Transparency** — public live dashboard at `/stats` (gold flow, burns,
  markets, Worlds economy, ads, **$BASE treasury in-vs-out**) with an 𝕏 share
  card.

Full player documentation lives in the in-game wiki →
[/docs](https://world.metricbase.org/docs). Developer history: `git log` and
`docs/Changelog.md`.
