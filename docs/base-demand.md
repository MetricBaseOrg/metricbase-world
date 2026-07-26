# $BASE demand — the problem and a plan

**Status: P1 SHIPPED (v0.188.0, 2026-07-26). P2–P5 still proposals.** Written
2026-07-22, after the free-to-play and Telegram-login releases. The rest of this
document needs owner sign-off before it ships, because it changes token
economics rather than gameplay.

## P1 as built — season entry stake (v0.188.0)

Owner decisions, 2026-07-26:

| Decision | Chosen | Note |
|---|---|---|
| Stake type | **Refundable deposit** | Not a burn. Returned in full at payout, win or lose. |
| Effective from | **Season 2** (starts 2026-08-20) | Season 1 pays out under the rules its players competed under. |
| Per-player share cap | **None** | Pro-rata by points, uncapped. |
| Amount | **10,000 $BASE** | Anchored to the cheapest existing sink (VIP pass burn, first bag expansion). |

Mechanics: `seasonStakeAmount()` / `seasonRequiresStake()` in
`shared/src/season.ts`; `season_stake` table + `server/src/db/seasonStake.ts`;
the `seasonStake` room message verifies a **transfer to the treasury** (not a
burn — the money has to come back) and dedupes by signature; `SeasonStakeCard`
carries the same paid-but-unclaimed localStorage recovery as the gold desk.

The payout (`server/src/season/payout.ts`) now splits the pool **pro-rata over
entrants' points only**, and returns every unrefunded deposit before paying any
prize. Solvency checks `prizes + deposits`, not just prizes.

## Reward gate — connect X to be paid (v0.189.0, 2026-07-26)

Owner decision: **season rewards require a connected X account**, applied to
Season 1. `SEASON_REWARD_REQUIRES_X` in `shared/src/season.ts`; enforced in
`loadSeasonPayoutTargets` + `distributeSeasonRewards`; surfaced in-game by
`client/src/ui/SeasonRewardGate.tsx`.

This gates money that is ALREADY OWED, so three properties are load-bearing —
do not remove them without deciding to:

1. **Fails OPEN.** The gate only applies when `isXLinkConfigured()` is true
   (`X_CLIENT_ID` + `X_REDIRECT_URI` set). If the OAuth app is unconfigured the
   requirement is skipped entirely, because enforcing it against a server that
   physically cannot link X would disqualify every player and strand the pool.
   ⚠️ **The corollary: with those env vars unset, this feature silently does
   nothing.** Check `xRequired` in the payout dry-run before believing it works.
2. **It's a DELAY, not a forfeiture.** The pro-rata divisor still includes
   players held back for a missing link, so their share is computed and simply
   not sent — nobody else's share grows because someone hadn't tapped Connect.
   They link, you re-run the payout, they get the identical amount (the
   per-(season, player) claim row makes the re-run safe).
3. **A verified public post IS required** (owner decision, v0.189.1 —
   `SEASON_REWARD_REQUIRES_POST`). Two steps: connect X, then publish the
   supplied copy and paste the link back. Verified free through X's public
   oEmbed — authored by the linked handle, carrying the player's HMAC code and
   `SEASON_POST_REQUIRED_TAG` — reusing `server/src/auth/xVerify.ts`, no paid API.

   **The post copy is not free-form on purpose.** The post is compensated (it is
   a condition of receiving $BASE), which makes it an endorsement that ought to
   be identifiable as one. `seasonPostText()` therefore says plainly that the
   player is collecting a Season reward, and the required tag must appear. If
   someone later "cleans up" that copy into a generic brag post, the disclosure
   goes with it — that wording is load-bearing, not branding.

   Residual risk to keep an eye on: mass identical incentivised posts are the
   shape platforms police as coordinated inauthentic behaviour. The copy is
   per-player only in its code, so if volume ever grows past a handful, vary the
   template rather than shipping hundreds of identical posts.

The dry-run report carries `xRequired`, `missingX`, `missingXNames` and
`totalHeldForX` so you can see who is holding up how much before sending.

**Tension worth remembering:** this is a retroactive rule change to Season 1,
which is the same class of change the stake decision deliberately avoided
("Season 1 pays out under the rules its players actually competed under"). The
difference argued for it: linking X is free and takes one tap, where the stake
costs 10,000 $BASE. The in-game card exists so the requirement is visible for
the ~24 days before payout rather than discovered by not being paid.

**Consequences to watch:**
- The stake is a **liability**, not revenue. Treasury must hold enough to cover
  refunds *and* the pool at payout time, or the run refuses to execute.
- **Telegram-only players cannot enter** — they have no wallet to send from.
  They keep earning points and leaderboard rank; they just aren't in the split.
  If the Telegram cohort grows, this becomes a fairness problem worth revisiting.
- If **nobody enters**, the pool goes undistributed. Payout is admin-triggered
  and dry-run by default, so this fails safe rather than paying out to nobody.
- Season 1 is untouched: `seasonStakeAmount(1) === 0`, so the whole mechanism is
  inert until 2026-08-20.

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

### P1 — Season entry stake ✅ SHIPPED v0.188.0 (see the section at the top)

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

### P2 — SHIPPED as Magic Chests (v0.191.0, re-specced v0.192.0)

