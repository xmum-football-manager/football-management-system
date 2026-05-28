ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS knockout_qualifiers uuid[] DEFAULT NULL;
