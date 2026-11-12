-- =====================================================================
-- Sincronización idempotente de la migración 042 para Supabase
--
-- Para pegar en el SQL Editor de Supabase (usuario postgres), DESPUÉS de
-- sincronizar_supabase_041.sql. Se puede ejecutar varias veces y no borra datos.
--
-- 1. solicitud_docente: la motivación exige 20 caracteres (antes 50). Sin esto,
--    una solicitud de 20 a 49 caracteres pasa la validación de la API y la base
--    la rechaza.
-- 2. resena_respuesta: ocultada_en / ocultada_por para que el administrador
--    oculte y restaure respuestas del hilo.
-- 3. historial_hilo_resena: eventos del hilo para el «Historial completo».
-- Al final muestra una fila de verificación: todas las columnas deben ser true.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. Motivación docente: mínimo 20 caracteres.
ALTER TABLE public.solicitud_docente DROP CONSTRAINT IF EXISTS solicitud_docente_motivo_check;
ALTER TABLE public.solicitud_docente
  ADD CONSTRAINT solicitud_docente_motivo_check CHECK (char_length(motivo) >= 20);

-- 2. Ocultación de respuestas del hilo.
ALTER TABLE public.resena_respuesta
  ADD COLUMN IF NOT EXISTS ocultada_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ocultada_por INTEGER REFERENCES public.persona(id_persona) ON DELETE SET NULL;

ALTER TABLE public.resena_respuesta DROP CONSTRAINT IF EXISTS resena_respuesta_ocultacion_completa;
ALTER TABLE public.resena_respuesta
  ADD CONSTRAINT resena_respuesta_ocultacion_completa CHECK (ocultada_en IS NOT NULL OR ocultada_por IS NULL);

-- 3. Historial del hilo desde la auditoría (misma definición que la migración 042).
CREATE OR REPLACE FUNCTION public.historial_hilo_resena(p_ids INTEGER[])
RETURNS TABLE (
  id_resena        INTEGER,
  id_respuesta     INTEGER,
  accion           TEXT,
  id_persona_actor INTEGER,
  fecha            TIMESTAMPTZ,
  comentario       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT h.id_resena, h.id_respuesta, h.accion, h.id_persona_actor, h.cambiado_en, h.comentario
    FROM (
      SELECT (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER    AS id_resena,
             (COALESCE(a.despues, a.antes) ->> 'id_respuesta')::INTEGER AS id_respuesta,
             a.id_auditoria, a.cambiado_en,
             COALESCE(a.despues, a.antes) ->> 'comentario' AS comentario,
             CASE
               WHEN a.operacion = 'INSERT' THEN 'HILO_PUBLICADA'
               WHEN a.antes ->> 'ocultada_en' IS NULL AND a.despues ->> 'ocultada_en' IS NOT NULL THEN 'HILO_OCULTADA'
               WHEN a.antes ->> 'ocultada_en' IS NOT NULL AND a.despues ->> 'ocultada_en' IS NULL THEN 'HILO_RESTAURADA'
               WHEN a.antes ->> 'eliminado_en' IS NULL AND a.despues ->> 'eliminado_en' IS NOT NULL THEN 'HILO_ELIMINADA'
             END AS accion,
             -- Sin actor en la auditoría (p. ej. un script), se atribuye al autor de la respuesta o a quien la ocultó.
             COALESCE(
               a.id_persona_actor,
               CASE
                 WHEN a.operacion = 'INSERT' THEN (a.despues ->> 'id_persona')::INTEGER
                 WHEN a.antes ->> 'ocultada_en' IS NULL AND a.despues ->> 'ocultada_en' IS NOT NULL
                   THEN (a.despues ->> 'ocultada_por')::INTEGER
               END
             ) AS id_persona_actor
        FROM public.auditoria_cambio a
       WHERE a.tabla = 'resena_respuesta'
         AND a.operacion IN ('INSERT', 'UPDATE')
         AND (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER = ANY (p_ids)
    ) h
   WHERE h.accion IS NOT NULL
   ORDER BY h.id_resena, h.cambiado_en, h.id_auditoria
$fn$;
REVOKE EXECUTE ON FUNCTION public.historial_hilo_resena(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historial_hilo_resena(INTEGER[]) TO learnity_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_owner') THEN
    BEGIN
      ALTER FUNCTION public.historial_hilo_resena(INTEGER[]) OWNER TO learnity_owner;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No se pudo cambiar el dueño de historial_hilo_resena; el GRANT ya basta para learnity_app.';
    END;
  END IF;
END $$;

INSERT INTO public.schema_migraciones (version, nombre)
SELECT '042', 'moderacion_hilos_y_motivo_docente'
 WHERE NOT EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '042');

COMMIT;

-- ---------------------------------------------------------------- verificación (todo debe ser true)
SELECT
  (SELECT pg_get_constraintdef(oid) LIKE '%>= 20%' FROM pg_constraint
    WHERE conname = 'solicitud_docente_motivo_check')                                   AS motivo_20_caracteres,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'resena_respuesta' AND column_name = 'ocultada_en') AS hilo_ocultable,
  has_table_privilege('learnity_app', 'public.resena_respuesta', 'SELECT, INSERT, UPDATE')         AS app_resena_respuesta,
  has_function_privilege('learnity_app', 'public.historial_hilo_resena(integer[])', 'EXECUTE')     AS app_historial_hilo;
