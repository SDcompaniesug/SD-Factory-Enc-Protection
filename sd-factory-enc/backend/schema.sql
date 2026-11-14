CREATE TABLE IF NOT EXISTS public.factory_enc_jobs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('uploaded','queued','processing','completed','failed')),
  operation text NOT NULL,
  source_key text NOT NULL,
  sha256 text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  selected_activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  error text
);

ALTER TABLE public.factory_enc_jobs ADD COLUMN IF NOT EXISTS output_key text;
ALTER TABLE public.factory_enc_jobs ADD COLUMN IF NOT EXISTS transform_report jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.factory_enc_jobs ADD COLUMN IF NOT EXISTS signing_fingerprint text;
CREATE INDEX IF NOT EXISTS factory_enc_jobs_worker_idx ON public.factory_enc_jobs (state, created_at);
