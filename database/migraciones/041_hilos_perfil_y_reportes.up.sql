-- =====================================================================
-- 041 · Hilos en reseñas, campos de perfil, cambio de correo y reporte de curso (up)
--
-- 1. persona: añade pais, provincia y fecha_nacimiento.
-- 2. token_recuperacion: amplía proposito a VARCHAR(20), añade nuevo_correo
--    y habilita el propósito 'CAMBIO_CORREO' (vigencia de hasta 24 h).
-- 3. resena_respuesta: respuestas en hilo dentro de cada reseña (docente
--    titular y estudiantes inscritos del curso), con borrado lógico y auditoría.
-- 4. alerta_seguridad: añade tipo 'REPORTE_CURSO' y función SECURITY DEFINER
--    registrar_reporte_curso para que estudiantes autenticados reporten un
--    curso publicado al centro de alertas del administrador.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '041') THEN
    RAISE EXCEPTION 'La migración 041 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '040') THEN
    RAISE EXCEPTION 'La 041 necesita la 040 (archivo binario).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Nuevos campos de ubicación y fecha de nacimiento en persona.
ALTER TABLE persona
  ADD COLUMN pais             VARCHAR(60),
  ADD COLUMN provincia        VARCHAR(60),
  ADD COLUMN fecha_nacimiento DATE;

ALTER TABLE persona
  ADD CONSTRAINT persona_fecha_nacimiento_valida CHECK (
    fecha_nacimiento IS NULL
    OR (fecha_nacimiento >= DATE '1900-01-01' AND fecha_nacimiento <= CURRENT_DATE)
  );

-- 2. Cambio privado de correo mediante token de confirmación.
ALTER TABLE token_recuperacion
  DROP CONSTRAINT IF EXISTS token_recuperacion_proposito_check,
  DROP CONSTRAINT IF EXISTS token_recuperacion_vigencia;

ALTER TABLE token_recuperacion
  ALTER COLUMN proposito TYPE VARCHAR(20),
  ADD COLUMN nuevo_correo VARCHAR(120);

ALTER TABLE token_recuperacion
  ADD CONSTRAINT token_recuperacion_proposito_check
    CHECK (proposito IN ('RECUPERACION', 'INVITACION', 'CAMBIO_CORREO')),
  ADD CONSTRAINT token_recuperacion_vigencia CHECK (
    expira_en > creado_en
    AND (
      (proposito = 'RECUPERACION'  AND expira_en <= creado_en + INTERVAL '30 minutes')
      OR (proposito = 'INVITACION'    AND expira_en <= creado_en + INTERVAL '7 days')
      OR (proposito = 'CAMBIO_CORREO' AND expira_en <= creado_en + INTERVAL '24 hours' AND nuevo_correo IS NOT NULL)
    )
  );

-- 3. Hilos de respuestas y preguntas en reseñas de cursos.
CREATE TABLE resena_respuesta (
  id_respuesta INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_resena    INTEGER       NOT NULL REFERENCES resena(id_resena) ON DELETE CASCADE,
  id_persona   INTEGER       NOT NULL REFERENCES persona(id_persona) ON DELETE CASCADE,
  comentario   VARCHAR(1000) NOT NULL CHECK (length(btrim(comentario)) > 0),
  creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  eliminado_en TIMESTAMPTZ
);

CREATE INDEX idx_resena_respuesta_resena
  ON resena_respuesta (id_resena, creado_en ASC)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_resena_respuesta_persona
  ON resena_respuesta (id_persona);

CREATE TRIGGER trg_auditoria_resena_respuesta
  AFTER INSERT OR UPDATE OR DELETE ON resena_respuesta
  FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

REVOKE ALL ON resena_respuesta FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON resena_respuesta TO learnity_app;
GRANT SELECT                 ON resena_respuesta TO learnity_lectura;

-- 4. Reporte de curso por estudiantes hacia alertas de seguridad del admin.
ALTER TABLE alerta_seguridad
  DROP CONSTRAINT IF EXISTS alerta_seguridad_tipo_check;

ALTER TABLE alerta_seguridad
  ADD CONSTRAINT alerta_seguridad_tipo_check
    CHECK (tipo IN ('INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA', 'REPORTE_CURSO'));

CREATE OR REPLACE FUNCTION registrar_reporte_curso(
  p_id_usuario INTEGER,
  p_id_curso   INTEGER,
  p_motivo     TEXT
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_activo BOOLEAN;
  v_titulo VARCHAR(150);
  v_clave  VARCHAR(120);
  v_motivo TEXT := left(btrim(COALESCE(p_motivo, '')), 500);
BEGIN
  IF length(v_motivo) < 5 THEN
    RETURN 'MOTIVO_INVALIDO';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario u
     WHERE u.id_usuario = p_id_usuario
       AND u.estado = 'ACTIVO'
  ) INTO v_activo;

  IF NOT v_activo THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  SELECT c.titulo INTO v_titulo
    FROM public.curso c
   WHERE c.id_curso = p_id_curso
     AND c.estado = 'PUBLICADO';

  IF v_titulo IS NULL THEN
    RETURN 'NO_ENCONTRADO';
  END IF;

  v_clave := 'REPORTE_CURSO:' || p_id_curso || ':' || p_id_usuario;

  IF EXISTS (
    SELECT 1 FROM public.alerta_seguridad
     WHERE clave = v_clave
       AND atendida_en IS NULL
  ) THEN
    RETURN 'DUPLICADO';
  END IF;

  INSERT INTO public.alerta_seguridad (tipo, severidad, descripcion, id_usuario, evidencia, clave)
  VALUES (
    'REPORTE_CURSO',
    'MEDIA',
    left('Curso reportado («' || v_titulo || '»): ' || v_motivo, 300),
    p_id_usuario,
    jsonb_build_object(
      'auditoria', '[]'::jsonb,
      'accesos', '[]'::jsonb,
      'curso', p_id_curso,
      'cursoTitulo', v_titulo,
      'motivo', v_motivo
    ),
    v_clave
  )
  ON CONFLICT (clave) DO UPDATE
     SET severidad = 'MEDIA',
         descripcion = EXCLUDED.descripcion,
         evidencia = EXCLUDED.evidencia,
         detectada_en = now(),
         atendida_en = NULL,
         atendida_por = NULL,
         nota = NULL;

  RETURN 'REGISTRADO';
END;
$$;

REVOKE ALL ON FUNCTION registrar_reporte_curso(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_reporte_curso(INTEGER, INTEGER, TEXT) TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('041', 'hilos_perfil_y_reportes');

COMMIT;
