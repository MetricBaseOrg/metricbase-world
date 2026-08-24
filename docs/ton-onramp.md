# TON On-Ramp for the Season Vault — Design & Runbook

Status: **DESIGN ONLY — not built.** This is the plan for letting a player fund
their [season deposit vault](base-demand.md) with a TON wallet payment instead
of a Solana `$BASE` transfer. Nothing here ships until the operator funds a TON
treasury wallet, gets a TonCenter/TonAPI key, and decides how treasury-side
conversion works (see "The invariant" below — this is the part that needs
sign-off, not the plumbing).

## Decision (chosen)

- **On-ramp, not a bridge.** No wrapped `$BASE` token is created on TON, no
  liquidity pool exists there, and the token itself never "lives" cross-chain.
  A TON payment is a **purchase of vault credit**, functionally identical to a
  player buying `$BASE` on an exchange and depositing it — just packaged as
  one flow instead of three. See [[base-demand]] and the rejected alternative
  below for why a real bridge was ruled out.
- **Feeds the season vault specifically**, not a new generic balance. The
  vault (`season_vault_deposit` / `season_vault_units`, shipped v0.205.0) is
  the one place `$BASE` already becomes an in-game balance with clear rules
  (multiplier, lockup, withdraw-with-fee). Reusing it means zero new economic
  surface — a TON deposit and a Solana deposit end up as the exact same row
  type, same multiplier math, same withdrawal path. No new sink to reason
  about.
- **Native TON coin only, v1.** Not a jetton (USDT-TON etc.) — fewer moving
  parts, and it's what Telegram Wallet holds by default for a brand-new user,
  which is the actual audience (see "Why" below).

## Why this beats an actual bridge

A real bridge (lock `$BASE` on Solana → mint a wrapped jetton on TON) creates
a **second market** for a token that's already fighting the [[base-demand]]
problem — splitting thin liquidity across two chains makes both easier to
move and doesn't add a single new buyer. It also means running a second
custodial mint authority indefinitely, which is a new, permanent trust
surface, not a feature.

The actual friction — confirmed by a live case (2026-08-05, a Telegram-only
player who couldn't act on a Founder NFT without a Solana wallet) — is
**"I'm inside Telegram, I don't have SOL, I want in."** That's an on-ramp
problem, not a cross-chain-liquidity problem. TonConnect (TON's equivalent of
WalletConnect) already ships inside Telegram's own wallet UI, so the player
never leaves the Mini App.

**Rejected alternative — Telegram Stars.** Telegram's own in-app-purchase
currency needs zero blockchain work (Stars are bought via Telegram's native
billing, no wallet at all) and would be an easier v1 than TON in isolation.
Flagged here as a smaller, faster experiment worth running first or
alongside this — but it's Telegram-only forever (Stars can't be held or spent
outside Telegram), where a TON payment is a real on-chain asset the player
already owns and controls. Worth a separate one-page decision, not blocking
this doc.

## The invariant (the part that needs sign-off)

```
every unit of vault credit sourced via TON == real $BASE the treasury
actually acquired and holds, at the time it was credited
```

This is the one rule that keeps this from being an unbacked-minting path in
disguise. The season vault currently only grows from a **verified on-chain
`$BASE` transfer** — the deposit IS the asset. If a TON payment credited
vault units directly at some quoted exchange rate without the treasury ever
converting that TON into real `$BASE`, the vault would carry credit backed by
a foreign asset instead — and since vault withdrawals pay out (95% of) the
withdrawn amount, a player could effectively cash out `$BASE` that was never
deposited as `$BASE`. That's the same shape of problem
[[stock-exchange]]'s "no gold→$BASE" invariant guards against, just via a
different door.

**So: the treasury must actually own the equivalent `$BASE` before crediting
the vault — not "eventually," at credit time.** Two ways to satisfy that,
ordered by how soon this could ship:

