# Merchant Companies (v0.140.0)

## Context

Player-owned economic organizations coexisting with Guilds: a player can be in one guild AND one company. Guilds stay social/PvP; companies are businesses — treasury (gold + item warehouse), ranks/permissions, recruitment, automatic daily salaries + dividends, revenue-share skim, company vendor sales, an inbound contracts board, company chat/MOTD/stats/reputation. Ships as one release.

User-confirmed scope: ALL four revenue streams (skim, warehouse vendor sells, contracts board, member deposits); gold + item warehouse; daily leader-configured automatic payouts; company types are branding + focus stat only (NO gameplay buffs). Companies stay out of DAO delegation and have NO effect on PvP/wars/territory.

**Economic invariant (drives everything):** all company gold flows are pure transfers between existing balances — never `mintGold`. The only mint is warehouse vendor selling, which reuses the *existing* softened faucet (`effectiveSellPrice` → `recordSale` → `mintGold`). The registration fee is a burn (sink). Warehouse item moves are P2P-neutral: never `recordProduced`/`recordConsumed`.

## 1. Shared — `shared/src/company.ts` (new)

Modeled on `shared/src/guild.ts` + `shared/src/jobs.ts`. Export from `shared/src/index.ts`; bump `GAME_VERSION` → `"0.140.0"`; add `DASHBOARD_UPDATES` entry in `shared/src/dashboard.ts`.

**Tunables (ONE table, user-tunable — say so in a header comment):**

| Constant | Default |
|---|---|
| `COMPANY_CREATE_COST` | 2500 |
| `COMPANY_NAME_MIN/MAX_LENGTH` | 3 / 24 |
| `MAX_COMPANY_MEMBERS` | 20 |
| `COMPANY_MAX_REVENUE_SHARE` | 0.10 (parity w/ `GUILD_MAX_TAX_RATE`) |
| `COMPANY_MAX_SALARY` | 500 gold/member/day |
| `COMPANY_MAX_DIVIDEND_RATE` | 0.25 of treasury/day |
| `COMPANY_WAREHOUSE_SLOTS` | 48 |
| `COMPANY_MAX_OPEN_CONTRACTS` | 5 |
| `COMPANY_CONTRACT_MIN/MAX_REWARD` | 50 / 1,000,000 |
| `COMPANY_MOTD_MAX_LENGTH` | 200 |
| `COMPANY_DIVIDEND_MIN_ACTIVITY_DAYS` | 3 |
| `COMPANY_MIN_MEMBERS_FOR_DIVIDENDS` | 2 |

**Types/constants:**
- `COMPANY_TYPES = ["mining","farming","fishing","merchant","blacksmith","logistics"]` + `COMPANY_TYPE_INFO` (label, icon, focusStat label — branding only).
- `COMPANY_EMBLEMS` (12 preset emoji) + `COMPANY_COLORS` (8 preset ints) — validated server-side by membership.
- `CompanyRank = "owner" | "manager" | "employee" | "trainee"`; `CompanyPermissions` interface + `COMPANY_PERMISSIONS: Record<CompanyRank, CompanyPermissions>` matrix (owner: all; manager: approveMembers, kick(lower ranks), withdrawItems, sellWarehouse, acceptContracts, setMotd; employee/trainee: contribute + chat). `companyRankOf(...)`, `companyCan(rank, perm)`.
- Payloads: `CompanySummary`, `CompanyContractView`, `CompanyDetail` (roster, treasury, revenueShare, dividendRate, motd, warehouse `InventoryEntry[]`, salaries `Record<name, gold>`, stats, contracts, myRank, lastPayoutDay, reputation), `CompanyStatePayload { myCompany, companies, myRequestCompanyId }`, `CompanyResultPayload { ok, error?, gold? }`.
- Validators: `sanitizeCompanyName/isValidCompanyName/sanitizeCompanyMotd/isValidCompanyEmblem/isValidCompanyColor/isValidCompanyType/validateContractInput`.
- `computeCompanyReputation({ageDays, members, contractsCompleted, lifetimeRevenue, payoutDays})` — weights constant beside it; display-only score. Reputation uses treasury revenue, NOT contribution stats (wash-proof).

**`shared/src/messages.ts`:** channel union → `"zone" | "system" | "guild" | "party" | "company"`.

