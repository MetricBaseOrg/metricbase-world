CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(16) UNIQUE NOT NULL,
  zone_id VARCHAR(32) NOT NULL DEFAULT 'zone_hub',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  quest_progress JSONB NOT NULL DEFAULT '{"active":[],"objectiveIndex":{},"completed":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS characters_name_idx ON characters (name);

ALTER TABLE characters ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS quest_progress JSONB NOT NULL DEFAULT '{"active":[],"objectiveIndex":{},"completed":[]}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS appearance JSONB NOT NULL DEFAULT '{"bodyColor":16763095,"hairColor":2960686,"outfitColor":3494000,"hairStyle":"short","outfitStyle":"robe"}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(44);
CREATE UNIQUE INDEX IF NOT EXISTS characters_wallet_address_idx ON characters (wallet_address) WHERE wallet_address IS NOT NULL;
-- Wallet is the canonical player identity: a full (non-partial) unique index so
-- saveCharacter can upsert with `ON CONFLICT (wallet_address)`. Nullable column,
-- so multiple NULL wallets are still allowed (walletless local/dev with the
-- token gate off); every non-null wallet is unique (one wallet ⇄ one character).
CREATE UNIQUE INDEX IF NOT EXISTS characters_wallet_unique ON characters (wallet_address);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 25;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB NOT NULL DEFAULT '{"weaponId":null}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS npc_interact_at JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mob_gold_claimed JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS knocked_out_until BIGINT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '{"woodcutting":0}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS stamina INTEGER;
-- VIP Community Lodge pass expiry (epoch millis). NULL = no pass.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS vip_pass_until BIGINT;
-- Lifetime Black Zone access from a one-time $BASE burn.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS black_pass BOOLEAN NOT NULL DEFAULT false;
-- PvP Seasons (Phase 6): rating, kill count, and the season they belong to.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pvp_rating INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pvp_kills INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pvp_season INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS characters_pvp_rating_idx ON characters (pvp_rating DESC);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS honor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS guild_coin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gems INTEGER NOT NULL DEFAULT 0;
-- Bag expansion steps purchased with $BASE burns (0 = base 16 slots).
ALTER TABLE characters ADD COLUMN IF NOT EXISTS bag_level INTEGER NOT NULL DEFAULT 0;
-- Player-set profile motto shown on the /dashboard page.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS motto VARCHAR(80) NOT NULL DEFAULT '';

