-- Reversion de la 032. Requiere desplegar antes el backend sin registro de accesos ni invitaciones.
-- Se niega si hay accesos registrados, sesiones cerradas por un administrador o enlaces de invitación:
-- revertir perdería el registro o dejaría filas que los CHECK anteriores no admiten.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '032' THEN
    RAISE EXCEPTION 'La 032 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM evento_acceso) THEN
    RAISE EXCEPTION 'Hay accesos registrados en evento_acceso: revertir la 032 perderia ese registro.';
  END IF;
  IF EXISTS (SELECT 1 FROM sesion WHERE motivo_revocacion = 'ADMIN') THEN
    RAISE EXCEPTION 'Hay sesiones cerradas por un administrador (motivo ADMIN): la 031 no admite ese motivo.';
  END IF;
  IF EXISTS (SELECT 1 FROM token_recuperacion WHERE proposito = 'INVITACION') THEN
    RAISE EXCEPTION 'Hay enlaces de invitacion en token_recuperacion: la 031 no admite enlaces de mas de 30 minutos.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE token_recuperacion DROP CONSTRAINT token_recuperacion_vigencia;
ALTER TABLE token_recuperacion DROP COLUMN proposito;
ALTER TABLE token_recuperacion ADD CONSTRAINT token_recuperacion_check
  CHECK (expira_en > creado_en AND expira_en <= creado_en + INTERVAL '30 minutes');

ALTER TABLE sesion DROP CONSTRAINT sesion_motivo_revocacion_check;
ALTER TABLE sesion ADD CONSTRAINT sesion_motivo_revocacion_check CHECK (motivo_revocacion IN
  ('CIERRE', 'REUTILIZACION', 'CAMBIO_CONTRASENA', 'RESTABLECIMIENTO', 'CUENTA_INACTIVA'));

DROP TABLE evento_acceso;

DELETE FROM schema_migraciones WHERE version = '032';
COMMIT;
