-- Storage RLS: property-images (unchanged logic, idempotent refresh) +
-- verification-docs: only admins can SELECT; agents keep upload/update/delete in own folder.
--
-- Path convention (required): {auth.uid()}/{filename}
--
-- Admin setup (pick ONE):
--   A) Supabase Dashboard → Authentication → Users → your user → User Management
--      Add to "App metadata":  { "role": "admin" }
--   B) Or replace the policy below with a fixed auth.uid() check (see comment).

-- ---------------------------------------------------------------------------
-- property-images (public read; authenticated write only under own uid folder)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "property_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "property_images_owner_delete" ON storage.objects;

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

-- ---------------------------------------------------------------------------
-- verification-docs (private bucket: admin-only read, owner write in own folder)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_docs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "verification_docs_owner_delete" ON storage.objects;

-- Agents can upload/update/delete only under {their_user_id}/...
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

-- Only users flagged as admin (app_metadata.role = 'admin') can list/download any object.
-- Set in Dashboard: Authentication → Users → App metadata → {"role":"admin"}
CREATE POLICY "verification_docs_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- Optional UUID-only admin (replace the SELECT policy above if you prefer):
-- USING (
--   bucket_id = 'verification-docs'
--   AND auth.role() = 'authenticated'
--   AND auth.uid() = 'YOUR-ADMIN-USER-UUID'::uuid
-- );
