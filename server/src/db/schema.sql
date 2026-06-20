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