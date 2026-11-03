-- Reversion de la 040.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '040' THEN
    RAISE EXCEPTION 'La 040 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP TABLE archivo_binario;

DELETE FROM schema_migraciones WHERE version = '040';
COMMIT;
