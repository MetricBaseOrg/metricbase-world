# District Deeds — design notes

A property board game at `/board`, shipped in v0.206.0. Players buy in with
in-game gold, `$BASE` or SOL, everyone starts the board with the same play
money, and the last player standing takes the pot.

This document records the decisions that are load-bearing — the ones where the
obvious implementation is wrong, and where a future change could quietly break
something expensive.

## The seal

`shared/src/board.ts` describes a **closed abstract economy**. Board cash is
`⌬`, a unit with no conversion rate to anything. No square, card, deed, or
outcome may reference an item id, gold, gems, XP, a skill, or a zone.

The only real value that touches this game is the **entry stake (in)** and the
**prize (out)**, both handled exclusively in `server/src/board/bank.ts`.

`scratchpad/board-sim.mjs` asserts the seal mechanically: `board.ts` imports
nothing from `items.js` / `economy.js` / `progression.js` / `zones.js`, every
card effect is a member of the closed `BoardCardEffect` union, and no card text
mentions gold, items or XP.

## One currency per table

A table's stake currency is fixed at creation and **never mixed**. A gold table
pays gold; a `$BASE` table pays `$BASE`.

This is not a UI simplification. If gold and `$BASE` shared a pot, a player who
staked gold could win `$BASE` — a gold → `$BASE` conversion, which
`docs/company-coin.md` forbids outright ("THE HARD INVARIANT"), because it turns
the whole game into an infinite-money real-cash faucet.

## AI opponents are gold-only

An AI is house-controlled. A house-controlled opponent taking a player's `$BASE`
makes the house the counterparty, which is a different product with different
obligations. Practice opponents therefore sit only at gold tables.

Enforced in three places, deliberately: the lobby validates it, `startTable()`
throws before any stake is escrowed, and `board_tables` carries
`CHECK (ai_count = 0 OR currency_id = 'gold')` — the one that survives a code
bug.

Two consequences that follow from the same principle:

- **If an AI wins, every human is refunded** rather than the house pocketing the
  pot (`finishTable`). This path cannot occur at a stake table, which is
  all-human by construction.
- **No rake on a practice table.** With one human the pot IS that player's own
  stake, so raking it would mean the best possible outcome of a practice game is
  losing 5%. The rake applies only when two or more humans paid in.

## Money discipline

Copied from `server/src/db/seasonVault.ts`, **not** from the older
deposit-then-refund-on-failure shape, which can pay twice when a send fails
ambiguously.

```
in    : verify on-chain → append a ledger row keyed on the signature
stake : debit conditionally on the derived balance, in ONE statement
out   : reserve a pending negative row → send → stamp settled
        mark failed ONLY when the transfer definitively did not happen
```

- **Balance is derived**, never stored: `SUM(delta) WHERE status <> 'failed'`
  over `board_ledger`. A pending cash-out is a negative row, so it reduces the
  balance the moment it is reserved and a second request cannot be sized against
  the same money.
- **A pot never pays out on-chain directly.** Settlement credits the winner's
  board bank and stops; cashing out is a separate, explicit action. A settlement
  therefore cannot half-fail with money in flight, and there is one outbound
  code path to get right instead of two.
- **Gold never touches `pending_gold` directly.** Cash-out goes through
  `ZoneRoom.creditPlayerGlobal`, which pays an online session by pid and falls
  back to `pending_gold` when offline. That table has an in-memory mirror in
  `zones/assetMarket.ts` loaded at boot, so a direct write would be clobbered.
  It is also `INTEGER`, hence `BOARD_GOLD_POT_CAP`.
- **Gold funding is ZoneRoom-authoritative.** `ZoneRoom` owns live gold in
  memory, so a `/board` page debiting `characters.gold` would be overwritten on
  the next persist. `handleBoardBankFund` flushes memory to the row, does the
  ledger insert and the conditional debit in one transaction, then applies the
  same decrement to memory.

## Surviving a restart

Railway restarts on every `GAME_VERSION` bump and a table runs the best part of
an hour, so this is the load-bearing piece of the whole feature.

> `seat.disconnectedAt` lives ONLY in the process's memory. It is never written
> to Postgres and never read back. `board_seats.connected` persists, but it is
> presentation only. A forfeit clock can therefore only ever be started by a
> live process that watched a live player go quiet — never by a process that
> merely found an old row on boot.

Two independent guards: that rule, and `resumeGraceUntil`, which short-circuits
the sweep for ten minutes after a restart. Every unfinished table is hydrated by
`initBoardRegistry()`; a `boot_id` that isn't ours means the table was
interrupted, and everyone at it gets a fresh grace window.

State, `version` and `roll_nonce` are written in **one** statement. If the nonce
could lag the state, a crash between them would let the same nonce produce a
second, different roll and the published fairness log would no longer match the
board.

Verified by `scratchpad/board-restart.mjs`, which `SIGKILL`s the process
mid-game — not `SIGTERM`, because the failure mode being guarded against is the
process *not* getting to say goodbye.

## Provably-fair dice

Commit-reveal, because crypto-strength randomness is not the same as
*verifiable* randomness: a player who loses a stake has no way to check a
server-side `randomInt()`.

1. **Commit** — a 32-byte server seed per table; `sha256` published before play.
   The seed itself is withheld until the table ends (serving it to a seated
   player would let them compute every remaining roll).
