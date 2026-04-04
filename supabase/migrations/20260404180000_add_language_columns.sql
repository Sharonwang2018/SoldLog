-- Multilingual: agent preference + per-record display language
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

ALTER TABLE public.sold_records
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.profiles.language IS 'Agent preferred locale for new records and UI (e.g. en, zh, ru, es).';
COMMENT ON COLUMN public.sold_records.language IS 'Locale for public sold story labels and poster (matches profile at insert by default).';
