# Company Coins — $BASE-Paired Safe Launch (Design & Runbook)

Status: **DESIGN ONLY — not built.** Plan for letting a company do a real,
non-fraudulent token launch: deploy a fixed-supply SPL token, seed a `$BASE`
liquidity pool, and immediately **lock the liquidity + revoke mint authority** so
the founder cannot rug. Ships nothing; devnet-first, mainnet gated on legal
review. See also `docs/token-bridge.md` (the in-game share ↔ token bridge, a
different feature) and `docs/exchange.md`.

## The one rule that makes this safe: a Company Coin is NOT company shares

- **In-game shares** (the Stock Exchange) = real ownership: dividends, votes,
  CEO/control, priced by the in-game market. Closed economy, no real-money out.
- **A Company Coin** = a separate, speculative **community/branding token** that
  trades against `$BASE` on a DEX. It carries **no ownership, no dividends, no
  votes, no claim on the treasury.** No in-game value ever flows into it.

Keeping them separate is what preserves "no infinite money": minted-gold profit
never becomes `$BASE`. The coin's value is purely speculative/social — and that
**must be disclosed prominently** so players don't mistake it for equity.
Mislabeling it as ownership would be deceptive; the trade page shows a clear
"Community token — not shares, no dividends or voting" banner.

## Recommended stack

- **DEX: Raydium CPMM (CP-Swap).** Constant-product pool, no OpenBook market
  required (unlike legacy AMMv4), has a maintained SDK (`@raydium-io/raydium-sdk-v2`),
  supports permanent LP lock via burn. Alternative: **Meteora DAMM v2 / DLMM**
  (also SDK-driven, native permanent-lock). Pick one and standardize.
- **Token: fixed-supply standard SPL** (simplest, max wallet/DEX compatibility).
  `$BASE` is Token-2022, so the pool is a mixed SPL / Token-2022 pair — CPMM
  supports this, but **validate on devnet** (some Token-2022 extensions are
  restricted).
- **Signing:** the existing treasury keypair (`HOUSE_WALLET_SECRET` /
  `MINT_AUTHORITY_SECRET`), same pattern as `server/src/solana/housePayout.ts`.

## Safe-launch flow (the anti-rug guarantees are steps 4–7)

Triggered by the company owner via `companyCoinLaunch`, gated by a flag + keypair
+ fee. The founder must fund the `$BASE` liquidity and the SOL for fees.

1. **Collect inputs.** Owner picks supply, `$BASE` liquidity amount, and founder
   allocation %. They send the `$BASE` liquidity to a launch wallet (verified with
   `verifyPeerTokenTransfer`, like the housing `$BASE` buy) and pay the launch fee
   (gold sink + covers SOL).
2. **Create the mint** (standard SPL, e.g. 1,000,000,000 supply, 6 decimals),
   mint the full supply to the launch wallet.
3. **Split supply:** LP allocation (for the pool) + founder allocation (vested) +
   optional community/airdrop bucket. Fixed forever.
4. **Revoke mint authority → null.** No more tokens can ever be minted → no
   mint-and-dump.
5. **Create the Raydium CPMM pool** COMPANY/`$BASE`, seeded with the LP allocation
   + the founder's `$BASE`. Market sets the price from here.
6. **Burn the LP tokens** (send the LP position to the incinerator). Liquidity is
   permanently locked → the founder **cannot pull** buyers' `$BASE`. (Alternative:
   a time-locked LP locker if you want the founder to reclaim fees — but burn is
   the strongest, simplest guarantee.)
7. **Vest the founder allocation** in a time-locked account (e.g. Streamflow, or a
   simple time-lock PDA) → no instant insider dump.
8. **Record + disclose:** persist the mint + pool addresses; the company trade
   page shows the coin, its pool link, a "safe launch: LP burned, mint revoked,
   founder vested" badge, and the "not shares" disclosure.

Post-launch the token is **immutable** (mint revoked) with **permanently locked
liquidity** (LP burned) — so even though the server orchestrated the launch,
nobody, including the operator, can rug it. That is the whole point.

## Where the money comes from

- **`$BASE` liquidity + SOL fees: the founder.** The operator orchestrates but
  does not fund launches. Sizing is the founder's call (bigger `$BASE` seed =
  deeper, less volatile market).
- **Launch fee:** gold (sink) and/or `$BASE`, covering the SOL cost + margin.
- **Rough SOL cost:** ~0.002 SOL (mint) + ~0.15 SOL (CPMM pool) + fees, per
  launch.

## Data model (append to schema.sql)

```sql
CREATE TABLE IF NOT EXISTS company_coins (
  company_id     VARCHAR(64) PRIMARY KEY,
  mint_address   VARCHAR(44) NOT NULL,
  pool_address   VARCHAR(44) NOT NULL,
  dex            VARCHAR(16) NOT NULL,          -- raydium-cpmm|meteora
  network        VARCHAR(12) NOT NULL,          -- devnet|mainnet
  supply         BIGINT NOT NULL,
  lp_burned      BOOLEAN NOT NULL DEFAULT false,
  mint_revoked   BOOLEAN NOT NULL DEFAULT false,
  founder_vested BOOLEAN NOT NULL DEFAULT false,
  launched_at    BIGINT NOT NULL
);
```

## Server modules (new / touched)

