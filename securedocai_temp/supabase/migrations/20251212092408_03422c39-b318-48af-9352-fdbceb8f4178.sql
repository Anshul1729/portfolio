-- Add processing_started_at column to track when processing began
ALTER TABLE public.sources 
ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone;