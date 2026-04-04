-- Dashboard toggle: force English or Chinese poster labels, or follow each sale's language.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS poster_labels_locale text;

COMMENT ON COLUMN public.profiles.poster_labels_locale IS
  'NULL = use sold_records.language per listing; en = English poster only; zh = Chinese poster (3:4 layout).';