- `server/src/solana/coinLaunch.ts` (new): `createMint`, `mintSupply`,
  `revokeMintAuthority`, `createCpmmPool`, `burnLp`, `vestFounder` — each a
  signed+confirmed tx via the treasury keypair, mirroring `housePayout.ts`.
  Wrapped in a single orchestration with **idempotent step tracking** (a
  `coin_launch_pending` row per step) so a crash never leaves a half-launched,
  rug-able token — if any guardrail step (revoke/burn/vest) fails, the launch is
  flagged unsafe and not surfaced to players.
- `server/src/db/companyCoins.ts` (new): persist/load `company_coins` + launch
  progress.
- `server/src/rooms/ZoneRoom.ts`: `companyCoinLaunch` handler (verify the `$BASE`
  liquidity transfer, charge the fee, run the orchestration).
- Client: a "Community Coin" section on the company trade page — launch form for
  the owner (supply, `$BASE` seed, founder %), and for everyone a price/pool link,
  the safe-launch badge, and the "not shares" disclosure. Trading happens on the
  DEX (or via an embedded Raydium/Jupiter swap link) — the game does not custody
  swaps.

## Feasibility limits (be clear-eyed)

- Programmatic pool creation is **DEX-SDK-specific and complex**; it is **not**
  currently in the repo (`@raydium-io/raydium-sdk-v2` would be a new dependency).
- I **cannot build or test this from here** — no keypair, no funds, no ability to
  broadcast. Pool creation genuinely needs **iterative devnet work** with a funded
  wallet. Ships **devnet-first, disabled by default** (flag + keypair), mainnet
  only after **legal review** (launching tradeable tokens at scale is real
  securities exposure even in the safe configuration).
- Mixed SPL / Token-2022 (`$BASE`) pairing must be validated on devnet before
  mainnet.

## Devnet runbook

```bash
solana-keygen new -o launch-authority.json
solana config set --url https://api.devnet.solana.com
solana airdrop 2 $(solana address -k launch-authority.json)
# Need devnet $BASE (or a stand-in Token-2022 mint) to pair against; mint some to
# the launch wallet for testing.
# Server env: MINT_AUTHORITY_SECRET=<launch-authority.json bytes>,
#             SOLANA_RPC_URL=https://api.devnet.solana.com,
#             COMPANY_COIN_ENABLED=true
```

Verify on devnet: launch a coin → confirm on Explorer that (a) mint authority is
null, (b) the LP tokens were burned (supply of the LP mint dropped to ~0 / sent
to incinerator), (c) founder tokens sit in a time-lock, (d) a swap `$BASE`→coin
works in the pool. Kill the server mid-launch → confirm the step tracker refuses
to surface an unsafe/half-launched coin. Then promote to mainnet behind the flag
after legal sign-off.

## Anti-abuse / integrity

- Guardrails are enforced **atomically before the coin is shown**: a coin only
  appears to players once mint-revoked + LP-burned + founder-vested are all
  confirmed on-chain. A launch that can't complete those is discarded, not shown.
- One coin per company; owner-only; fee-gated; rate-limited.
- **Clear "not shares" disclosure** on every surface — the coin is a community
  token, distinct from the real in-game shares/dividends. No in-game value flows
  in or out of it.
- Founder allocation cap + mandatory vesting to blunt insider dumps even with
  locked liquidity.

## Coin → Shares convertibility (one-way on-ramp)

Players can convert a Company Coin into that company's in-game shares. This is
**safe** and reuses existing primitives, because it is entirely a "value in" flow:

1. **Coin → `$BASE`** — swap on the coin's DEX pool (market price; pre-existing
   `$BASE` from the pool).
2. **`$BASE` → gold** — Pip's gold desk, **1:1, one-directional** (`handleBuyGoldFromPip`,
   ZoneRoom.ts:3634 — `$BASE` is captured by the treasury, gold is credited).
3. **gold → shares** — a normal exchange buy at the in-game share price
   (bonding curve / order book).

No minted gold is ever turned back into `$BASE`, so this creates no faucet — the
player spends the coin's real `$BASE` value to acquire shares. Implementation is a
**UX/quote layer** ("Convert to shares" shows `X coin ≈ Y $BASE ≈ Z shares` and
guides the swap → Pip → buy); the server never custodies player coins or executes
swaps on their behalf.

### THE HARD INVARIANT (do not break)

**Never add a gold → `$BASE` (or shares → `$BASE`-by-minting) cash-out at a fixed
peg.** Pip's desk is `$BASE` → gold only. If minted gold could be converted back
to `$BASE`, the whole game becomes an infinite-money real-cash faucet (gather →
gold → `$BASE` → sell). All `$BASE`-**out** must stay peer-to-peer transfers of
pre-existing `$BASE` (housing resale, the `$BASE` share market), never a minted
payout. With this invariant held, coin↔shares convertibility can only shuffle
`$BASE` between players — it can never drain value.

### Note

Convertibility re-links the coin to equity (shares pay dividends + carry votes),
which strengthens the coin's securities characterization. Legal-review item, not
a technical blocker.

## Build plan (when you say go)

- **A.** `coinLaunch.ts`: create mint + mint supply + **revoke authority**;
  `company_coins` + flag + fee + `$BASE`-seed verification. (devnet: prove an
  immutable mint.)
- **B.** CPMM pool creation + **LP burn** + step tracker. (devnet: prove locked
  liquidity + a working swap.)
- **C.** Founder vesting + the atomic "only show when safe" gate.
- **D.** Client UI (launch form, safe-launch badge, disclosure, swap link).
- Each phase compiles, unit-tests the bookkeeping, and is devnet-verified before
  the next — same cadence as the exchange phases.
```
