-- Sprint 4 · panel de administración: registro de accesos, revocación de sesiones e invitaciones.
--   1. evento_acceso: un registro por intento de entrar a una cuenta. Pasos CLAVE y RECUPERACION, con
--      éxitos y fallos; REFRESH solo con fallos (cada renovación correcta ya está en `sesion`, D4).
--      No se guarda la IP (fuera de alcance). La app solo añade filas: ni las edita ni las borra.
--   2. sesion.motivo_revocacion admite ADMIN: un administrador cerró la sesión.
--   3. token_recuperacion.proposito: los enlaces de INVITACION (alta de una cuenta por el
--      administrador, D1) valen 72 horas; los de RECUPERACION siguen limitados a 30 minutos.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '032') THEN
    RAISE EXCEPTION 'La migracion 032 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '031') THEN
    RAISE EXCEPTION 'La 032 necesita la 031.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Registro de accesos
CREATE TABLE evento_acceso (
    id_evento    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario   INTEGER      REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    correo       VARCHAR(120),
    paso         VARCHAR(12)  NOT NULL CHECK (paso IN ('CLAVE', 'REFRESH', 'RECUPERACION')),
    exito        BOOLEAN      NOT NULL,
    motivo       VARCHAR(20)  NOT NULL CHECK (motivo IN ('OK', 'CLAVE_INCORRECTA', 'CUENTA_BLOQUEADA',
                              'CUENTA_INACTIVA', 'CORREO_DESCONOCIDO', 'TOKEN_REUTILIZADO', 'TOKEN_INVALIDO')),
    agente       VARCHAR(200),
    ocurrido_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT evento_acceso_exito_ok CHECK (exito = (motivo = 'OK')),
    CONSTRAINT evento_acceso_refresh_fallido CHECK (paso <> 'REFRESH' OR NOT exito)
);

COMMENT ON TABLE evento_acceso IS
  'Intentos de entrar a una cuenta. correo es el escrito (en minúsculas), aunque la cuenta no exista; '
  'id_usuario queda NULL si no existe o si se borra. Sin IP.';

CREATE INDEX evento_acceso_fecha_idx   ON evento_acceso (ocurrido_en DESC, id_evento DESC);
CREATE INDEX evento_acceso_usuario_idx ON evento_acceso (id_usuario, ocurrido_en DESC);
CREATE INDEX evento_acceso_fallido_idx ON evento_acceso (ocurrido_en DESC, id_evento DESC) WHERE NOT exito;

GRANT SELECT, INSERT ON evento_acceso TO learnity_app;
GRANT SELECT ON evento_acceso TO learnity_lectura;

-- 2. Sesiones cerradas por un administrador
ALTER TABLE sesion DROP CONSTRAINT sesion_motivo_revocacion_check;
ALTER TABLE sesion ADD CONSTRAINT sesion_motivo_revocacion_check CHECK (motivo_revocacion IN
  ('CIERRE', 'REUTILIZACION', 'CAMBIO_CONTRASENA', 'RESTABLECIMIENTO', 'CUENTA_INACTIVA', 'ADMIN'));

-- 3. Enlaces de invitación
ALTER TABLE token_recuperacion
  ADD COLUMN proposito VARCHAR(12) NOT NULL DEFAULT 'RECUPERACION'
             CHECK (proposito IN ('RECUPERACION', 'INVITACION'));
ALTER TABLE token_recuperacion DROP CONSTRAINT token_recuperacion_check;
ALTER TABLE token_recuperacion ADD CONSTRAINT token_recuperacion_vigencia CHECK (
  expira_en > creado_en AND expira_en <= creado_en +
    CASE proposito WHEN 'INVITACION' THEN INTERVAL '72 hours' ELSE INTERVAL '30 minutes' END);

INSERT INTO schema_migraciones (version, nombre)
VALUES ('032', 'accesos_y_sesiones');
COMMIT;
