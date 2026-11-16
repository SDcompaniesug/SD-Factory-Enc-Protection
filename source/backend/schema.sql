CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sde_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('uploaded','analyzing','ready','queued','processing','succeeded','failed')),
  original_key TEXT NOT NULL,
  output_key TEXT,
  original_sha256 CHAR(64) NOT NULL,
  package_name TEXT,
  version_name TEXT,
  min_sdk INTEGER,
  target_sdk INTEGER,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_activities TEXT[] NOT NULL DEFAULT '{}',
  protection_state TEXT NOT NULL DEFAULT 'not_started' CHECK (protection_state IN ('not_started','blocked_engine_missing','processing','verified','failed')),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sde_jobs_created_at_idx ON sde_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS sde_jobs_status_idx ON sde_jobs (status);
