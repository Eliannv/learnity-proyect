-- Reversion de la 028. Requiere desplegar antes el backend sin evaluaciones.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '028' THEN
    RAISE EXCEPTION 'La 028 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;
REVOKE SELECT, INSERT, UPDATE, DELETE ON evaluacion, pregunta, opcion FROM learnity_app;
REVOKE SELECT, INSERT ON intento_evaluacion, respuesta FROM learnity_app;
DELETE FROM schema_migraciones WHERE version = '028';
COMMIT;