2. **Client seeds** — each seat contributes one, published to all. The server
   committed first, so it cannot grind its seed against them.
3. **Roll** — `HMAC_SHA256(serverSeed, "<table>:<combined>:<nonce>")`, mapped to
   dice by **rejection sampling** (bytes ≥ 252 discarded). `byte % 6` is biased
   — 256 = 6×42 + 4, so faces 1 and 2 would come up 43/256 against 42/256 — and
   that is exactly the detail someone auditing a real-stake game will find.
4. **Reveal** — seed and full roll log published; `FairnessPanel` recomputes
   every roll in the browser with WebCrypto and the same shared mapping.

`shared/src/boardFairness.ts` is the single definition of the mapping so the two
implementations cannot drift.

## The turn cap

A property game is **not guaranteed to terminate**. If no monopoly forms, rents
stay below the salary and every seat just gets richer forever. The simulation
found exactly that: 363 of 500 AI games ran past 90,000 turns with zero
monopolies and six-figure cash piles.

A table holding real stakes cannot run unbounded — the 5-minute forfeit, the
10-minute restart grace and the deploy cadence all assume a game that ends. So
after `BOARD_MAX_TURNS_PER_SEAT` (70) turns per seat, the table settles on net
worth. Last-player-standing is still the normal ending; this is a backstop, and
it is stated in `BOARD_ENTRY_TERMS`.

**Settlement uses `settlementWorth`, not `netWorth`.** Liquidation values a deed
at half price, so ranking on it would mean every purchase instantly halves your
score and the winning strategy is to buy nothing. Valuing deeds at face and
improvements at cost makes buying neutral, leaving rent income — actually
playing well — as the decider.

At the shipped tuning, most four-seat games reach the cap rather than a
knockout. That is the honest consequence of asking for 60–90 minutes *and* a
bankruptcy ending: real games that end by bankruptcy run two to four hours.

## Collusion

Winner-takes-all with real stakes means two players who agree offline can hand
one of them the game. Ranked by how much they actually help:

1. **Stake tables are capped at two seats** (`BOARD_SEAT_LIMITS`). At two seats
   the attack does not exist. This is the real control; everything below is
   mitigation.
2. **No gifting.** Every trade must give each side between 0.5× and 2× the
   other's value, and at least one deed must move.
3. **A cumulative net-flow cap per ordered pair** — the band alone is defeatable
   by iteration (three trades at 0.5× move ~8× the value of one).
4. **Auctions on** — declining to buy sends the deed to auction, which is both
   the anti-stall mechanic and price discovery that makes soft play cost value.
5. **Seat-linkage checks** at join for stake tables: a second seat sharing an
   IP hash (HMAC'd, never the raw IP) is refused.
6. **Risk scoring and a payout hold** — a finished stake table scoring above
   `BOARD_REVIEW_THRESHOLD` holds at `review` instead of paying.

**Residual risk, stated plainly:** none of this stops two people on separate
networks with unrelated wallets from soft-playing — declining deeds the partner
wants, bidding zero, always taking the band-edge trade. The band and flow cap
turn "guaranteed dump" into a slow, fully-logged, roughly-25%-of-starting-bank
edge. The real controls are procedural: small stakes at launch, a low cap on
concurrent stake tables, mandatory review above the threshold, and the stated
right to void a flagged table and refund every stake.

## Operations

- **`BOARD_MONEY_ENABLED=1`** is the kill switch, ANDed with a configured house
  signer. Read per request, never memoised. It gates **creation and joining
  only** — a running table always plays out and always pays out, because
  flipping the switch during an incident and stranding live pots is a worse
  incident.
- **`BOARD_SOL_ENABLED=0`** disables SOL tables without touching `$BASE`. SOL
  had never run in production before this release.
- **Mission Center → 🎲 Tables** lists tables in flight, cash-outs stuck
  pending, and offers pause / resume / void. The banner is the pre-deploy check.
- **A pending cash-out is never auto-resolved.** An ambiguous send stays pending
  on purpose; releasing it is how you pay twice.

## Verification

| Script | What it proves |
|---|---|
| `scratchpad/board-sim.mjs` | 500 headless games: termination, length, seat fairness, dice uniformity (chi-square), seed re-derivation, the seal, trade bands |
| `scratchpad/board-restart.mjs` | `SIGKILL` mid-game: state/nonce round-trip, boot-id rotation, restart amnesty, **nobody forfeited** — and that a genuinely silent seat still does |
| `scratchpad/board-e2e.mjs` | Full games through the real API: pot, rake, prize, gold sink, reveal, cash-out, replay protection, lobby guards |

Money-path schema changes are dry-run on a disposable Neon branch forked from
prod before they are committed — `schema.sql` executes whole on every boot, so a
DDL typo is a total outage.

`BOARD_TEST_FAST_CLOCKS=1` shrinks the grace windows and the AI's think-time to
make the forfeit and full-game paths testable. It is honoured only when
`NODE_ENV` is `development` or `test`, the same gating as `TOKEN_GATE_DISABLED`,
and `NODE_ENV` is not set on Railway.

## Deliberate omissions

- **The AI never proposes a trade it wouldn't accept**, and only ever asks for a
  deed that completes a group it already almost owns. A naive proposer is an
  exploit surface a human can farm.
- **No lending, no derivatives, no third currency, no cross-table markets.**
- **No board outcome grants anything in the world.** See the seal.
