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
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 25;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB NOT NULL DEFAULT '{"weaponId":null}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS npc_interact_at JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mob_gold_claimed JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS knocked_out_until BIGINT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '{"woodcutting":0}'::jsonb;

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

-- Guilds: persistent player organizations. Members stored as a JSON name array.
CREATE TABLE IF NOT EXISTS guilds (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(24) UNIQUE NOT NULL,
  tag VARCHAR(4) UNIQUE NOT NULL,
  leader_name VARCHAR(16) NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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