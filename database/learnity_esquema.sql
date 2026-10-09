-- =====================================================================
-- Learnity · Plataforma de cursos en línea
-- Esquema de base de datos · PostgreSQL 17
-- 19 tablas agrupadas por módulo del backend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Módulo Identidad
-- ---------------------------------------------------------------------
CREATE TABLE persona (
    id_persona   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombres      VARCHAR(80)  NOT NULL,
    apellidos    VARCHAR(80)  NOT NULL,
    ciudad       VARCHAR(60),
    biografia    TEXT,
    foto_url     VARCHAR(255),
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
    id_usuario         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_persona         INTEGER      NOT NULL UNIQUE REFERENCES persona (id_persona),
    correo             VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash    VARCHAR(60)  NOT NULL,
    estado             VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO'
                       CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    intentos_fallidos  SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta    TIMESTAMPTZ,
    ultimo_acceso      TIMESTAMPTZ
);

CREATE TABLE rol (
    id_rol  SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  VARCHAR(20) NOT NULL UNIQUE
            CHECK (nombre IN ('ESTUDIANTE', 'DOCENTE', 'ADMIN'))
);

CREATE TABLE usuario_rol (
    id_usuario    INTEGER     NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    id_rol        SMALLINT    NOT NULL REFERENCES rol (id_rol),
    asignado_por  INTEGER     REFERENCES persona (id_persona),
    asignado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_usuario, id_rol)
);

CREATE TABLE solicitud_docente (
    id_solicitud  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_persona    INTEGER      NOT NULL REFERENCES persona (id_persona),
    especialidad  VARCHAR(100) NOT NULL,
    motivo        TEXT         NOT NULL CHECK (char_length(motivo) >= 50),
    estado        VARCHAR(10)  NOT NULL DEFAULT 'PENDIENTE'
                  CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    observacion   VARCHAR(300),
    revisada_por  INTEGER      REFERENCES persona (id_persona),
    enviada_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revisada_en   TIMESTAMPTZ
);

CREATE TABLE docente (
    id_docente    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_persona    INTEGER      NOT NULL UNIQUE REFERENCES persona (id_persona),
    especialidad  VARCHAR(100) NOT NULL,
    estado        VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO'
                  CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    aprobado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Módulo Cursos
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
    id_categoria  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(80)  NOT NULL UNIQUE,
    descripcion   VARCHAR(300),
    activa        BOOLEAN      NOT NULL DEFAULT TRUE,
    creada_por    INTEGER      NOT NULL REFERENCES persona (id_persona),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE curso (
    id_curso        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_docente      INTEGER      NOT NULL REFERENCES docente (id_docente),
    id_categoria    INTEGER      NOT NULL REFERENCES categoria (id_categoria),
    titulo          VARCHAR(150) NOT NULL,
    subtitulo       VARCHAR(200),
    descripcion     TEXT,
    nivel           VARCHAR(12)  NOT NULL DEFAULT 'PRINCIPIANTE'
                    CHECK (nivel IN ('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO')),
    portada_url     VARCHAR(255),
    objetivos       TEXT[]       NOT NULL DEFAULT '{}',
    requisitos      TEXT[]       NOT NULL DEFAULT '{}',
    estado          VARCHAR(12)  NOT NULL DEFAULT 'BORRADOR'
                    CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'PUBLICADO', 'RECHAZADO', 'ARCHIVADO')),
    motivo_rechazo  VARCHAR(300),
    revisado_por    INTEGER      REFERENCES persona (id_persona),
    publicado_en    TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT curso_rechazo_con_motivo
        CHECK (estado <> 'RECHAZADO' OR motivo_rechazo IS NOT NULL)
);

CREATE TABLE modulo (
    id_modulo  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_curso   INTEGER      NOT NULL REFERENCES curso (id_curso) ON DELETE CASCADE,
    titulo     VARCHAR(150) NOT NULL,
    orden      SMALLINT     NOT NULL CHECK (orden BETWEEN 1 AND 10),
    UNIQUE (id_curso, orden)
);

-- ---------------------------------------------------------------------
-- Módulo Contenido
-- ---------------------------------------------------------------------
CREATE TABLE archivo (
    id_archivo       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_curso         INTEGER      NOT NULL REFERENCES curso (id_curso) ON DELETE CASCADE,
    tipo             VARCHAR(5)   NOT NULL CHECK (tipo IN ('VIDEO', 'PDF', 'PPT')),
    nombre_original  VARCHAR(200) NOT NULL,
    ruta             VARCHAR(255) NOT NULL UNIQUE,
    tamano_bytes     INTEGER      NOT NULL CHECK (tamano_bytes > 0),
    alto_px          SMALLINT,
    duracion_seg     INTEGER,
    CONSTRAINT archivo_limite_tamano CHECK (
        (tipo = 'VIDEO' AND tamano_bytes <= 5242880) OR
        (tipo IN ('PDF', 'PPT') AND tamano_bytes <= 10485760)
    ),
    CONSTRAINT archivo_video_480p CHECK (
        (tipo = 'VIDEO' AND alto_px IS NOT NULL AND alto_px <= 480) OR
        (tipo <> 'VIDEO' AND alto_px IS NULL)
    )
);

