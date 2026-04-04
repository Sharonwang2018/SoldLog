-- SoldLog: agent profiles + sold records
-- Apply: Supabase Dashboard → SQL → New query → paste → Run
--        or: supabase db push (CLI)
--
-- Triggers use EXECUTE PROCEDURE (PostgreSQL). If your project errors, try
-- EXECUTE FUNCTION instead on the three CREATE TRIGGER statements below.
--
-- Note: handle_new_user only runs for NEW signups. Existing auth users need a
-- manual row in public.profiles (id = auth.users.id) or re-signup.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, public slug for soldlog.com/[slug]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT,
  brokerage TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  slug TEXT NOT NULL,
  contact_href TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND length(slug) >= 2
    AND length(slug) <= 48
  ),
  CONSTRAINT profiles_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS profiles_slug_idx ON public.profiles (slug);

-- ---------------------------------------------------------------------------
-- sold_records: closings per agent; public slug unique per agent for URLs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sold_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  address TEXT NOT NULL,
  city_state TEXT NOT NULL DEFAULT '',
  price BIGINT NOT NULL CHECK (price >= 0),
  days_on_market INT NOT NULL DEFAULT 0 CHECK (days_on_market >= 0),
  property_image_url TEXT,
  verification_doc_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  represented_side TEXT,
  closed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sold_records_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND length(slug) >= 2
    AND length(slug) <= 64
  ),
  CONSTRAINT sold_records_agent_slug_unique UNIQUE (agent_id, slug)
);

CREATE INDEX IF NOT EXISTS sold_records_agent_id_idx ON public.sold_records (agent_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (unique slug from user id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  display text;
BEGIN
  display := COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'agent');
  base_slug := lower(regexp_replace(trim(display), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'agent';
  END IF;
  base_slug := left(base_slug, 32) || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

  INSERT INTO public.profiles (id, name, slug)
  VALUES (NEW.id, display, base_slug);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS sold_records_set_updated_at ON public.sold_records;
CREATE TRIGGER sold_records_set_updated_at
  BEFORE UPDATE ON public.sold_records
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sold_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "sold_records_select_public" ON public.sold_records;
DROP POLICY IF EXISTS "sold_records_insert_own" ON public.sold_records;
DROP POLICY IF EXISTS "sold_records_update_own" ON public.sold_records;
DROP POLICY IF EXISTS "sold_records_delete_own" ON public.sold_records;

CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "sold_records_select_public"
  ON public.sold_records FOR SELECT
  USING (true);

CREATE POLICY "sold_records_insert_own"
  ON public.sold_records FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "sold_records_update_own"
  ON public.sold_records FOR UPDATE
  USING (auth.uid() = agent_id);

CREATE POLICY "sold_records_delete_own"
  ON public.sold_records FOR DELETE
  USING (auth.uid() = agent_id);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'property-images',
    'property-images',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
  ),
  (
    'verification-docs',
    'verification-docs',
    false,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Public read for listing photos (path: {user_id}/{filename})
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "property_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_delete" ON storage.objects;

CREATE POLICY "property_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "property_images_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "property_images_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "property_images_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "verification_docs_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "verification_docs_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "verification_docs_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "verification_docs_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