`shared/src/chests.ts` is the tunables table. Four tiers (1k/3k/10k/25k $BASE)
rolling gold, gear, materials, season points and — once their art lands —
cosmetic skins.

**The v0.192.0 re-spec reversed three of the original rules, on the owner's
instruction.** Recorded here with the trade each one makes, so the reasoning
survives:

| Rule | v0.191 | v0.192 (current) |
|---|---|---|
| $BASE destination | Burned | **Paid to treasury**, to fund the season pool |
| Gold vs Rudi's desk | ~55% of price | **~115-117% of price** — better than the desk |
| Gear in chests | Excluded | **Included**, gated behind much rarer odds |

- **Chest revenue funds the season pool.** This is the first real recurring
  inflow the pool has ever had — the entire problem this document opens with.
  It lands in `token_purchases`, so /stats → Treasury flow now shows chest
  income against pool outflow. Burning removed supply but funded nothing.
- **Chests are now the best gold rate in the game** (~115% of price vs the
  desk's 100%), measured by Monte-Carlo over the real roller. Two consequences,
  accepted knowingly: Rudi's gold desk is now the worse option and will
  effectively retire, and **chests become the largest gold faucet in a game with
  only ~114k gold circulating**. Chest gold is minted, so `gold.minted` and the
  mint-pressure gauge are the things to watch — a few large buyers move the
  whole money supply. It is NOT a $BASE printer: gold only returns to $BASE via
  the peer-to-peer market where another player supplies it.
- **Gear is in.** This sells power, which this document previously called
  non-negotiable; rarity is now the only thing holding that line. Legendary
  dropped from 4% → 1% per roll on mythic, so gear averages 0.07-0.49 items per
  chest depending on tier. If a top-tier weapon becomes routinely buyable, PvP
  balance and the crafting economy break before anything else — compare
  `chest.opened.*` against crafting mastery before loosening odds again.
- **Season points are purchasable through chests.** Points decide how the fixed
  pool is split, so leaderboard rank is now partly payable. Booked under their
  own `chest` season category so bought points stay separable from earned ones;
  **check that split before Season 2 pays out.**
- Odds are shown in the UI before the buy button. Hidden odds on paid boxes are
  indefensible and illegal in several markets — do not move them behind a link.

Skins: `COSMETIC_SKINS` is empty and the roller SKIPS any skin whose art hasn't
shipped, so nobody can win an invisible cosmetic. Ownership persists in
`player_skins` already, so landing art + an equip/render path is what remains.

### P2 (original note) — Cosmetics and identity (safe, recurring, non-power)

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

## MEASURED 2026-07-22 — worse than this document originally assumed

The instrumentation shipped in v0.177.0 (`/stats` → $BASE Token → Treasury
flow, from `getBaseFlows()`). Production figures on the day it landed:

| Metric | Value |
|---|---|
| $BASE ever received by the treasury | 1,220,000 |
| …of which a single `pip_gold_recovery` transaction | 1,000,000 |
| …remaining, across 4 `bag_expand` purchases | 220,000 |
| **Distinct wallets that have ever paid in** | **2** |
| Days since the last purchase | 16 |
| Burned via in-game sinks (all time) | 240,000 |
| **Season 1 pool owed** | **1,000,000** |

Three of the four real purchases came from one wallet, so genuine third-party
demand is on the order of **10,000 $BASE, ever**.

This document originally said the pool "pays out with no comparable inflow".
That was too gentle. The accurate statement is that **there is essentially no
recurring inflow at all** — it stopped on 2026-07-04, *before* free-to-play, so
that change did not cause this. It removed the mechanism that was masking it.

Consequences for the plan above:
- **P1 (season entry stake) is no longer "consider it".** It is the decision to
  make before Season 1 pays out.
- **P2 cosmetics remain worth shipping** but will not close a 1,000,000 gap at
  this player count. Do not treat them as the answer.
- **New question, not in the original plan: is the Season 1 pool the right
  size?** It is pre-funded so it is not a solvency risk, but it is a large
  one-directional transfer that repeats every 30 days unless the DAO sets
  otherwise. Season 2's pool should be sized against measured inflow.

**Watch `distinctBuyers`, not the total.** A large number from one wallet is not
demand — which is why the /stats card reports buyer concentration in words.

## What to do first

1. ~~Instrument before building.~~ **Done, v0.177.0.** Re-read the panel before
   each decision below rather than trusting the snapshot above.
2. ~~Decide P1 with the owner.~~ **Done + shipped, v0.188.0** — refundable
   deposit, Season 2 onward, no cap. Decided before the Season 1 payout rather
   than after, so Season 2 starts with the mechanism already live.
3. **Ship P2 cosmetics.** Safe, popular, no economic risk, works at any player
   count. Now the top unstarted item.
4. **Re-measure after Season 2 opens.** The number that matters is how many of
   the ~12 point-scoring players actually stake — that is the first real signal
   of willingness to pay since 2026-07-04.

## What NOT to do

- Re-introduce the entry gate (undoes today's growth work).
- Sell power — yield boosts, damage, XP multipliers.
- Mint $BASE for rewards, or let gold convert to $BASE. **Breaks the hard
  invariant.**
- Add a sink that only rich players can use — the goal is broad demand, not a
  whale tax.
- Build all of this at once. Each item changes economics; ship one, measure,
  then the next.
