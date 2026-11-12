-- =====================================================================
-- 042 · Moderación de hilos en reseñas y motivo docente de 20 caracteres (down)
--
-- Las solicitudes con una motivación de 20 a 49 caracteres no cumplirían el
-- CHECK antiguo: el down se detiene antes de tocar nada si existe alguna.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '042') THEN
    RAISE EXCEPTION 'La migración 042 no está aplicada en %.', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM solicitud_docente WHERE char_length(motivo) < 50) THEN
    RAISE EXCEPTION 'Hay solicitudes docentes con menos de 50 caracteres de motivación; el down de la 042 no puede restaurar el CHECK.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP FUNCTION IF EXISTS historial_hilo_resena(INTEGER[]);

ALTER TABLE resena_respuesta
  DROP CONSTRAINT IF EXISTS resena_respuesta_ocultacion_completa,
  DROP COLUMN IF EXISTS ocultada_por,
  DROP COLUMN IF EXISTS ocultada_en;

ALTER TABLE solicitud_docente DROP CONSTRAINT solicitud_docente_motivo_check;
ALTER TABLE solicitud_docente
  ADD CONSTRAINT solicitud_docente_motivo_check CHECK (char_length(motivo) >= 50);

DELETE FROM schema_migraciones WHERE version = '042';
COMMIT;
