-- Reversion de la 038. Requiere desplegar antes el backend sin alertas de seguridad.
-- Se niega si hay alertas atendidas: guardan quién las revisó y su nota, que no se pueden reconstruir.
-- Las pendientes se pierden, pero analizar_alertas_seguridad() las volvería a encontrar en la auditoría.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '038' THEN
    RAISE EXCEPTION 'La 038 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM alerta_seguridad WHERE atendida_en IS NOT NULL) THEN
    RAISE EXCEPTION 'Hay alertas de seguridad atendidas: se perderian su revision y su nota. No se revierte la 038.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP FUNCTION analizar_alertas_seguridad(TIMESTAMPTZ);
DROP TABLE alerta_seguridad;

DELETE FROM schema_migraciones WHERE version = '038';
COMMIT;