-- Casino: custodial per-currency balances (smallest units) + idempotent ledger.
CREATE TABLE IF NOT EXISTS casino_balances (
  wallet_address VARCHAR(44) NOT NULL,
  currency_id VARCHAR(8) NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, currency_id)
);
CREATE TABLE IF NOT EXISTS casino_ledger (
  signature VARCHAR(128) PRIMARY KEY,
  wallet_address VARCHAR(44) NOT NULL,
  currency_id VARCHAR(8) NOT NULL,
  kind VARCHAR(8) NOT NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS casino_ledger_wallet_idx ON casino_ledger (wallet_address);

-- Player-to-player mail with optional gold attachment.
CREATE TABLE IF NOT EXISTS mail (
  id BIGSERIAL PRIMARY KEY,
  recipient VARCHAR(64) NOT NULL,
  sender VARCHAR(64) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  gold INTEGER NOT NULL DEFAULT 0,
  claimed BOOLEAN NOT NULL DEFAULT false,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mail_recipient_idx ON mail (recipient, created_at DESC);

-- Casino daily login bonus: one claim per UTC day, with a consecutive-day streak.
CREATE TABLE IF NOT EXISTS casino_daily (
  wallet_address VARCHAR(44) PRIMARY KEY,
  day BIGINT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 1
);

-- ===== Ad marketplace (brand bids + player revenue share) =====
-- Brand $BASE balances (smallest units) funded by deposits.
CREATE TABLE IF NOT EXISTS ad_brands (
  wallet_address VARCHAR(44) PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  lifetime_spent BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Brand campaigns (creative + CPM bid). cpm is base units per 1000 impressions.
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id VARCHAR(40) PRIMARY KEY,
  brand_wallet VARCHAR(44) NOT NULL,
  name VARCHAR(64) NOT NULL,
  image_url TEXT NOT NULL,
  headline VARCHAR(120) NOT NULL DEFAULT '',
  click_url TEXT NOT NULL,
  cpm BIGINT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  impressions BIGINT NOT NULL DEFAULT 0,
  spent BIGINT NOT NULL DEFAULT 0,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ad_campaigns_brand_idx ON ad_campaigns (brand_wallet);
CREATE INDEX IF NOT EXISTS ad_campaigns_status_idx ON ad_campaigns (status);
-- Registered players + their accrued (claimable) ad earnings, base units.
CREATE TABLE IF NOT EXISTS ad_members (
  wallet_address VARCHAR(44) PRIMARY KEY,
  earnings BIGINT NOT NULL DEFAULT 0,
  lifetime BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Idempotent on-chain ledger for ad deposits + player claims.
CREATE TABLE IF NOT EXISTS ad_ledger (
  signature VARCHAR(128) PRIMARY KEY,
  wallet_address VARCHAR(44) NOT NULL,
  kind VARCHAR(8) NOT NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily snapshots for ad transparency charts (cumulative values at capture time;
-- charts are rendered as day-over-day deltas).
CREATE TABLE IF NOT EXISTS ad_daily (
  day DATE PRIMARY KEY,
  revenue BIGINT NOT NULL DEFAULT 0,
  player_paid BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  members INTEGER NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ad_member_daily (
  wallet_address VARCHAR(44) NOT NULL,
  day DATE NOT NULL,
  lifetime BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet_address, day)
);

CREATE TABLE IF NOT EXISTS token_purchases (
  signature VARCHAR(88) PRIMARY KEY,
  wallet VARCHAR(44) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  token_amount DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS token_purchases_wallet_idx ON token_purchases (wallet);

CREATE TABLE IF NOT EXISTS market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  side VARCHAR(4) NOT NULL CHECK (side IN ('bid', 'ask')),
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  wallet VARCHAR(44) NOT NULL,
  player_name VARCHAR(16) NOT NULL,
  gold_amount INTEGER NOT NULL,
  token_price DOUBLE PRECISION NOT NULL,
  escrow_gold INTEGER NOT NULL DEFAULT 0,
  counterparty_wallet VARCHAR(44),
  pending_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_orders_status_idx ON market_orders (status);
CREATE INDEX IF NOT EXISTS market_orders_wallet_idx ON market_orders (wallet);

-- Payment currency the order is priced in (base / usdc / idrx / sol).
ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'base';

CREATE TABLE IF NOT EXISTS market_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES market_orders(id),
  buyer_wallet VARCHAR(44) NOT NULL,
  seller_wallet VARCHAR(44) NOT NULL,
  gold_amount INTEGER NOT NULL,
  token_amount DOUBLE PRECISION NOT NULL,
  tx_signature VARCHAR(88) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_trades_created_at_idx ON market_trades (created_at);

-- Currency the trade settled in; the price chart only aggregates 'base' trades.
ALTER TABLE market_trades ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'base';

-- Persistent vendor sell pressure (dynamic NPC pricing) so prices survive restarts.
CREATE TABLE IF NOT EXISTS vendor_sell_pressure (
  item_id VARCHAR(64) PRIMARY KEY,
  value DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owned land plots (housing). One row per purchased plot.
CREATE TABLE IF NOT EXISTS land_plots (
  plot_id VARCHAR(64) PRIMARY KEY,
  zone_id VARCHAR(64) NOT NULL,
  owner_wallet VARCHAR(44),
  owner_name VARCHAR(16) NOT NULL,
  structure VARCHAR(16) NOT NULL DEFAULT 'house',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player-run shop inventory + uncollected earnings (added later).
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS listings JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS earnings INTEGER NOT NULL DEFAULT 0;
-- Roof-paint customization (housing depth). NULL = default colour.
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS roof VARCHAR(16);
-- Owner-set building sign / name (housing depth). NULL = default label.
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS sign VARCHAR(24);
-- Corner decoration props (housing depth). JSON array of prop ids / nulls.
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS decor JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Building light: on/off, remaining energy reserve, and when energy was last set.
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS light_on BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS energy INTEGER NOT NULL DEFAULT 100;
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS energy_at BIGINT;
-- P2P resale asking prices. NULL = not offered in that currency.
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS sale_gold BIGINT;
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS sale_base DOUBLE PRECISION;

-- Treasury gold accounting: running totals of in-game gold routed to the
-- treasury (e.g. zone-slot sales), kept per source for auditing / buybacks.
CREATE TABLE IF NOT EXISTS treasury_gold (
  source VARCHAR(32) PRIMARY KEY,
  gold BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Economy activity metrics: lifetime running counters (gathered, crafted, sold,
-- gold minted/burned, etc.) plus per-day buckets for charts. Powers /stats.
CREATE TABLE IF NOT EXISTS economy_metrics (
  metric VARCHAR(48) PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS economy_daily (
  day DATE NOT NULL,
  metric VARCHAR(48) NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);

-- Player-owned zones ("Worlds"): a blank zone slot bought for gold, built by
-- its owner from placeable props/nodes, and monetised via visitor passes. The
-- whole editable layout lives in the `build` JSON blob; `meta` in columns.
CREATE TABLE IF NOT EXISTS player_zones (
  zone_id VARCHAR(64) PRIMARY KEY,
  owner_wallet VARCHAR(44),
  owner_name VARCHAR(16) NOT NULL,
  display_name VARCHAR(24) NOT NULL,
  pass_price INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  earnings INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  build JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Gold a visitor pays the owner per gather (added later).
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS gather_tax INTEGER NOT NULL DEFAULT 0;
-- Expansion steps purchased with $BASE burns (0 = base 24x24 grid).
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS expand_level INTEGER NOT NULL DEFAULT 0;
-- Owner-set PvP danger tier (safe/yellow/red/black; added later).
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS danger_tier TEXT NOT NULL DEFAULT 'safe';
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS guild_only BOOLEAN NOT NULL DEFAULT false;
-- Owner analytics counters (added later): lifetime totals, never reset.
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS passes_sold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS pass_gold BIGINT NOT NULL DEFAULT 0;
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS tax_gold BIGINT NOT NULL DEFAULT 0;
ALTER TABLE player_zones ADD COLUMN IF NOT EXISTS lifetime_earnings BIGINT NOT NULL DEFAULT 0;

-- Build-asset inventory: how many of each placeable asset a player owns (bought
-- from the Build Shop or P2P, consumed when placed, returned when removed).
CREATE TABLE IF NOT EXISTS asset_inventory (
  player_name VARCHAR(16) NOT NULL,
  asset_id VARCHAR(32) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_name, asset_id)
);

-- Player-to-player asset market: an open listing of build assets for gold.
CREATE TABLE IF NOT EXISTS asset_listings (
  id VARCHAR(64) PRIMARY KEY,
  seller_name VARCHAR(16) NOT NULL,
  asset_id VARCHAR(32) NOT NULL,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gold owed to a player from asset sales while they were offline; applied on
-- their next join.
-- Daily quests + login streak, one row per player. Progress/claims reset when
-- `day` rolls over (handled in code); streak survives across days.
CREATE TABLE IF NOT EXISTS daily_state (
  player_name VARCHAR(16) PRIMARY KEY,
  day VARCHAR(10) NOT NULL,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed JSONB NOT NULL DEFAULT '{}'::jsonb,
  login_claimed BOOLEAN NOT NULL DEFAULT false,
  streak INTEGER NOT NULL DEFAULT 0,
  last_login_day VARCHAR(10)
);

-- Player-to-player jobs: employer escrows the reward at posting; the worker
-- is paid on verified completion. delivered items await employer pickup.
CREATE TABLE IF NOT EXISTS jobs (
  id VARCHAR(64) PRIMARY KEY,
  employer_name VARCHAR(16) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  item_id VARCHAR(48),
  qty INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  reward_gold INTEGER NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'open',
  worker_name VARCHAR(16),
  zone_id VARCHAR(64),
  items_to_collect INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);

CREATE TABLE IF NOT EXISTS pending_gold (
  player_name VARCHAR(16) PRIMARY KEY,
  amount INTEGER NOT NULL DEFAULT 0
);
-- Per-visitor zone passes: which wallet may enter which zone, until when.
CREATE TABLE IF NOT EXISTS zone_passes (
  zone_id VARCHAR(64) NOT NULL,
  holder_name VARCHAR(16) NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (zone_id, holder_name)
);

-- Guilds: persistent player organizations. Members stored as a JSON name array.
CREATE TABLE IF NOT EXISTS guilds (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(24) UNIQUE NOT NULL,
  tag VARCHAR(4) UNIQUE NOT NULL,
  leader_name VARCHAR(16) NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guild Warfare (Phase 3): officers, shared bank, income tax, war list.
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS officers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS bank INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS wars JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS join_requests JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Active (planted) farm plots. One row per growing crop; the row is deleted on
-- harvest. Growth is time-based (planted_at/ready_at are epoch millis), so crops
-- keep maturing across server restarts.
CREATE TABLE IF NOT EXISTS farm_plots (
  plot_id VARCHAR(64) PRIMARY KEY,
  zone_id VARCHAR(64) NOT NULL,
  crop_id VARCHAR(64) NOT NULL,
  seed_id VARCHAR(64) NOT NULL,
  planter_name VARCHAR(16) NOT NULL,
  planted_at BIGINT NOT NULL,
  ready_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS invitations (
  code VARCHAR(32) PRIMARY KEY,
  inviter_wallet VARCHAR(44) NOT NULL,
  invitee_wallet VARCHAR(44) UNIQUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_inviter_wallet_idx ON invitations (inviter_wallet);
CREATE INDEX IF NOT EXISTS invitations_invitee_wallet_idx ON invitations (invitee_wallet);

-- Territory Control (Phase 4): which guild owns each capture point.
CREATE TABLE IF NOT EXISTS territories (
  point_id VARCHAR(64) PRIMARY KEY,
  zone_id VARCHAR(64) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Castle Siege (Phase 5): the reigning Sovereign guild. Single 'global' row.
CREATE TABLE IF NOT EXISTS siege_state (
  id VARCHAR(16) PRIMARY KEY,
  sovereign_guild_id VARCHAR(64),
  won_at TIMESTAMPTZ
);

-- ============================================================================
-- WALLET-AS-IDENTITY MIGRATION (Phase 3): tables that reference players by the
-- mutable display NAME get a parallel immutable WALLET column so a rename never
-- breaks mail, jobs, guild membership, passes, ownership, etc. Additive + dual
-- written during the bake period; the legacy *_name columns are dropped later
-- (Phase 5). Backfilled once from characters via a one-off script, not on boot.
-- (player_zones.owner_wallet and land_plots.owner_wallet already exist.)
-- ============================================================================
ALTER TABLE mail            ADD COLUMN IF NOT EXISTS recipient_wallet VARCHAR(44);
ALTER TABLE mail            ADD COLUMN IF NOT EXISTS sender_wallet    VARCHAR(44);
ALTER TABLE jobs            ADD COLUMN IF NOT EXISTS employer_wallet  VARCHAR(44);
ALTER TABLE jobs            ADD COLUMN IF NOT EXISTS worker_wallet    VARCHAR(44);
ALTER TABLE guilds          ADD COLUMN IF NOT EXISTS leader_wallet    VARCHAR(44);
ALTER TABLE zone_passes     ADD COLUMN IF NOT EXISTS holder_wallet    VARCHAR(44);
ALTER TABLE farm_plots      ADD COLUMN IF NOT EXISTS planter_wallet   VARCHAR(44);
ALTER TABLE asset_inventory ADD COLUMN IF NOT EXISTS player_wallet    VARCHAR(44);
ALTER TABLE asset_listings  ADD COLUMN IF NOT EXISTS seller_wallet    VARCHAR(44);
ALTER TABLE pending_gold    ADD COLUMN IF NOT EXISTS player_wallet    VARCHAR(44);
ALTER TABLE daily_state     ADD COLUMN IF NOT EXISTS player_wallet    VARCHAR(44);
CREATE INDEX IF NOT EXISTS mail_recipient_wallet_idx ON mail (recipient_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS zone_passes_holder_wallet_idx ON zone_passes (zone_id, holder_wallet);
CREATE INDEX IF NOT EXISTS asset_inventory_player_wallet_idx ON asset_inventory (player_wallet);