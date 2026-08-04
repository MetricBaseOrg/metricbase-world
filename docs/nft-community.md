# NFT community layer — MetricBase Founders 👑

The membership drop and everything holders get from it. Player-facing copy lives
in the wiki ([`/docs` §14c](../client/public/docs.html)); this file is the design
rationale, the wiring, and the operational checklist.

**Collection:** MetricBase Founders — 1,000 pieces, 0.1 SOL mint, Solana.
Priced in **SOL, not $BASE**: that is a deliberate trade — it raises funds and
grows the community but does nothing for the $BASE demand problem tracked in
[`base-demand.md`](base-demand.md).

---

## The invariants this must never break

These are the same rules the rest of the economy is built on. Every perk below
was chosen to fit inside them:

1. **Entry stays free.** Holding is never required to play anything.
2. **$BASE is never minted as a reward.** The season pool is pre-funded.
3. **Gold never converts to $BASE.** No NFT path opens one.
4. **Raw gameplay power is not for sale.** Damage, gather yield, XP rate and
   drop rates are identical for holders and non-holders, at every tier.

The season-point multiplier (v0.202.0) is the perk that gets closest to the
line, so state it precisely: season points determine each player's **share of a
fixed, already-funded pot**. A multiplier redistributes that pot; it does not
inflate supply and does not create a gold→$BASE path. "Buy in with SOL, get a
better share of a funded pool" is internally consistent — the meaningful
distinction is *mint vs fund*, and MetricBase funds.

## Tiers

Fully data-driven in `shared/src/nft.ts` (`NFT_TIERS`) — retune names, count and
perks in one place.

| Tier | Badge | Season pts | DAO weight bonus | Skins | Trait synonyms |
|---|---|---|---|---|---|
| Bronze Founder | 👑 | ×1.5 | +100,000 | 1 | bronze, common, standard, citizen |
| Gold Founder | 🌟 | ×2 | +250,000 | 2 | gold, rare, patron |
| Ember Founder | 🔥 | ×3 | +500,000 | 3 | ember, legendary, mythic, obsidian |

A wallet's effective tier is the **highest** it holds. DAO bonuses are all
deliberately below `DAO_MIN_VOTE_BALANCE` (1,000,000), and the bonus is a flat
add on top of a balance that must already clear that floor — a boost, never a
bypass, and never a multiplier that would amplify whales.

### Reveal needs no event

Tier comes from each NFT's on-chain `Tier` attribute (`NFT_TIER_TRAIT`).
Pre-reveal metadata has none, so `tierFromAttribute()` falls back to the base
tier: a holder gets the crown and Bronze perks immediately, and the next holder
resync (on join, or the maintenance sweep) upgrades them once the launchpad
swaps in revealed metadata.

## Perks, by where they show up

- **Nameplate** — tiered badge via `PlayerSchema.nftTier` (the boolean
  `nftHolder` is kept for the who-list / profile / stats-count surfaces).
- **Who's online, player profile, `/stats` Richest + Invites boards** — crown on
  every surface where players judge status.
- **`/stats` Membership card** — `nft.byTier` counts, read from the **cached**
  `characters.nft_holder` / `nft_tier` columns. No RPC in the stats path.
- **DAO** — `holderVoteBonus` in `server/src/api/dao.ts`, frozen into the vote
  row, applies to delegated votes too. Env `DAO_NFT_HOLDER_WEIGHT_BONUS`
  overrides the per-tier values; `0` disables. Read the tier from the cached
  column, never on-chain per vote.
- **Season points** — applied centrally in `awardSeasonPointsDb`
  (`server/src/db/season.ts`): one indexed read of `characters.nft_tier`, then
  `max(1, round(points × mult))`. Because the DB is the sole source of truth for
  season points, this covers *every* source (gameplay, chests, referral,
  richest, X) with one change. Non-holder or unconfigured → ×1.
- **Telegram** — `/founder` on @MetricBaseWorldBot resolves telegram_id →
  wallet → `isHolder`, then issues a single-use 1-hour `createChatInviteLink`.
  Requires `TELEGRAM_HOLDER_CHAT_ID` and the bot to be a group admin with
  `can_invite_users`. Non-holders get the mint link; unlinked accounts are told
  to bond a wallet first.
- **Wardrobe** — `HOLDER_SKINS`, cumulative up the ladder. Holder skins live in
  their own `skin_holder_*` id namespace and are never in the chest roll pool,
  so revoke-on-sale can't strip a chest-won skin. `available` is the art gate,
  exactly like `COSMETIC_SKINS` in `chests.ts`.

## Wiring

| Concern | Where |
|---|---|
| Config, tiers, reveal, holder skins | `shared/src/nft.ts` |
| Holder detection (DAS `getAssetsByOwner`) | `server/src/solana/playerHeldNfts.ts` |
| Sync + resync | `server/src/nft/holderSync.ts` (`syncNftHolder`, `ZoneRoom.resyncNftHolders`) |
| Persistence | `characters.nft_holder / nft_count / nft_tier / nft_checked_at` |
| Client panel | `client/src/ui/MembershipPanel.tsx` (top bar → 👑 Membership) |

Detection mirrors `playerHeldBase.ts`: **Helius-class RPC only** —
`getDasRpcUrl` regex-gates to helius/shyft/quicknode/triton — with a per-wallet
30-minute cache. Sync runs fire-and-forget on join (never blocks the join path)
and on the maintenance sweep.

## Inert by default

With no `NFT_COLLECTION_ADDRESS` (or a non-DAS RPC), `isNftConfigured()` is
false: detection returns non-holder **with no network call**, the `/stats` card
hides, and the Membership panel shows a coming-soon state. Nothing about a
deployment changes until that env var is set.

## Operational checklist

- [x] Collection deployed and `NFT_MINT_URL` filled in `shared/src/nft.ts`.
- [x] `NFT_COLLECTION_ADDRESS` set on Railway.
- [x] `TELEGRAM_HOLDER_CHAT_ID` set; bot is an admin of the holders group with
      invite rights; `/founder` advertised in the bot menu.
- [ ] Set the collection's `Tier` trait values to bronze / gold / ember (or a
      listed synonym) at reveal.
- [ ] Ship holder-skin art under `/assets/skins/skin_holder_*/`, then flip each
      `HOLDER_SKINS` entry to `available: true`.

## Known gap

**There is no skin render/equip path anywhere in the client.** Holders own and
can see their unlocked skins, but *wearing* one needs both the art and a render
path. The avatar renderer is the known texture-masking hazard (see
[`assets.md`](assets.md)), so this stayed untouched.

## Not built — Phase 3

Tokenizing in-game assets is a **decision gate**, not a plan. The default is
provenance / achievement / cosmetic tokenization only. Tokenizing *earning*
assets — Worlds with gather tax, companies and shares, leveled characters —
turns real SOL into an economic position on the secondary market and breaks
invariant 4. It needs explicit owner opt-in. Related deferred designs:
[`token-bridge.md`](token-bridge.md), [`company-coin.md`](company-coin.md).
