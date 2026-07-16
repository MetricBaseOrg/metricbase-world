# MetricBase Company Token Bridge — Design & Runbook

Status: **DESIGN ONLY — not built.** This is the plan for deploying our own
per‑company Solana tokens (no pump.fun) as an opt‑in bridge on top of the
in‑game share ledger. Nothing here ships until the operator funds a keypair,
flips a flag, and signs off after legal review.

## Decision (chosen)

- **Bridge model** (recommended): the in‑game share ledger stays the source of
  truth. A company can *optionally* mint a Token‑2022 mirror; holders **withdraw**
  shares → on‑chain tokens and **deposit** tokens → shares. On‑chain tokens are a
  wrapped/bearer representation of the same shares. This keeps the closed,
  balanceable economy (curve reserve, dividends, matching engine) intact.
- **Opt‑in + tokenize fee**: only companies whose owner chooses to tokenize get a
  mint. The owner pays a fee (gold and/or `$BASE`) sized to cover the SOL deploy
  cost + a sink. No auto‑minting of dead/spam companies.
- **Custodial mint authority**: the mint authority is the operator treasury
  keypair (same trust model as the existing casino `HOUSE_WALLET_SECRET`
  cashout signer). Documented trust assumption; a program‑PDA authority is a
  bigger, later upgrade.

## Why this is feasible (and cleaner than pump.fun)

The server **already** signs + sends real Token‑2022 transactions in production:
`server/src/solana/housePayout.ts` loads a treasury keypair from
`HOUSE_WALLET_SECRET`, derives ATAs, detects the token program, builds
`createTransferCheckedInstruction`, and confirms the tx (casino cashouts).
Deploying a mint and minting supply uses the **same** `@solana/web3.js` +
`@solana/spl-token` toolkit already in `package.json`. Verifying inbound
payments already exists too: `server/src/solana/verifyPeerTokenTransfer.ts`
(used by housing/casino/token‑shop). pump.fun, by contrast, has no clean server
API — a native mint is strictly simpler.

## Economic + legal reality (operator's call)

The moment shares can be withdrawn to a freely‑tradeable token sellable for SOL
**and** those shares pay gold dividends, you have created a real‑value‑out rail
funded by minted‑gold profit. That breaks the "no infinite money" invariant that
the whole in‑game economy relies on. This is a securities‑exposure decision, not
a coding one. Mitigations baked into this design:

- **Dividends stay gold‑only**, and **on‑chain‑held shares earn no dividends**
  until deposited back in‑game (you must have an in‑game account to receive gold).
  So a token held on a DEX is a pure ownership/price claim, not a yield rail.
- Tokenization is **opt‑in and fee‑gated**, not default.
- Ships **devnet‑first, disabled by default**, mainnet only after legal review.

Get legal advice before enabling on mainnet.

## Architecture

### Invariant

For each tokenized company:

```
sum(in‑game holdings) + onChainSupply == circulatingShares   (the curve supply)
```

`onChainSupply` = shares currently represented by on‑chain tokens (held in
wallets/DEXes, not attributed to any in‑game account). The curve reserve still
backs `circulatingShares`; withdrawing/depositing never changes supply, price, or
reserve — it only moves shares between "in‑game holding" and "on‑chain token."

### Token

- **Token‑2022 mint, 0 decimals** (a share is indivisible → 1 token = 1 share,
  no scaling math, no rounding).
- Metadata extension: `name` = company name, `symbol` = ticker (`tickerFor`),
  `uri` = a hosted JSON with the company emblem/color.
- **Mint authority** = treasury keypair (needed to mint on every withdraw).
  **Freeze authority** = none. Trust assumption documented above.

### Flows

**Tokenize (owner, once per company):**
1. Owner triggers `exchangeTokenize`. Company must be listed; caller must be the
   owner; not already tokenized; flag + keypair present.
2. Charge the tokenize fee (gold/`$BASE`) — covers SOL rent + sink.
3. Create the mint (0 decimals, authority = treasury) + metadata; confirm.
4. Persist `company_tokens` row (mint address, network). Broadcast state.

**Withdraw (holder: in‑game shares → tokens):** lock‑then‑mint, crash‑safe.
1. Holder requests withdraw `N` shares of company `C` to their wallet `W`.
2. Require `N ≤ freeSharesFor(C, holder)` (not committed to orders/`$BASE`
   listings). Reduce the holder's ledger shares by `N` **first**, write a
   `token_withdraw_pending(id, company, holder, wallet, shares, status='minting')`
   row (idempotency + crash recovery), `onChainSupply += N`.
3. Mint `N` tokens to `W`'s ATA (create ATA if missing) via the treasury keypair
   — reuse the exact `housePayout.sendPayout` construction. Confirm.
4. On success: mark the pending row `done`. On failure/timeout: **unlock** —
   credit the holder's `N` shares back, `onChainSupply -= N`, mark `failed`. A
   boot‑time sweep reconciles any `minting` rows against the chain.

**Deposit (holder: tokens → in‑game shares):** verify‑then‑credit, idempotent.
1. Holder sends `N` tokens to the treasury ATA (client signs, exactly like the
   housing `$BASE` buy). Client stashes the signature in localStorage.
2. Server verifies with `verifyPeerTokenTransfer(sig, {fromWallet: W, toWallet:
   treasury, mint: companyMint, minUiAmount: N})` and `isPurchaseRedeemed(sig)`.
3. On success: credit the holder `N` ledger shares, `onChainSupply -= N`, burn
   the received tokens from the treasury ATA (treasury owns them → can burn),
   `recordTokenPurchase(sig, W, 'share_deposit:'+company, N)` for idempotency.
4. Concurrency + crash safety mirror the housing `$BASE` resale handler.

