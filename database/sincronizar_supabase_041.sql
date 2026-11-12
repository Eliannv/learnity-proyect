-- =====================================================================
-- Sincronización idempotente de las migraciones 040 y 041 para Supabase
--
-- Para pegar en el SQL Editor de Supabase (usuario postgres). Se puede ejecutar
-- varias veces: solo crea o corrige lo que falte y no borra datos.
--
-- Corrige la causa del 500 en POST /api/resenas/{id}/respuestas: RLS activado
-- sin políticas o privilegios incompletos de learnity_app en resena_respuesta.
-- Al final muestra una fila de verificación: todas las columnas deben ser true.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ---------------------------------------------------------------- 040 · archivo_binario
CREATE TABLE IF NOT EXISTS public.archivo_binario (
  nombre    VARCHAR(120) PRIMARY KEY,
  bytes     BYTEA        NOT NULL,
  creado_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT archivo_binario_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT archivo_binario_bytes_no_vacios CHECK (octet_length(bytes) > 0)
);
ALTER TABLE public.archivo_binario DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archivo_binario TO learnity_app;

-- ---------------------------------------------------------------- 041 · 1. persona
ALTER TABLE public.persona
  ADD COLUMN IF NOT EXISTS pais             VARCHAR(60),
  ADD COLUMN IF NOT EXISTS provincia        VARCHAR(60),
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

ALTER TABLE public.persona DROP CONSTRAINT IF EXISTS persona_fecha_nacimiento_valida;
ALTER TABLE public.persona
  ADD CONSTRAINT persona_fecha_nacimiento_valida CHECK (
    fecha_nacimiento IS NULL
    OR (fecha_nacimiento >= DATE '1900-01-01' AND fecha_nacimiento <= CURRENT_DATE)
  );

-- ---------------------------------------------------------------- 041 · 2. token_recuperacion
ALTER TABLE public.token_recuperacion
  DROP CONSTRAINT IF EXISTS token_recuperacion_proposito_check,
  DROP CONSTRAINT IF EXISTS token_recuperacion_vigencia;

ALTER TABLE public.token_recuperacion
  ALTER COLUMN proposito TYPE VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nuevo_correo VARCHAR(120);

ALTER TABLE public.token_recuperacion
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

-- ---------------------------------------------------------------- 041 · 3. resena_respuesta
CREATE TABLE IF NOT EXISTS public.resena_respuesta (
  id_respuesta INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_resena    INTEGER       NOT NULL REFERENCES public.resena(id_resena) ON DELETE CASCADE,
  id_persona   INTEGER       NOT NULL REFERENCES public.persona(id_persona) ON DELETE CASCADE,
  comentario   VARCHAR(1000) NOT NULL CHECK (length(btrim(comentario)) > 0),
  creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  eliminado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_resena_respuesta_resena
  ON public.resena_respuesta (id_resena, creado_en ASC)
  WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_resena_respuesta_persona
  ON public.resena_respuesta (id_persona);

-- La causa del 500: Supabase puede activar RLS en tablas nuevas; sin políticas, el INSERT falla (42501).
ALTER TABLE public.resena_respuesta DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.resena_respuesta NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.resena_respuesta FROM PUBLIC;
-- Sin DELETE: el borrado es lógico (eliminado_en), como en la matriz de privilegios.
GRANT SELECT, INSERT, UPDATE ON public.resena_respuesta TO learnity_app;
-- La columna IDENTITY no necesita USAGE sobre su secuencia: PostgreSQL la usa implícitamente al insertar.
-- Si en Supabase la tabla se hubiera creado a mano con SERIAL, sí haría falta; se concede solo en ese caso.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'resena_respuesta'
                AND column_name = 'id_respuesta' AND is_identity = 'NO') THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO learnity_app',
                   pg_get_serial_sequence('public.resena_respuesta', 'id_respuesta'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_lectura') THEN
    GRANT SELECT ON public.resena_respuesta TO learnity_lectura;
    GRANT SELECT ON public.archivo_binario TO learnity_lectura;
  END IF;
  -- Auditoría como en el resto de tablas, solo si existe la función de la 020.
  IF to_regprocedure('public.auditoria_registrar()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger
                      WHERE tgrelid = 'public.resena_respuesta'::regclass
                        AND tgname = 'trg_auditoria_resena_respuesta') THEN
    CREATE TRIGGER trg_auditoria_resena_respuesta
      AFTER INSERT OR UPDATE OR DELETE ON public.resena_respuesta
      FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar();
  END IF;
  -- Mismo dueño que el resto del esquema, si postgres puede hacerlo.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_owner') THEN
    BEGIN
      ALTER TABLE public.resena_respuesta OWNER TO learnity_owner;
      ALTER TABLE public.archivo_binario OWNER TO learnity_owner;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No se pudo cambiar el dueño a learnity_owner; los GRANT ya bastan para learnity_app.';
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------- 041 · 4. reporte de curso
ALTER TABLE public.alerta_seguridad DROP CONSTRAINT IF EXISTS alerta_seguridad_tipo_check;
ALTER TABLE public.alerta_seguridad
  ADD CONSTRAINT alerta_seguridad_tipo_check
    CHECK (tipo IN ('INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA', 'REPORTE_CURSO'));

CREATE OR REPLACE FUNCTION public.registrar_reporte_curso(
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

REVOKE ALL ON FUNCTION public.registrar_reporte_curso(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_reporte_curso(INTEGER, INTEGER, TEXT) TO learnity_app;

-- ---------------------------------------------------------------- registro de versiones
INSERT INTO public.schema_migraciones (version, nombre)
SELECT v.version, v.nombre
  FROM (VALUES ('040', 'archivo_binario'), ('041', 'hilos_perfil_y_reportes')) AS v(version, nombre)
 WHERE NOT EXISTS (SELECT 1 FROM public.schema_migraciones s WHERE s.version = v.version);

COMMIT;

-- ---------------------------------------------------------------- verificación (todo debe ser true)
SELECT
  has_table_privilege('learnity_app', 'public.resena_respuesta', 'SELECT, INSERT, UPDATE') AS app_resena_respuesta,
  NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resena_respuesta'::regclass) AS resena_respuesta_sin_rls,
  has_table_privilege('learnity_app', 'public.archivo_binario', 'SELECT, INSERT, UPDATE, DELETE') AS app_archivo_binario,
  NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.archivo_binario'::regclass) AS archivo_binario_sin_rls,
  has_function_privilege('learnity_app', 'public.registrar_reporte_curso(integer,integer,text)', 'EXECUTE') AS app_reporte_curso,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'persona' AND column_name = 'pais') AS persona_pais,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'token_recuperacion' AND column_name = 'nuevo_correo') AS token_nuevo_correo;
