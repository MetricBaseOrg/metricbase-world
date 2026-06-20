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