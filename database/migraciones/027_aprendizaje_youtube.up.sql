-- Sprint 3: acceso de la app al aprendizaje, actividad y videos de YouTube.
-- Ejecutar con el mecanismo numerado de migraciones; nunca manualmente en Learnity.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '027') THEN
    RAISE EXCEPTION 'La migracion 027 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '026') THEN
    RAISE EXCEPTION 'La 027 necesita la 026.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE leccion ADD COLUMN youtube_video_id VARCHAR(11);
ALTER TABLE leccion ADD CONSTRAINT leccion_youtube_video_id_valido
  CHECK (youtube_video_id IS NULL OR
    (tipo = 'VIDEO' AND youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'));

ALTER TABLE inscripcion ADD COLUMN ultima_actividad_en TIMESTAMPTZ;
UPDATE inscripcion SET ultima_actividad_en = inscrito_en;
ALTER TABLE inscripcion ALTER COLUMN ultima_actividad_en SET NOT NULL;
ALTER TABLE inscripcion ALTER COLUMN ultima_actividad_en SET DEFAULT now();

CREATE INDEX inscripcion_curso_actividad_idx
  ON inscripcion (id_curso, inscrito_en DESC, id_inscripcion DESC);

GRANT SELECT, INSERT, UPDATE ON inscripcion, progreso_leccion TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('027', 'aprendizaje_youtube');
COMMIT;
