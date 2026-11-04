-- Muntrume Motorsport · D1 Database Schema
-- Driver Stats Cache & iRacing Auth Session Storage

CREATE TABLE IF NOT EXISTS driver_stats (
  id TEXT PRIMARY KEY,
  data TEXT,
  updated_at TEXT
);

-- Index for high-speed TTL lookups
CREATE INDEX IF NOT EXISTS idx_driver_stats_updated ON driver_stats(updated_at);