- **A. Manual/batched (v1, ships fastest).** TON payments accumulate in the
  treasury TON wallet. Vault credit is quoted and given at deposit time using
  a live TON/USD and `$BASE`/USD price snapshot (same "quote, then lock it
  for N minutes" pattern as any checkout flow) — but capped by a running
  **backing budget**: the operator manually converts accumulated TON to real
  `$BASE` periodically (any exchange/OTC route, no smart contract needed) and
  tops up the budget by exactly what was acquired. Crediting stops
  (`"TON deposits are temporarily paused — check back soon"`) if a deposit
  would exceed the remaining budget. Slower for the player in theory, invisible
  in practice as long as the operator tops up the budget before it's ever
  actually exhausted.
- **B. Automated (later, once volume justifies it).** A scheduled job
  bridges accumulated TON → Solana (via a generic bridge like Wormhole or
  deBridge — the operator's problem now, not a live player-facing one) and
  swaps to `$BASE` via Jupiter, topping up the same backing budget
  automatically. Same invariant, no manual step. This is the only place an
  actual cross-chain bridge appears in this design, and it's operator-side,
  batched, and never blocks a player's deposit from confirming.

Ship A first. B is a pure ops upgrade with no player-facing or data-model
change — the budget-check code is identical either way.

## Architecture

### Flow (mirrors `handleSeasonStake`'s verify-then-credit shape exactly)

1. **Quote.** Player asks to deposit `X` TON. Server reads current TON/USD +
   `$BASE`/USD prices, computes the `$BASE`-equivalent vault credit, checks it
   against the remaining backing budget, and returns a quote with a short
   expiry (e.g. 3 minutes) and a unique `depositId`.
2. **Pay.** Client opens TonConnect, sends `X` TON to the treasury TON
   address with a **comment/memo containing `depositId`** (TON transfers
   natively support a text comment — this is the correlation key, since TON
   has no equivalent of "the signature IS the payment reference" the way
   Solana does here).
3. **Verify.** Server polls TON RPC (TonCenter or TonAPI) for the treasury
   address's incoming transactions, finds one matching `depositId` in the
   comment with `amount >= X`, and confirms it (a few confirmations deep —
   TON finality is fast, but not instant).
4. **Credit.** Recompute the `$BASE`-equivalent from the ORIGINAL quoted rate
   (never re-price after the fact — the player paid against the quote they
   saw), debit it from the backing budget, and write a
   `season_vault_deposit` row exactly like a Solana deposit — same table, same
   `loadVault`/`syncVaultCache` calls, `signature` column holds the TON tx
   hash instead of a Solana signature (already `VARCHAR(128)`, plenty of
   room). From here the vault has no idea the deposit came from TON — the
   multiplier math, lockup, and withdrawal path are 100% unchanged.

### Data model (append to schema.sql)

```sql
-- One row per TON deposit attempt. Mirrors the quote→pay→verify shape;
-- season_vault_deposit gets the row ONLY after this confirms (step 4 above),
-- keeping it agnostic to payment rail.
CREATE TABLE IF NOT EXISTS ton_deposit_quote (
  id            VARCHAR(32) PRIMARY KEY,          -- depositId, also the memo
  player_name   VARCHAR(16) NOT NULL,
  wallet        VARCHAR(44) NOT NULL,              -- Solana wallet (vault owner)
  ton_amount    NUMERIC(20,9) NOT NULL,
  base_quoted   BIGINT NOT NULL,                   -- $BASE-equivalent at quote time
  rate_ton_usd  NUMERIC(20,9) NOT NULL,
  rate_base_usd NUMERIC(20,9) NOT NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'quoted', -- quoted|paid|credited|expired
  ton_tx_hash   VARCHAR(96),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ton_deposit_quote_tx_idx ON ton_deposit_quote (ton_tx_hash);

-- The backing budget from "The invariant" above. Single row, updated by the
-- operator's manual (or later, automated) TON->$BASE conversion.
CREATE TABLE IF NOT EXISTS ton_backing_budget (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  base_available BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Server modules (new)

- `server/src/ton/tonClient.ts`: thin wrapper over TonCenter/TonAPI —
  `getIncomingTransfers(address, sinceLt)`, parsing the comment field.
  Mirrors `verifyPeerTokenTransfer.ts`'s shape (`{ok, error, retryable}`) so
  callers don't need to know it's a different chain.
- `server/src/ton/priceOracle.ts`: TON/USD + `$BASE`/USD lookup (reuse
  whatever price source `$BASE`/USD already comes from for `/api/stats`, plus
  a TON/USD source — CoinGecko or similar; cache for ~60s so a quote doesn't
  hammer a rate-limited API).
- `server/src/db/tonDeposits.ts`: `createQuote`, `confirmPaid`, `creditQuote`
  (the step-4 write into `season_vault_deposit` + budget debit, one
  transaction — same crash-safety shape as `recordVaultDeposit`).
- `server/src/rooms/ZoneRoom.ts`: `seasonStakeTonQuote` /
  `seasonStakeTonConfirm` handlers, parallel to the existing
  `handleSeasonStake` Solana path. Both end at the same
  `season_vault_deposit` write.
- Client: TonConnect button in the vault deposit panel, shown only inside the
  Telegram Mini App context (`isTelegramMiniApp()` — a desktop wallet player
  already has the Solana path and doesn't need this). Quote countdown timer,
  same UX shape as any "price locked for N minutes" checkout.

## Operator setup (what only you provide)

1. **TON treasury wallet.** Any TonConnect-compatible wallet (Tonkeeper etc.)
   — this only needs to receive and periodically sweep, not sign
   automatically, for phase A.
2. **TonCenter or TonAPI key.** Free tier is rate-limited; get a paid key
   before this sees real traffic — a rate-limit failure during verification
   must be `retryable`, never `failed` (same lesson as
   `verifyPeerTokenTransfer`'s "not found yet ≠ invalid").
3. **Backing budget top-ups.** After each manual TON→`$BASE` conversion,
   update `ton_backing_budget.base_available` by exactly what was acquired.
   This is a manual operator action in phase A — no code path does it for
   you, deliberately, so the number is never wrong by more than the delay
   between "TON arrived" and "you sold it."
4. **Feature flag.** `TON_ONRAMP_ENABLED=true`, off by default. With no flag
   or no treasury address configured, the option simply doesn't render in the
   Mini App — same inert-by-default pattern as every other gated feature here.

## Anti-abuse / safety

- **Budget-capped, always.** A deposit that would exceed
  `ton_backing_budget.base_available` is refused BEFORE payment is requested
  — never quote credit the treasury doesn't yet back.
- **Quote expiry.** A stale quote (price moved) is refused at credit time,
  not silently honored — the player re-quotes.
- **One TX, one credit.** Unique index on `ton_tx_hash`; a resend of the same
  transfer (or a replayed webhook, if TonCenter ever pushes one) can't
  double-credit, same guarantee as the Solana signature uniqueness.
- **Wallet still required.** The vault is keyed by the player's Solana wallet
  (`season_vault_deposit.wallet`) — a TON payment funds THAT wallet's vault,
  it doesn't create a new identity or bypass [[wallet-identity-migration]].
  A Telegram-only (`tg:`) player still needs a linked Solana wallet first,
  same requirement `handleSeasonStake` already enforces — this only changes
  what asset funds the deposit, not who's allowed to make one.

## Build plan (when you say go)

- **A.** `tonClient.ts` + `priceOracle.ts` + quote/confirm DB tables + flag.
  (Testnet: prove a TonCenter-verified deposit reaches `quoted → paid`.)
- **B.** Credit path into `season_vault_deposit` + backing-budget debit +
  manual top-up runbook for the operator.
- **C.** Client: TonConnect button + quote countdown in the vault panel,
  Telegram-context-gated.
- **D.** (Later) Automate treasury-side TON→`$BASE` conversion (Build plan
  option B under "The invariant") once manual top-ups become a bottleneck.
- Each phase is independently shippable and testnet-verified before the
  next, same cadence as [[stock-exchange]]'s phased rollout.