## 2. DB — `server/src/db/schema.sql` (append) + `server/src/db/companies.ts` (new)

Guild-style JSONB roster on one row (keeps rename cascade simple), plus contracts + payout-log tables:

- `companies`: `id VARCHAR(64) PK, name VARCHAR(24) UNIQUE, owner_name VARCHAR(16), owner_wallet VARCHAR(44), emblem VARCHAR(8), color INTEGER, company_type VARCHAR(16), motd VARCHAR(200), treasury INTEGER DEFAULT 0, revenue_share DOUBLE PRECISION DEFAULT 0, dividend_rate DOUBLE PRECISION DEFAULT 0, members JSONB, managers JSONB, trainees JSONB, join_requests JSONB, warehouse JSONB ('[]' — InventoryEntry[] shape), salaries JSONB ('{}'), stats JSONB ('{}'), last_payout_day VARCHAR(10), created_at TIMESTAMPTZ` (employee = member not in managers/trainees; owner in members).
- `company_contracts`: `id PK, company_id, poster_name, poster_wallet, kind ('supply'|'gather'|'harvest'|'mobs'), item_id, qty, progress, reward_gold, status ('open'|'accepted'|'completed'|'cancelled'), items_to_collect, created_at` + index `(company_id, status)`.
- `company_payouts`: `(company_id, day) PK, salaries_paid, dividends_paid, detail JSONB` — audit + DB-level idempotency backstop.

`db/companies.ts` clones `db/guilds.ts`: `StoredCompany`, `loadCompanies`, `saveCompany` (full-row upsert), `deleteCompany`, plus `loadCompanyContracts/saveContract/deleteContract`, `insertPayoutLog` (`ON CONFLICT DO NOTHING`). All no-op on null pool.

**Rename cascade — `server/src/db/characters.ts` `renameCharacter` (~L276):** add `["companies","owner_name"]` and `["company_contracts","poster_name"]` to `nameCols`; add a companies JSONB statement mirroring the existing guilds array-swap for `members/managers/trainees/join_requests`, PLUS object-key renames for `salaries` and `stats->contrib` (jsonb `-` old key `||` rebuilt key). Check what the rename flow does about the in-memory guild registry and mirror it for companies. **Test with a seeded company** — flagged fiddly.

## 3. Server registry — `server/src/company/companyRegistry.ts` (new)

Mirror `server/src/guild/guildRegistry.ts` exactly: process-global Maps (`companies` by id, `memberIndex` name→id, `contracts` by id), `initCompanyRegistry()` at boot, every mutation = mutate memory + `void saveCompany(...)`.

