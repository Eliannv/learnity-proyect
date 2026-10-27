-- Reversion de Sprint 3. Requiere desplegar antes el backend anterior.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '027' THEN
    RAISE EXCEPTION 'La 027 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;
REVOKE INSERT, UPDATE ON inscripcion FROM learnity_app;
REVOKE SELECT, INSERT, UPDATE ON progreso_leccion FROM learnity_app;
DROP INDEX inscripcion_curso_actividad_idx;
ALTER TABLE inscripcion DROP COLUMN ultima_actividad_en;
ALTER TABLE leccion DROP CONSTRAINT leccion_youtube_video_id_valido;
ALTER TABLE leccion DROP COLUMN youtube_video_id;
DELETE FROM schema_migraciones WHERE version = '027';
COMMIT;
