-- =====================================================================
-- 042 · Moderación de hilos en reseñas y motivo docente de 20 caracteres (up)
--
-- 1. solicitud_docente: la motivación pasa a exigir 20 caracteres (antes 50),
--    igual que el formulario de la primera solicitud y el de especialidad
--    adicional.
-- 2. resena_respuesta: el administrador oculta y restaura respuestas del hilo
--    (ocultada_en, ocultada_por) en lugar de borrarlas; la trazabilidad queda.
-- 3. historial_hilo_resena: eventos del hilo leídos de auditoria_cambio
--    (publicada, ocultada, restaurada, eliminada) para el historial completo.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '042') THEN
    RAISE EXCEPTION 'La migración 042 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '041') THEN
    RAISE EXCEPTION 'La 042 necesita la 041 (hilos en reseñas).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Motivación de la solicitud docente: mínimo 20 caracteres.
ALTER TABLE solicitud_docente DROP CONSTRAINT solicitud_docente_motivo_check;
ALTER TABLE solicitud_docente
  ADD CONSTRAINT solicitud_docente_motivo_check CHECK (char_length(motivo) >= 20);

-- 2. Ocultación de respuestas del hilo por moderación.
ALTER TABLE resena_respuesta
  ADD COLUMN ocultada_en  TIMESTAMPTZ,
  ADD COLUMN ocultada_por INTEGER REFERENCES persona(id_persona) ON DELETE SET NULL;

ALTER TABLE resena_respuesta
  ADD CONSTRAINT resena_respuesta_ocultacion_completa CHECK (ocultada_en IS NOT NULL OR ocultada_por IS NULL);

-- 3. Historial del hilo de cada reseña, desde la auditoría (learnity_app no lee auditoria_cambio).
CREATE FUNCTION historial_hilo_resena(p_ids INTEGER[])
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
REVOKE EXECUTE ON FUNCTION historial_hilo_resena(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION historial_hilo_resena(INTEGER[]) TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('042', 'moderacion_hilos_y_motivo_docente');
COMMIT;
