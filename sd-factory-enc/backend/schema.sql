CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sde_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('uploaded','analyzing','ready','queued','processing','succeeded','failed')),
  original_key TEXT NOT NULL CHECK (length(original_key) BETWEEN 1 AND 512),
  output_key TEXT,
  original_sha256 CHAR(64) NOT NULL CHECK (original_sha256 ~ '^[a-f0-9]{64}$'),
  package_name TEXT,
  version_name TEXT,
  min_sdk INTEGER,
  target_sdk INTEGER,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(activities) = 'array'),
  selected_activities TEXT[] NOT NULL DEFAULT '{}',
  protection_state TEXT NOT NULL DEFAULT 'not_started' CHECK (protection_state IN ('not_started','blocked_engine_missing','processing','verified','failed')),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sde_jobs_created_at_idx ON sde_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS sde_jobs_status_idx ON sde_jobs (status);
CREATE INDEX IF NOT EXISTS sde_jobs_activities_gin_idx ON sde_jobs USING GIN (activities);
