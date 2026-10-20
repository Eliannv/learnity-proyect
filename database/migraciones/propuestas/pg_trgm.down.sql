-- =====================================================================
-- PROPUESTA, sin número · pg_trgm (down)
-- Borra los índices. Borra la extensión solo si la creó el up.
-- Requiere superusuario.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_ultima TEXT;
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'El down de pg_trgm requiere un superusuario (postgres).';
  END IF;
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM 'pg_trgm' THEN
    RAISE EXCEPTION 'No se puede revertir pg_trgm en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;
DROP INDEX curso_titulo_trgm_idx;
DROP INDEX curso_subtitulo_trgm_idx;
DROP INDEX curso_descripcion_trgm_idx;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT (reversion ->> 'extension_creada')::BOOLEAN FROM schema_migraciones WHERE version = 'pg_trgm') THEN
    DROP EXTENSION pg_trgm;
  END IF;
END $$;

DELETE FROM schema_migraciones WHERE version = 'pg_trgm';

COMMIT;
