-- Reversion de la 029.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '029' THEN
    RAISE EXCEPTION 'La 029 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;
REVOKE DELETE, UPDATE ON usuario_rol FROM learnity_app;
REVOKE UPDATE ON categoria FROM learnity_app;
DELETE FROM schema_migraciones WHERE version = '029';
COMMIT;
