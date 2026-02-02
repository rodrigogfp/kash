-- Create public bucket for bank logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-logos',
  'bank-logos',
  true,
  1048576, -- 1MB max per logo
  ARRAY['image/svg+xml', 'image/png', 'image/webp']
);

-- RLS: Public read access for all logos
CREATE POLICY "bank_logos_public_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'bank-logos');

-- RLS: Only service role can upload/update/delete
CREATE POLICY "bank_logos_insert_service" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'bank-logos' AND public.is_service_role());

CREATE POLICY "bank_logos_update_service" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'bank-logos' AND public.is_service_role());

CREATE POLICY "bank_logos_delete_service" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'bank-logos' AND public.is_service_role());