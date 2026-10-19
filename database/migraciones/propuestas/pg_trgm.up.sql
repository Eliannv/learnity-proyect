-- =====================================================================
-- PROPUESTA, sin número · pg_trgm para la búsqueda del catálogo (up)
--
-- D9 = A: pg_trgm es una dependencia candidata. Esta migración NO se aplica ni
-- recibe número hasta que el usuario apruebe el ADR-010 en la Puerta 1. Si se
-- aprueba, se renombra a 0NN_pg_trgm.{up,down}.sql y se cambia 'pg_trgm' por
-- '0NN' en los dos archivos.
--
-- Problema: la búsqueda q usa ILIKE '%texto%' sobre titulo, subtitulo y
-- descripcion, y recorre la tabla completa. Un índice GIN con gin_trgm_ops
-- sirve para LIKE e ILIKE con comodines a los dos lados.
-- A través de catalogo_curso, descripcion es COALESCE(c.descripcion, ''): se
-- indexa esa expresión, porque un índice sobre la columna cruda no serviría
-- para la vista.
-- Requiere superusuario para crear la extensión (es "trusted" desde PG13, pero
-- learnity_owner no tiene CREATE sobre la base).
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'pg_trgm requiere un superusuario (postgres) para crear la extensión.';
  END IF;
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = 'pg_trgm') THEN
    RAISE EXCEPTION 'La migración pg_trgm ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'pg_trgm necesita la 018 (roles y dueños).';
  END IF;
END $$;

INSERT INTO schema_migraciones (version, nombre, reversion)
SELECT 'pg_trgm', 'pg_trgm (propuesta)',
       jsonb_build_object('extension_creada', NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'));

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

SET LOCAL ROLE learnity_owner;

CREATE INDEX curso_titulo_trgm_idx      ON curso USING gin (titulo gin_trgm_ops);
CREATE INDEX curso_subtitulo_trgm_idx   ON curso USING gin (subtitulo gin_trgm_ops);
CREATE INDEX curso_descripcion_trgm_idx ON curso USING gin ((COALESCE(descripcion, '')) gin_trgm_ops);

COMMIT;
