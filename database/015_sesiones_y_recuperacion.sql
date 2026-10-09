-- =====================================================================
-- 015 · Sesiones (refresh tokens) y recuperación de contraseña · Sprint 1
--
-- Ejecutar UNA vez en pgAdmin (Query Tool sobre la base de Learnity) con la
-- cuenta dueña de las tablas (la que ejecutó learnity_esquema.sql), NO con
-- learnity_app. Es seguro repetirlo: no duplica tablas ni permisos.
--
-- Ninguna tabla guarda tokens en claro: solo su hash SHA-256 (64 hex).
-- =====================================================================

BEGIN;

-- Una fila por refresh token emitido. Los tokens de una misma sesión comparten
-- "familia": al refrescar, el token usado se marca como reemplazado y se emite
-- otro en la misma familia (rotación). Si alguien presenta un token ya
-- reemplazado, se revoca la familia completa (posible robo del token).
CREATE TABLE IF NOT EXISTS sesion (
    id_sesion          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario         INTEGER     NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    familia            UUID        NOT NULL,
    token_hash         CHAR(64)    NOT NULL UNIQUE,
    iniciada_en        TIMESTAMPTZ NOT NULL,              -- inicio de la familia (límite absoluto)
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en          TIMESTAMPTZ NOT NULL,
    reemplazado_en     TIMESTAMPTZ,                       -- rotado por un token nuevo
    revocado_en        TIMESTAMPTZ,
    motivo_revocacion  VARCHAR(20)
                       CHECK (motivo_revocacion IN ('CIERRE', 'REUTILIZACION', 'CAMBIO_CONTRASENA',
                                                    'RESTABLECIMIENTO', 'CUENTA_INACTIVA')),
    ip                 VARCHAR(45),
    agente             VARCHAR(200),
    CHECK (expira_en > creado_en),
    CHECK ((revocado_en IS NULL) = (motivo_revocacion IS NULL))
);

CREATE INDEX IF NOT EXISTS sesion_familia_idx ON sesion (familia);
CREATE INDEX IF NOT EXISTS sesion_usuario_activa_idx ON sesion (id_usuario) WHERE revocado_en IS NULL;

-- Enlaces de recuperación: aleatorios, de un solo uso y con vencimiento corto.
CREATE TABLE IF NOT EXISTS token_recuperacion (
    id_token    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INTEGER     NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    token_hash  CHAR(64)    NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en   TIMESTAMPTZ NOT NULL,
    usado_en    TIMESTAMPTZ,                              -- usado o invalidado por uno más reciente
    ip          VARCHAR(45),
    CHECK (expira_en > creado_en AND expira_en <= creado_en + INTERVAL '30 minutes')
);

CREATE INDEX IF NOT EXISTS token_recuperacion_usuario_idx ON token_recuperacion (id_usuario, creado_en);

-- El backend (learnity_app) lee y modifica datos; no cambia la estructura.
GRANT SELECT, INSERT, UPDATE, DELETE ON sesion, token_recuperacion TO learnity_app;

COMMIT;

-- Comprobación (debe devolver 2 filas con privilegios para learnity_app):
-- SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type)
--   FROM information_schema.role_table_grants
--  WHERE grantee = 'learnity_app' AND table_name IN ('sesion', 'token_recuperacion')
--  GROUP BY table_name;
