-- Eventos/carreras del equipo gestionados por admin (solo fechas reales introducidas por un admin).
CREATE TABLE IF NOT EXISTS team_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,          -- ISO 8601 UTC
  ends_at TEXT,                     -- ISO 8601 UTC (opcional; por defecto +2 h)
  track TEXT,
  car_class TEXT,
  url TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_team_events_start ON team_events(starts_at);
