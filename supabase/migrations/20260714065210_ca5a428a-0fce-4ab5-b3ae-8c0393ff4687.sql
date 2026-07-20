
-- Stage + decision enums
CREATE TYPE public.property_stage AS ENUM ('interested','contacted','viewing_scheduled','deciding','archived');
CREATE TYPE public.property_decision AS ENUM ('none','accepted','rejected');

-- Properties
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  listing_url TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  monthly_rent NUMERIC(10,2) NOT NULL DEFAULT 0,
  security_deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  utilities_estimate NUMERIC(10,2) NOT NULL DEFAULT 0,
  stage public.property_stage NOT NULL DEFAULT 'interested',
  decision public.property_decision NOT NULL DEFAULT 'none',
  viewing_at TIMESTAMPTZ,
  notes TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own properties" ON public.properties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX properties_user_stage_idx ON public.properties(user_id, stage, position);

-- Checklist items
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checklist" ON public.checklist_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX checklist_property_idx ON public.checklist_items(property_id, position);

-- Commute targets
CREATE TABLE public.commute_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commute_targets TO authenticated;
GRANT ALL ON public.commute_targets TO service_role;
ALTER TABLE public.commute_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own commute targets" ON public.commute_targets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-seed default checklist on property insert
CREATE OR REPLACE FUNCTION public.seed_default_checklist() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  items TEXT[] := ARRAY[
    'Water pressure (kitchen & bath)',
    'Natural light throughout the day',
    'Check for mold or damp smells',
    'Test all window latches & locks',
    'Cell signal in every room',
    'Noise level from street',
    'Noise from neighbors',
    'Heating & AC working',
    'Kitchen appliances functional',
    'Outlets in each room',
    'Storage & closet space',
    'Building entrance security'
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(items,1) LOOP
    INSERT INTO public.checklist_items(property_id, user_id, label, position)
    VALUES (NEW.id, NEW.user_id, items[i], i);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER properties_seed_checklist AFTER INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_checklist();
