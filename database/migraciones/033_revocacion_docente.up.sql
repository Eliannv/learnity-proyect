-- Sprint 4 · panel de administración: revocación del rol docente (D3).
--   Una solicitud APROBADA puede pasar a REVOCADA: el administrador retira el rol DOCENTE e inactiva el perfil
--   docente, con motivo obligatorio. Quién, cuándo y por qué quedan en la propia solicitud (y en auditoria_cambio).
--   Los cursos publicados del docente siguen publicados; sin el rol ya no puede editarlos.
--   La persona puede volver a solicitar el rol: el índice de pendiente única (024) solo mira PENDIENTE.
-- Sin permisos nuevos: learnity_app ya actualiza solicitud_docente y docente y borra de usuario_rol (029).
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '033') THEN
    RAISE EXCEPTION 'La migracion 033 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '032') THEN
    RAISE EXCEPTION 'La 033 necesita la 032.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE solicitud_docente DROP CONSTRAINT solicitud_docente_estado_check;
ALTER TABLE solicitud_docente ADD CONSTRAINT solicitud_docente_estado_check
  CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'REVOCADA'));

ALTER TABLE solicitud_docente
  ADD COLUMN revocada_en        TIMESTAMPTZ,
  ADD COLUMN revocada_por       INTEGER REFERENCES persona (id_persona),
  ADD COLUMN motivo_revocacion  VARCHAR(300) CHECK (motivo_revocacion IS NULL OR length(btrim(motivo_revocacion)) > 0),
  ADD CONSTRAINT solicitud_revocada_completa CHECK (
    (estado = 'REVOCADA') = (revocada_en IS NOT NULL AND revocada_por IS NOT NULL AND motivo_revocacion IS NOT NULL));

COMMENT ON COLUMN solicitud_docente.motivo_revocacion IS
  'Por qué un administrador retiró el rol docente aprobado. La persona lo ve en su perfil y en el correo.';

INSERT INTO schema_migraciones (version, nombre)
VALUES ('033', 'revocacion_docente');
COMMIT;
