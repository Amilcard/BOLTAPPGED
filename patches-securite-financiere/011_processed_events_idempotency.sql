CREATE TABLE IF NOT EXISTS gd_processed_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processed_events_event_id ON gd_processed_events (event_id);

ALTER TABLE gd_processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON gd_processed_events
  FOR ALL USING (auth.role() = 'service_role');
