-- Optional accent for public profile hero ring / future theming
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent_hex text;

COMMENT ON COLUMN public.profiles.accent_hex IS 'Optional #RRGGBB; null uses app default.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_accent_hex_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_accent_hex_format CHECK (
    accent_hex IS NULL OR accent_hex ~ '^#[0-9a-fA-F]{6}$'
  );
