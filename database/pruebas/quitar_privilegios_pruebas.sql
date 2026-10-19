-- =====================================================================
-- Quita lo que concede privilegios_pruebas.sql (019b).
-- Ejecutar con postgres, conectado a la misma base _test.
-- Ojo: la pertenencia de learnity_app a learnity_pruebas es del servidor, así
-- que se quita para todas las bases _test.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'quitar_privilegios_pruebas.sql solo se aplica en bases _test (conectado a %).', current_database();
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM learnity_pruebas;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM learnity_pruebas;
RESET ROLE;

REVOKE learnity_pruebas FROM learnity_app;

COMMIT;