-- (lección va después de archivo porque apunta a su archivo principal)
CREATE TABLE leccion (
    id_leccion    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_modulo     INTEGER      NOT NULL REFERENCES modulo (id_modulo) ON DELETE CASCADE,
    id_archivo    INTEGER      UNIQUE REFERENCES archivo (id_archivo),
    titulo        VARCHAR(150) NOT NULL,
    tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('VIDEO', 'DOCUMENTO', 'EVALUACION')),
    orden         SMALLINT     NOT NULL CHECK (orden BETWEEN 1 AND 12),
    vista_previa  BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (id_modulo, orden),
    CONSTRAINT leccion_evaluacion_sin_archivo CHECK (tipo <> 'EVALUACION' OR id_archivo IS NULL)
);

CREATE TABLE recurso_adjunto (
    id_recurso  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_leccion  INTEGER      NOT NULL REFERENCES leccion (id_leccion) ON DELETE CASCADE,
    id_archivo  INTEGER      NOT NULL UNIQUE REFERENCES archivo (id_archivo) ON DELETE CASCADE,
    titulo      VARCHAR(150) NOT NULL
);

-- ---------------------------------------------------------------------
-- Módulo Aprendizaje
-- ---------------------------------------------------------------------
CREATE TABLE inscripcion (
    id_inscripcion     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_persona         INTEGER     NOT NULL REFERENCES persona (id_persona),
    id_curso           INTEGER     NOT NULL REFERENCES curso (id_curso),
    estado             VARCHAR(10) NOT NULL DEFAULT 'ACTIVA'
                       CHECK (estado IN ('ACTIVA', 'COMPLETADA')),
    progreso_pct       SMALLINT    NOT NULL DEFAULT 0 CHECK (progreso_pct BETWEEN 0 AND 100),
    id_ultima_leccion  INTEGER     REFERENCES leccion (id_leccion) ON DELETE SET NULL,
    inscrito_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completado_en      TIMESTAMPTZ,
    UNIQUE (id_persona, id_curso)
);

CREATE TABLE progreso_leccion (
    id_progreso      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inscripcion   INTEGER NOT NULL REFERENCES inscripcion (id_inscripcion) ON DELETE CASCADE,
    id_leccion       INTEGER NOT NULL REFERENCES leccion (id_leccion) ON DELETE CASCADE,
    segundos_vistos  INTEGER NOT NULL DEFAULT 0 CHECK (segundos_vistos >= 0),
    completada       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (id_inscripcion, id_leccion)
);

-- ---------------------------------------------------------------------
-- Módulo Evaluaciones
-- ---------------------------------------------------------------------
CREATE TABLE evaluacion (
    id_evaluacion          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_leccion             INTEGER  NOT NULL UNIQUE REFERENCES leccion (id_leccion) ON DELETE CASCADE,
    porcentaje_aprobacion  SMALLINT NOT NULL DEFAULT 60 CHECK (porcentaje_aprobacion BETWEEN 1 AND 100)
);

CREATE TABLE pregunta (
    id_pregunta    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_evaluacion  INTEGER      NOT NULL REFERENCES evaluacion (id_evaluacion) ON DELETE CASCADE,
    enunciado      VARCHAR(300) NOT NULL,
    orden          SMALLINT     NOT NULL CHECK (orden BETWEEN 1 AND 10),
    UNIQUE (id_evaluacion, orden)
);

CREATE TABLE opcion (
    id_opcion    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pregunta  INTEGER      NOT NULL REFERENCES pregunta (id_pregunta) ON DELETE CASCADE,
    letra        CHAR(1)      NOT NULL CHECK (letra IN ('A', 'B', 'C', 'D')),
    texto        VARCHAR(200) NOT NULL,
    es_correcta  BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (id_pregunta, letra)
);

-- Solo una opción correcta por pregunta
CREATE UNIQUE INDEX opcion_una_correcta ON opcion (id_pregunta) WHERE es_correcta;

CREATE TABLE intento_evaluacion (
    id_intento      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inscripcion  INTEGER      NOT NULL REFERENCES inscripcion (id_inscripcion) ON DELETE CASCADE,
    id_evaluacion   INTEGER      NOT NULL REFERENCES evaluacion (id_evaluacion) ON DELETE CASCADE,
    puntaje         NUMERIC(5,2) NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
    aprobado        BOOLEAN      NOT NULL,
    realizado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE respuesta (
    id_respuesta  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_intento    INTEGER NOT NULL REFERENCES intento_evaluacion (id_intento) ON DELETE CASCADE,
    id_pregunta   INTEGER NOT NULL REFERENCES pregunta (id_pregunta) ON DELETE CASCADE,
    id_opcion     INTEGER NOT NULL REFERENCES opcion (id_opcion) ON DELETE CASCADE,
    UNIQUE (id_intento, id_pregunta)
);

-- ---------------------------------------------------------------------
-- Índices para las búsquedas más frecuentes
-- ---------------------------------------------------------------------
CREATE INDEX curso_catalogo_idx      ON curso (estado, id_categoria);
CREATE INDEX curso_docente_idx       ON curso (id_docente);
CREATE INDEX modulo_curso_idx        ON modulo (id_curso);
CREATE INDEX archivo_curso_idx       ON archivo (id_curso);
CREATE INDEX inscripcion_curso_idx   ON inscripcion (id_curso);
CREATE INDEX intento_inscripcion_idx ON intento_evaluacion (id_inscripcion, id_evaluacion);

-- ---------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------
INSERT INTO rol (nombre) VALUES ('ESTUDIANTE'), ('DOCENTE'), ('ADMIN');
