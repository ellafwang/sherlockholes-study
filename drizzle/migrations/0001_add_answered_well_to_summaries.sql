ALTER TABLE public.summaries
  ADD COLUMN IF NOT EXISTS answered_well jsonb NOT NULL DEFAULT '[]'::jsonb;