Functions: `getCompanyForMember/getCompanyById/companyMemberNames`; `createCompany(name, emblem, color, type, ownerName, ownerWallet)` (no fee — ZoneRoom charges); join-request lifecycle (`requestJoin/cancel/approve/deny`); `leaveCompany` (owner leaving → promote first manager, else first member; empty → delete + cancel/refund open contracts via credit callback); `setCompanyRank` (owner sets managers; manager may promote trainee→employee), `kickCompanyMember` (managers can't kick managers); `setCompanyMotd/setCompanyRates/setCompanySalary` (caps enforced); `depositCompanyGold/withdrawCompanyGold` (withdraw owner-only); `contributeWarehouse/withdrawWarehouse/takeFromWarehouse` (uses `addItemToInventory`/`removeItemFromInventory` from shared/items.ts with `COMPANY_WAREHOUSE_SLOTS`); `applyCompanyCut(name, grossGold)` (clone of `applyGuildTax`, bumps stats); `creditCompanyTreasury(id, amount, source)`; `tickCompanyActivity(name, n)` (stamps per-member lastActiveDay for dividend eligibility); contract lifecycle (`postCompanyContract` — escrow charged by caller, reject if poster is a member of target company; `cancelCompanyContract` → refund; `acceptCompanyContract` permission-gated; `deliverCompanyContract` pulls from warehouse for supply kind; `bumpCompanyContractProgress(name, kind, n)` for activity kinds; `completeCompanyContract` → treasury += escrow, transfer); `buildCompanyStatePayload(playerName)`; `runCompanyDailyPayouts(credit)`.

**Daily payout runner:** hourly `setInterval(...).unref()` in `server/src/index.ts` next to `captureNetWorthSnapshot` (+ one run on boot). Per company where `lastPayoutDay !== todayUTC`: set `lastPayoutDay` FIRST + persist (single process → race-free), then pay salaries in roster order (`min(salary, cap)`, skip individuals treasury can't cover), then dividends (`floor(treasury × dividendRate)` split equally among members active within `COMPANY_DIVIDEND_MIN_ACTIVITY_DAYS`, min 2 members; remainder stays). `credit(name, amount)` callback = new `ZoneRoom.creditPlayerGlobal` static (extract body of `creditPlayerByName` at ZoneRoom.ts:4126 — already iterates `activeRooms`, credits by pid, falls back to `addPendingGold`; private method delegates). Avoids registry→ZoneRoom import cycle. Write `company_payouts` row, notify members via `presence.sendToPlayers` chat + fresh `companyState`, `bumpMetric("company.salary.gold"/"company.dividend.gold")`.

## 4. ZoneRoom wiring — `server/src/rooms/ZoneRoom.ts`

**Revenue skim:** `grantGold` (L4792, the ONLY `applyGuildTax` site — covers mob/quest/etc gold) gets `const cut = applyCompanyCut(player.name, amount); const kept = amount - tax - cut;` (caps ⇒ kept ≥ 80%), system-chat string mentions the company cut, `if (cut > 0) this.broadcastCompanyState(companyMemberNames(player.name))`. Vendor sells are not guild-taxed today — keep parity, no company skim there (code comment).

**Vendor-sell reuse:** extract `vendorSellProceeds(itemId, basePrice, qty)` from `handleShopSell` L5111–5118 (`effectiveSellPrice` → `recordSale` → `mintGold` → sell metrics → returns payout). `handleShopSell` calls it unchanged in behavior; new `handleCompanySell` calls it after `takeFromWarehouse`, routes payout to `creditCompanyTreasury(id, payout, "vendor")`. Prices from Pip's general-store `getShopDefinition` sellPrices (verify shop id at implementation).

**Message handlers** (all `onProtectedMessage`, registered beside the guild block; all thin — logic lives in registry): `companyCreate` (validate presets; charge `COMPANY_CREATE_COST` like guildCreate at L7648 BUT also `burnGold(cost)` + `bumpMetric("company.create.gold")` — guildCreate doesn't burn, companies should; optionally backfix guilds), `companyJoin/Approve/Deny/Leave/Kick/SetRank`, `companySetMotd/SetRates/SetSalary`, `companyDeposit/Withdraw` (playerGold keyed by **pid** — voided-payout bug class), `companyContribute/Take` (respect `wouldStripEquipped` like handleShopSell L5101; NO recordProduced/Consumed), `companySell`, `companyContractPost` (escrow deducted from poster first, jobs pattern; refund on registry failure) `/Cancel/Accept/Deliver`, `companyChat` (clone `handleGuildChat`: cooldown + `sendToPlayers(members, "chat", {channel:"company",...})`), `requestCompanies`. Server→client: `companyState` (per-recipient via new `broadcastCompanyState` cloned from `broadcastGuildState`) + `companyResult {ok, error?, gold?}`. Send initial `companyState` where initial `guildState` is sent on join.

**Contribution ticks:** call `tickCompanyActivity` + `bumpCompanyContractProgress` at the three existing `tickJobProgress` sites (mobs ~L2262, gather ~L6665, harvest ~L7016) + the supply-delivery path; contract completion → `completeCompanyContract`.

## 5. Client

- **Store** (`client/src/store/gameStore.ts`): `companyOpen` flag — interface ~L67, initial ~L269, setter ~L382, add to `isAnyPanelOpen` ~L193.
- **network.ts**: clone guild block — `latestCompanyState` cache + listeners w/ replay (`onCompanyState/onCompanyResult`), `room.onMessage("companyState"/"companyResult")` in the joinZone wiring (~L1935 area), `sendCompany*` wrappers for every message above + `requestCompanies()`.
- **`client/src/ui/CompanyPanel.tsx`** (new; JobsPanel/WorldsPanel pattern: `chibi-panel--floating chibi-anchor--center`, maxWidth ~520, `setUiTypingActive` on inputs). Tabs:
  - **Overview** — emblem/color/type header, MOTD, reputation, stats (revenue by source, payouts, top contributors). Companyless view = directory browser + create form (emoji grid per JobsPanel JOB_KINDS pattern, color swatches per WorldsPanel danger-tier pattern, type picker, fee button `Found · 🪙 2500`, inline `chibi-card--danger` errors) + apply-to-join.
  - **Roster** — grouped by rank, promote/demote/kick per permissions, join-request approve/deny, salary editor (owner).
  - **Treasury** — balance, deposit/withdraw, revenue-share + dividend-rate controls (capped), last payout + history.
  - **Warehouse** — slot grid (reuse ItemIcon), contribute-from-inventory, withdraw, "Sell to Pip" with live prices for authorized ranks.
  - **Contracts** — company's accepted/in-progress contracts (accept/deliver) AND outsider "post a contract to a company" form (jobs-post clone). Outsiders see Directory + posting in the same panel — no separate surface.
- **TopBar** ⚙️ menu entry (~L370) → `setCompanyOpen(true)`.
- **ChatPanel**: add `"company"` to channel cycle (derive `inCompany` from company state, mirror `inGuild`), route to `sendCompanyChat`, render prefix/class; extend `mentionPicker` candidates with company roster.
- **Notifications**: `addNotification("🏢", ...)` on MOTD change / payout received (server also sends company-channel chat lines so it surfaces with the panel closed).

## 6. Anti-exploit (structural: transfers can't mint)

- Circular payroll: zero-sum transfer; salary cap + 25%/day dividend cap + owner-only gold withdrawal bound drain speed.
- Alt dividend farming: activity requirement (3 days) + equal split (alts dilute the farmer) + 20-member cap + min-2-members.
- Warehouse wash: contribution stats are display-only and excluded from reputation.
- Vendor pump: same `effectiveSellPrice`+`recordSale` path as player sells — identical softening.
- Contract self-dealing: reject posting to a company the poster belongs to (reputation counts contracts).
- Payout double-run: `lastPayoutDay` set-before-pay + `company_payouts` PK backstop.
- Rank abuse: `withdrawGold` owner-only; vendor proceeds go to treasury, never the seller's pocket.

## 7. Build order (each step compiles)

1. shared: company.ts + messages.ts union + index.ts exports + GAME_VERSION 0.140.0 + dashboard entry → build shared.
2. db: schema.sql DDL + db/companies.ts + rename cascade in characters.ts.
3. registry: companyRegistry.ts + payout runner + `initCompanyRegistry` + hourly interval in index.ts + `creditPlayerGlobal` static refactor.
4. ZoneRoom: `vendorSellProceeds` extraction, grantGold skim, handlers, broadcastCompanyState, activity ticks, chat.
5. client: network + store + CompanyPanel + TopBar + ChatPanel.
6. Bump `server/DEPLOY_MARKER` not needed (server/ changes present); commit + push; poll prod /api/stats for 0.140.0.

## 8. Verification

- `npx pnpm --filter @metricbase/shared build` → server → client (pnpm not on PATH; use npx pnpm).
- Boot local server DB-less AND with local pg: `TOKEN_GATE_DISABLED=true INVITATION_SYSTEM_DISABLED=true PORT=2599 node server/dist/index.js` → /health 200 (confirms idempotent DDL + null-pool paths).
- Headless colyseus.js E2E (copy scratchpad script into client/ to resolve deps — fishtest.mjs/admintest.mjs recipe): client A creates company (gold −2500, companyResult ok), B applies → A approves, B deposits gold + contributes items, A sets revenueShare → B earns mob gold (assert treasury skim in companyState), A sells warehouse item (assert treasury credit; compare price parity with a control player sell), outsider C posts contract (assert escrow deducted; assert self-post to own company rejected), member progresses/delivers → treasury credited; invoke `runCompanyDailyPayouts` twice same day (second = no-op) and with B offline (assert pending_gold row); rename a seeded company member and re-load registry (roster/salaries/stats keys follow).
- Company chat: two clients in different zones both receive `channel:"company"` messages.

## Flagged risks

(a) rename-cascade JSONB key-rename SQL for `salaries`/`stats.contrib` — fiddliest bit, test explicitly; (b) mirror whatever guilds do about in-memory registry refresh after rename; (c) Pip shop id for company vendor pricing needs verifying; (d) ZoneRoom is ~8000 lines — keep handlers thin, all logic in registry; (e) wiki /docs sync deferred to the next docs pass (note in commit).