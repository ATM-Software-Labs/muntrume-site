-- 0008: preferencias de correo por piloto (enlace firmado, sin login). Aditiva: no toca tablas existentes.
-- Rollback: DROP TABLE email_prefs;  (o restaurar el bookmark de Time Travel tomado antes de aplicarla)
CREATE TABLE IF NOT EXISTS email_prefs (
  email       TEXT PRIMARY KEY,
  new_setups  INTEGER NOT NULL DEFAULT 1,
  team_news   INTEGER NOT NULL DEFAULT 1,
  tz          TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
