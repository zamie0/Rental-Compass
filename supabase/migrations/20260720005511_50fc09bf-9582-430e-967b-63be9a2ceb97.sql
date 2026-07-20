
CREATE TABLE public.property_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  position integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX property_photos_property_id_idx ON public.property_photos(property_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_photos TO authenticated;
GRANT ALL ON public.property_photos TO service_role;

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own property photos" ON public.property_photos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Ensure at most one cover per property
CREATE UNIQUE INDEX property_photos_one_cover_idx
  ON public.property_photos(property_id) WHERE is_cover = true;

-- Storage RLS: authenticated users manage their own folder inside property-photos bucket
-- Folder convention: <user_id>/<property_id>/<uuid>.<ext>
CREATE POLICY "Users read own property photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own property photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own property photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own property photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