Cost basis on deposit: set to current mark‑to‑market gold value (same rule as a
`$BASE` P2P buy) so gold P/L stays sensible.

## Data model (append to schema.sql)

```sql
CREATE TABLE IF NOT EXISTS company_tokens (
  company_id    VARCHAR(64) PRIMARY KEY,
  mint_address  VARCHAR(44) NOT NULL,
  decimals      SMALLINT NOT NULL DEFAULT 0,
  network       VARCHAR(12) NOT NULL,           -- devnet|mainnet
  on_chain_supply INTEGER NOT NULL DEFAULT 0,   -- shares represented by tokens
  tokenized_at  BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS token_withdraw_pending (
  id          VARCHAR(64) PRIMARY KEY,
  company_id  VARCHAR(64) NOT NULL,
  holder_name VARCHAR(16) NOT NULL,
  holder_wallet VARCHAR(44) NOT NULL,
  shares      INTEGER NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'minting',  -- minting|done|failed
  signature   VARCHAR(96),
  created_at  BIGINT NOT NULL
);
```

`share_deposit:*` reuses the existing `token_purchases` idempotency table.

## Server modules (new / touched)

- `server/src/solana/tokenMint.ts` (new): `deployCompanyMint(company)`,
  `mintSharesTo(mint, wallet, n)`, `burnDepositedShares(mint, n)`. Mirrors
  `housePayout.ts` (keypair load, program detection, confirm). Disabled unless
  `HOUSE_WALLET_SECRET`/`MINT_AUTHORITY_SECRET` **and** the flag are set.
- `server/src/db/companyTokens.ts` (new): load/save `company_tokens`, pending
  rows, `onChainSupply` accounting.
- `server/src/exchange/exchangeRegistry.ts`: `tokenizeCompany`,
  `beginWithdraw`/`finalizeWithdraw`/`unlockWithdraw`, `applyDeposit`,
  `onChainSupplyOf`; extend `freeSharesFor` to also exclude in‑flight withdraws.
- `server/src/rooms/ZoneRoom.ts`: `exchangeTokenize`, `exchangeWithdrawShares`,
  `exchangeDepositShares` handlers (verify/sign paths mirror
  `handleExchangeBuyBase`).
- Client: a "Tokenize / On‑chain" section in the company trade page (tokenize
  button for owners; withdraw/deposit with the wallet‑payment flow already used
  by the `$BASE` market).

## Operator setup (what only you provide)

1. **Keypair + SOL.** Reuse `HOUSE_WALLET_SECRET` or set a dedicated
   `MINT_AUTHORITY_SECRET` (bs58 or JSON byte array, same format as the casino
   secret). Fund it with SOL to pay mint rent + fees.
   - Rough cost: **~0.003–0.005 SOL per company mint** (rent + metadata),
     **~0.000005 SOL per withdraw** (+ ~0.002 SOL once if the recipient needs a
     new ATA). Size the tokenize/withdraw fees to cover these + a margin.
2. **RPC.** `SOLANA_RPC_URL` already set (Helius). Use a **devnet** RPC for QA.
3. **Feature flag.** `EXCHANGE_TOKENIZE_ENABLED=true`. Off by default — with the
   flag unset (or no keypair), tokenize/withdraw/deposit no‑op with a clear
   "not available" message, exactly like casino withdrawals.

## Devnet‑first QA runbook

```bash
# 1. Make + fund a devnet keypair
solana-keygen new -o mint-authority.json
solana config set --url https://api.devnet.solana.com
solana airdrop 2 $(solana address -k mint-authority.json)

# 2. Point the server at devnet with the keypair + flag
#    MINT_AUTHORITY_SECRET = contents of mint-authority.json (JSON byte array)
#    SOLANA_RPC_URL        = https://api.devnet.solana.com
#    EXCHANGE_TOKENIZE_ENABLED = true
```

Then, in game on devnet:
1. Tokenize a test company → confirm the mint on Solana Explorer (devnet).
2. Withdraw N shares → confirm N tokens land in your wallet; ledger shares drop
   by N; `on_chain_supply` +N.
3. Deposit the tokens back → confirm ledger shares restored; tokens burned;
   `on_chain_supply` −N; the signature can't be reused.
4. Kill the server mid‑withdraw → confirm the boot sweep reconciles the pending
   row (either the mint landed and finalizes, or it didn't and shares unlock).

**Mainnet promotion:** fund a mainnet keypair, switch `SOLANA_RPC_URL` back to
Helius mainnet, keep the flag off until legal sign‑off, then flip it.

## Anti‑abuse / safety

- Only **free** (uncommitted, not in‑flight) shares can be withdrawn.
- Deposits are idempotent (`token_purchases` on signature) with a concurrency
  re‑check, mirroring the audited housing `$BASE` resale.
- Withdraw is **lock‑first, mint‑second**, with a pending row + boot sweep so a
  crash never mints without debiting or debits without minting.
- **On‑chain shares earn no gold dividends** until deposited (no in‑game account).
- Tokenize + withdraw are **fee‑gated** (sink + covers SOL) and rate‑limited.
- Mint authority is custodial — consider a multisig (Squads) for mainnet.

## Build plan (when you say go)

- **A.** `tokenMint.ts` + `company_tokens` + flag + tokenize handler + fee.
  (devnet: prove a mint deploys.)
- **B.** Withdraw (lock → mint → finalize/unlock) + pending table + boot sweep.
- **C.** Deposit (verify → credit → burn) + idempotency.
- **D.** Client UI (tokenize button, withdraw/deposit with wallet flow).
- Each phase compiles, unit‑tests the ledger accounting, and is devnet‑verified
  before the next — same cadence as the exchange phases.
```
