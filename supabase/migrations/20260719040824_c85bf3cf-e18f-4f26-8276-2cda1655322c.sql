
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS furnished text,
  ADD COLUMN IF NOT EXISTS parking boolean,
  ADD COLUMN IF NOT EXISTS pet_friendly boolean,
  ADD COLUMN IF NOT EXISTS internet boolean,
  ADD COLUMN IF NOT EXISTS facilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS agent_name text,
  ADD COLUMN IF NOT EXISTS agent_phone text;
