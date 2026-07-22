# $BASE demand — the problem and a plan

**Status: PROPOSAL. Nothing here is built.** Written 2026-07-22, after the
free-to-play and Telegram-login releases. Needs owner sign-off before any of it
ships, because it changes token economics rather than gameplay.

## The problem, stated honestly

Before v0.172.0, the biggest reason to hold $BASE was structural: **you could
not play without 1,000 of it.** Every new player was a forced buyer, and every
existing player was a forced holder. That single rule did more for demand than
every optional sink combined.

Two changes on 2026-07-22 removed it, deliberately and for good reasons:

- **v0.172.0** made entry free — a growth decision, and the right one. Player
  count is the numerator of everything else.
- **v0.174.0/0.175.0** let players sign in with Telegram and never touch a
  wallet at all. A Telegram player can now play indefinitely, earn Season
  points, and only ever encounter $BASE when they paste an address to *receive*
  it.

So the token went from **required** to **optional**, and a growing share of
players may never hold any. What remains are optional purchases:

| Sink | Type | Problem as a demand driver |
|---|---|---|
| Gold desk (Rudi) | Buy gold with $BASE | Competes with *playing*, which also makes gold |
| VIP pass | Burn | One-off, small |
| Land plots / World slots | Burn | One-off, capped by land supply |
| Black-zone pass | Burn | Niche endgame |
| Ad marketplace | Brands buy $BASE | Real external demand, but tiny today |

Every one of these is a **one-off or optional** spend by an *already-invested*
player. None of them scales with player count the way the gate did.

**The asymmetry that matters:** the Season pool pays out **1,000,000 $BASE** and
is funded from the treasury. Rewards flow *out* to players continuously; nothing
pulls a comparable amount back *in*. That is the actual problem — not "fewer
buyers", but a net outflow with no matching inflow.

## The invariant this must not break

From `docs/company-coin.md` and `shared/src/season.ts`: **points never mint
$BASE, and gold never converts to $BASE.** The prize pool is fixed and
pre-funded; points only decide how it is *divided*.

Any proposal here must keep that. A demand fix that mints tokens, or that lets
in-game gold become $BASE, converts a game-economy problem into a token-supply
problem — strictly worse. **Reject any idea that does either, including ones
below if they drift that way in implementation.**

## Principles

1. **Never re-gate entry.** Growth is the point. Demand must come from players
   who *want* to spend, not players who *must* to play.
2. **Sell time, status and capacity — never power.** Pay-to-win kills the
   player-run economy that makes the game interesting, and would wreck PvP and
   the exchange.
3. **Prefer recurring to one-off.** A subscription-shaped sink scales with
   retained players; a one-time burn does not.
4. **Prefer burns to transfers.** A burn permanently reduces supply. A transfer
   to the treasury only relocates it and invites "the team is selling".
5. **Convert engagement into demand at the moment of desire** — the point where
   a player already wants something badly enough to pay.

## The plan, in priority order

### P1 — Season entry stake (highest leverage, fixes the asymmetry directly)

Competing for the Season prize pool costs a **refundable stake** in $BASE, or a
small non-refundable entry burn. Points still decide the split; the stake only
decides *who is playing for the pool*.

- Directly couples pool outflow to token inflow — the core imbalance.
- Scales with the number of *competitive* players, not total players.
- Free players keep playing and keep earning gold; they simply aren't in the
  prize race. **Casual play stays completely free.**
- Keeps the invariant: no minting, no gold→$BASE.

*Open question for the owner:* refundable stake (softer, more like a deposit) or
a smaller burn (harder deflation, no liability to return)? Refundable is easier
to sell to players; a burn is better for supply.

**Careful:** a stake creates an entry barrier to the *reward* system. If set too
high it recreates the gate we just removed, one layer in. Start low.

### P2 — Cosmetics and identity (safe, recurring, non-power)

The `$BASE lucky-wheel cosmetics` idea already noted in the character-redesign
backlog, plus:

- Character skins, dyes, pets/mounts, name effects, nameplate flair.
- **Guild** cosmetics — crests, hall decoration. Guilds pool money, and social
  spending is far less price-sensitive than individual spending.
- Player-World decoration packs (art already exists for much of this).

Sells status, not power — no economic distortion, no PvP impact. This is the
highest-volume, lowest-risk sink and should ship regardless of what else does.

### P3 — Convenience and capacity (recurring, must stay non-power)

- Extra character slots, bank/bag tabs, more World slots.
- VIP as a **recurring subscription** rather than a one-off pass: modest
  quality-of-life (faster travel, more daily quests, extra market listings).

The line to hold: **more capacity and less friction, never more damage or more
yield.** Yield boosts are power — they distort the economy and the leaderboards.

### P4 — Real external demand (slow, but the only *non-circular* source)

Everything above recycles $BASE between players and treasury. Genuinely new
money comes from outside:

- **Ad marketplace** (already built, `/brands`): brands buy $BASE to bid. Under-
  exploited — needs sales effort, not code.
- **Company/creator tooling** paid in $BASE.
- Sponsored events and tournaments.

Slowest to move, but the only demand that isn't ultimately paid for by players.

### P5 — Telegram-native monetisation (reaches the new audience)

The Telegram cohort may never hold $BASE. Meeting them where they are:

- Telegram Stars → in-game gold or cosmetics, with the treasury buying $BASE on
  the open market with Stars revenue. Converts non-crypto spend into real buy
  pressure without asking the player to touch a wallet.
- **Caution:** this adds a second currency rail and its own accounting. Only
  worth it once Telegram player volume justifies it — check the numbers first.

## What to do first

1. **Instrument before building.** Add a `/stats` panel showing $BASE flows:
   treasury in vs out, burns by source, gold-desk volume, season liability. We
   are currently reasoning about this from intuition — the actual numbers may
   say the outflow is fine for now, or much worse than assumed. **Measure first;
   it is cheap and it decides everything else.**
2. **Ship P2 cosmetics.** Safe, popular, no economic risk, works at any player
   count.
3. **Decide P1 with the owner** once the Season 1 payout has actually happened
   and there is a real number for the outflow.

## What NOT to do

- Re-introduce the entry gate (undoes today's growth work).
- Sell power — yield boosts, damage, XP multipliers.
- Mint $BASE for rewards, or let gold convert to $BASE. **Breaks the hard
  invariant.**
- Add a sink that only rich players can use — the goal is broad demand, not a
  whale tax.
- Build all of this at once. Each item changes economics; ship one, measure,
  then the next.
