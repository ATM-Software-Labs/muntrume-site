-- 0009: perfiles públicos de piloto (opt-in, por defecto OCULTO). Rollback: Time Travel al bookmark previo
-- (SQLite/D1 permite DROP COLUMN, pero se prefiere restaurar el bookmark).
ALTER TABLE allowed_users ADD COLUMN public_visible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE allowed_users ADD COLUMN public_name TEXT;
ALTER TABLE allowed_users ADD COLUMN public_slug TEXT;
ALTER TABLE allowed_users ADD COLUMN public_bio TEXT;
ALTER TABLE allowed_users ADD COLUMN public_links TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_slug ON allowed_users(public_slug) WHERE public_slug IS NOT NULL;
