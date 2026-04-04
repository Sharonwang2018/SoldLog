-- sold_story is unbounded TEXT (no DB length cap). Application + AI generation enforce a short
-- grapheme limit so share posters and layouts do not overflow; manual edits may be longer.
COMMENT ON COLUMN public.sold_records.sold_story IS
  'Public closing narrative. AI pipeline truncates to ~120 Unicode graphemes for poster/social fit.';
