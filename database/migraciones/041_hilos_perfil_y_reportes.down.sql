-- =====================================================================
-- 041 · Hilos en reseñas, campos de perfil, cambio de correo y reporte de curso (down)
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '041') THEN
    RAISE EXCEPTION 'La migración 041 no está aplicada en %.', current_database();
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP FUNCTION IF EXISTS registrar_reporte_curso(INTEGER, INTEGER, TEXT);

DELETE FROM alerta_seguridad WHERE tipo = 'REPORTE_CURSO';

ALTER TABLE alerta_seguridad
  DROP CONSTRAINT IF EXISTS alerta_seguridad_tipo_check;

ALTER TABLE alerta_seguridad
  ADD CONSTRAINT alerta_seguridad_tipo_check
    CHECK (tipo IN ('INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA'));

DROP TABLE IF EXISTS resena_respuesta;

DELETE FROM token_recuperacion WHERE proposito = 'CAMBIO_CORREO';

ALTER TABLE token_recuperacion
  DROP CONSTRAINT IF EXISTS token_recuperacion_vigencia,
  DROP CONSTRAINT IF EXISTS token_recuperacion_proposito_check;

ALTER TABLE token_recuperacion
  DROP COLUMN IF EXISTS nuevo_correo,
  ALTER COLUMN proposito TYPE VARCHAR(12);

ALTER TABLE token_recuperacion
  ADD CONSTRAINT token_recuperacion_proposito_check
    CHECK (proposito IN ('RECUPERACION', 'INVITACION')),
  ADD CONSTRAINT token_recuperacion_vigencia CHECK (
    expira_en > creado_en AND (
      (proposito = 'RECUPERACION' AND expira_en <= creado_en + INTERVAL '30 minutes')
      OR (proposito = 'INVITACION' AND expira_en <= creado_en + INTERVAL '7 days')
    )
  );

ALTER TABLE persona
  DROP CONSTRAINT IF EXISTS persona_fecha_nacimiento_valida,
  DROP COLUMN IF EXISTS fecha_nacimiento,
  DROP COLUMN IF EXISTS provincia,
  DROP COLUMN IF EXISTS pais;

DELETE FROM schema_migraciones WHERE version = '041';

COMMIT;
