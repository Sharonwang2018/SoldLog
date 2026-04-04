-- Short narrative for public "sold story" page
ALTER TABLE public.sold_records
  ADD COLUMN IF NOT EXISTS sold_story TEXT;
