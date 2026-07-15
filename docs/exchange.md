# Players Company Stock Exchange

A market where players buy and sell ownership shares in **Merchant Companies**
(see `docs/company.md`). Companies generate profit from real gameplay; the market
prices that profit; shareholders receive dividends.

## Settlement model (decided)

- **In-game-authoritative share ledger.** Shares are an authoritative in-game
  balance, exactly like gold, the guild bank, and the company treasury. Not a
  real on-chain token. This keeps the economy closed and balanceable and avoids
  turning shares into real-money securities.
- **Two ways to trade:**
  1. **Bonding-curve market (gold).** Always-on liquidity. Buying mints shares
     and moves price up the curve; selling burns shares and moves price down.
     Gold paid in is locked in a per-company **reserve** that backs sells, so the
     market is solvent by construction. A trade fee funds the company treasury
     and burns a slice (sink + anti-wash).
  2. **Peer-to-peer $BASE listings (Phase 3).** A holder lists shares for a fixed
     $BASE price; a buyer pays real $BASE straight to the seller (settled exactly
     like the existing housing/asset $BASE markets via `verifyPeerTokenTransfer`
     — real $BASE moves buyer→seller, **nothing minted**), and the shares move in
     the ledger. Real-money share trading with no faucet and no token deploy.
- **Dividends are paid in GOLD only,** from real treasury profit. `$BASE`
  dividends are deliberately excluded: gameplay profit is minted gold, so paying
  it out as `$BASE` would be a gold→`$BASE` faucet that can't coexist with
  "prevent infinite money." Dividends are pure transfers from the treasury.
- **On-chain mirror is a deferred, owner-operated seam.** A company *could* later
  mint a pump.fun token mirroring its share supply. That switch is the operator's
  to throw, with their keys, their pump.fun/PumpPortal integration, and legal
  review. The game never deploys tokens or custodies keys.

## Bonding curve (gold market)

Linear curve. With circulating supply `S`:

```
price(S)          = P0 + k·S
buyCost(S, n)     = ⌈ P0·n + k·(S·n + n²/2) ⌉      (paid into reserve)
sellProceeds(S,n) = ⌊ P0·n + k·(S·n − n²/2) ⌋      (paid out of reserve)
reserve(S)        = P0·S + k·S²/2                   (always covers a full sell-out)
marketCap(S)      = price(S)·S
```

Rounding favours the reserve (ceil buys / floor sells) so it can never go
insolvent. A **trade fee** (`SHARE_TRADE_FEE_RATE`) is added on buys / deducted on
sells and split `treasury / burn` — the treasury slice is the company's issuance
income; the burn slice is a sink. A round-trip loses ~`2·fee`, which is the first
line of anti-wash defence.

## Phased roadmap

- **Phase 1 (this release) — Gold bonding-curve market + ledger.** List a company
  on the exchange (owner pays a listing fee); market-buy / market-sell shares for
  gold against the curve; share ledger + shareholder registry; per-company price,
  circulating supply, reserve, market cap, 24h change; trade history feed; a
  Stock Exchange panel (market list + per-company trade view + your holdings).
  Anti-wash: trade fee, per-player-per-company cooldown, min/max trade size.
- **Phase 2 — Dividends + financials + portfolio.** Weekly dividend engine paying
  gold from treasury profit pro-rata to shareholders (board-set payout %,
  retained %, reinvest %); income statement / balance sheet / cash-flow built from
  the company's existing revenue/expense/treasury stats; dividend history;
  portfolio page (holdings, cost basis, unrealised P/L, dividend income).
- **Phase 3 — $BASE P2P listings + limit order book.** Real-`$BASE` peer-to-peer
  share sales; a limit-order book + matching engine layered over the bonding
  curve; price chart with candles; 52-week high/low; trading volume.
- **Phase 4 — Discovery + governance.** Rankings, top gainers/losers, market cap
  board, watchlist, largest-shareholders board; share-weighted company governance
  (dividend %, CEO) — carefully, so control changes don't destabilise the
  existing company-owner model.

## Anti-exploit (economy safety)

- **No minting.** Gold buys lock into the reserve; sells pay from the reserve;
  fees are transfer (treasury) + burn (sink). Reserve solvency is a math
  invariant. Dividends are transfers from the treasury.
- **Anti-wash / anti-manipulation.** Trade fee makes round-tripping lose money;
  per-player-per-company cooldown; min/max trade size; price impact is inherent
  to the curve (a whale buy self-limits by moving price up). Phase 3's $BASE P2P
  path reuses the audited `verifyPeerTokenTransfer` + idempotent
  `recordTokenPurchase` guards and a market fee, exactly like housing resale.
- **Anti-rug.** No founder token to dump. Phase 4 governance changes are
  share-weighted and rate-limited. Because shares are an in-game ledger, there is
  no external contract a founder can drain.
- **No infinite money.** The whole exchange is gold-settled and closed; the only
  real-value rail (Phase 3 $BASE P2P) is a buyer→seller transfer of pre-existing
  `$BASE`, never a mint.
```
