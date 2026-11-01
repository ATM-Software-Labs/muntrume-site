-- Turno 7: acceso por código, revocación de sesiones, panel admin, registro de descargas.
-- Aditiva: el Worker anterior sigue funcionando con este esquema.
ALTER TABLE allowed_users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE allowed_users ADD COLUMN last_login_at TEXT;
ALTER TABLE allowed_users ADD COLUMN team TEXT;
ALTER TABLE allowed_users ADD COLUMN car_class TEXT;
ALTER TABLE allowed_users ADD COLUMN photo TEXT;
CREATE TABLE IF NOT EXISTS login_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, nonce TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS download_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), email TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, files INTEGER NOT NULL DEFAULT 1, ip_hash TEXT);
CREATE INDEX IF NOT EXISTS idx_dl_email ON download_log(email, at);
CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), admin_email TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS idx_audit_at ON admin_audit(at);
