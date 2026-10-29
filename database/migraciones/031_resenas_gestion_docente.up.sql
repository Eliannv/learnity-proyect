-- Sprint 4 · gestión de reseñas por el docente, moderación y analíticas.
--   1. Reseña con auditoría básica (nivel A): progreso del estudiante al publicarla, marca de edición,
--      borrado lógico y respuesta pública del docente. La app ya no puede borrar reseñas físicamente.
--   2. Historial (nivel B) sin tabla nueva: auditoria_cambio (020) ya guarda cada INSERT/UPDATE/DELETE de
--      resena con su autor. historial_resena() expone solo lo necesario (acción, estrellas, comentario).
--   3. Reportes de reseñas al administrador (spam, lenguaje ofensivo u otro motivo).
--   4. Vistas diarias de la ficha pública de cada curso, para la tasa de conversión.
-- No se guarda la IP: no se necesita para moderar y sería un dato personal más que proteger.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '031') THEN
    RAISE EXCEPTION 'La migracion 031 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '030') THEN
    RAISE EXCEPTION 'La 031 necesita la 030.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Reseña: nivel A de auditoría
ALTER TABLE resena
  ADD COLUMN progreso_al_resenar SMALLINT NOT NULL DEFAULT 0 CHECK (progreso_al_resenar BETWEEN 0 AND 100),
  ADD COLUMN editado_en          TIMESTAMPTZ,
  ADD COLUMN editado             BOOLEAN GENERATED ALWAYS AS (editado_en IS NOT NULL) STORED,
  ADD COLUMN eliminado_en        TIMESTAMPTZ,
  ADD COLUMN respuesta_docente   VARCHAR(1000) CHECK (respuesta_docente IS NULL OR length(btrim(respuesta_docente)) > 0),
  ADD COLUMN respondida_en       TIMESTAMPTZ,
  ADD CONSTRAINT resena_respuesta_fecha CHECK ((respuesta_docente IS NULL) = (respondida_en IS NULL));

COMMENT ON COLUMN resena.progreso_al_resenar IS 'Avance (%) del estudiante al publicar; no cambia si sigue avanzando.';
COMMENT ON COLUMN resena.eliminado_en IS 'Borrado lógico: no cuenta en promedios públicos, pero se conserva para reportes.';

-- Las reseñas que ya existían no guardaron su avance: se toma el actual como mejor aproximación.
UPDATE resena r SET progreso_al_resenar = i.progreso_pct
  FROM inscripcion i WHERE i.id_inscripcion = r.id_inscripcion;

-- Cambiar estrellas o comentario de una reseña publicada la marca como editada. Republicar una
-- reseña borrada no cuenta como edición: la app reinicia la marca al hacerlo.
CREATE FUNCTION resena_marcar_edicion() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  IF OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NULL
     AND (NEW.estrellas, NEW.comentario) IS DISTINCT FROM (OLD.estrellas, OLD.comentario) THEN
    NEW.editado_en := now();
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION resena_marcar_edicion() FROM PUBLIC;

CREATE TRIGGER marcar_edicion BEFORE UPDATE OF estrellas, comentario ON resena
  FOR EACH ROW EXECUTE FUNCTION resena_marcar_edicion();

-- Borrar es lógico: la app solo marca eliminado_en. La fila desaparece únicamente con su inscripción.
REVOKE DELETE ON resena FROM learnity_app;

-- 2. Historial (nivel B) a partir de auditoria_cambio
CREATE INDEX auditoria_cambio_resena_idx
  ON auditoria_cambio (((COALESCE(despues, antes) ->> 'id_resena')::INTEGER), cambiado_en)
  WHERE tabla = 'resena';

-- SECURITY DEFINER: la app sigue sin leer auditoria_cambio; solo obtiene la historia de las reseñas
-- pedidas y nunca el usuario de base de datos ni la transacción. El backend decide quién puede pedirla.
CREATE FUNCTION historial_resena(p_ids INTEGER[])
RETURNS TABLE (
  id_resena            INTEGER,
  accion               TEXT,
  id_persona_actor     INTEGER,
  fecha                TIMESTAMPTZ,
  estrellas_anterior   SMALLINT,
  estrellas_nueva      SMALLINT,
  comentario_anterior  TEXT,
  comentario_nuevo     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT h.id_resena, h.accion, h.id_persona_actor, h.cambiado_en,
         (h.antes ->> 'estrellas')::SMALLINT, (h.despues ->> 'estrellas')::SMALLINT,
         h.antes ->> 'comentario', h.despues ->> 'comentario'
    FROM (
      SELECT (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER AS id_resena,
             a.id_auditoria, a.id_persona_actor, a.cambiado_en, a.antes, a.despues,
             CASE
               WHEN a.operacion = 'INSERT' THEN 'CREADA'
               WHEN a.operacion = 'DELETE' THEN 'ELIMINADA'
               WHEN a.antes ->> 'eliminado_en' IS NULL AND a.despues ->> 'eliminado_en' IS NOT NULL THEN 'ELIMINADA'
               WHEN a.antes ->> 'eliminado_en' IS NOT NULL AND a.despues ->> 'eliminado_en' IS NULL THEN 'REPUBLICADA'
               WHEN (a.antes -> 'respuesta_docente') IS DISTINCT FROM (a.despues -> 'respuesta_docente')
                 THEN 'RESPONDIDA_POR_DOCENTE'
               WHEN (a.antes -> 'estrellas') IS DISTINCT FROM (a.despues -> 'estrellas')
                 OR (a.antes -> 'comentario') IS DISTINCT FROM (a.despues -> 'comentario') THEN 'EDITADA'
             END AS accion
        FROM public.auditoria_cambio a
       WHERE a.tabla = 'resena'
         AND (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER = ANY (p_ids)
    ) h
   WHERE h.accion IS NOT NULL
   ORDER BY h.id_resena, h.cambiado_en, h.id_auditoria
$fn$;
REVOKE EXECUTE ON FUNCTION historial_resena(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION historial_resena(INTEGER[]) TO learnity_app;

-- 3. Reportes al administrador: como mucho uno pendiente por reseña.
CREATE TABLE reporte_resena (
    id_reporte           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_resena            INTEGER      NOT NULL REFERENCES resena (id_resena) ON DELETE CASCADE,
    id_persona_reporta   INTEGER      NOT NULL REFERENCES persona (id_persona) ON DELETE CASCADE,
    motivo               VARCHAR(10)  NOT NULL CHECK (motivo IN ('SPAM', 'OFENSIVO', 'OTRO')),
    detalle              VARCHAR(500) CHECK (detalle IS NULL OR length(btrim(detalle)) > 0),
    estado               VARCHAR(11)  NOT NULL DEFAULT 'PENDIENTE'
                         CHECK (estado IN ('PENDIENTE', 'OCULTADA', 'DESESTIMADA')),
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resuelto_en          TIMESTAMPTZ,
    id_persona_resuelve  INTEGER      REFERENCES persona (id_persona) ON DELETE SET NULL,
    CONSTRAINT reporte_resena_resolucion CHECK ((estado = 'PENDIENTE') = (resuelto_en IS NULL))
);
CREATE UNIQUE INDEX reporte_resena_pendiente_uq ON reporte_resena (id_resena) WHERE estado = 'PENDIENTE';
CREATE INDEX reporte_resena_estado_idx ON reporte_resena (estado, creado_en);
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON reporte_resena
  FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

GRANT SELECT, INSERT, UPDATE ON reporte_resena TO learnity_app;
GRANT SELECT ON reporte_resena TO learnity_lectura;

-- 4. Vistas de la ficha pública: un contador por curso y día (sin datos de quien visita).
CREATE TABLE visita_curso_dia (
    id_curso  INTEGER NOT NULL REFERENCES curso (id_curso) ON DELETE CASCADE,
    dia       DATE    NOT NULL,
    visitas   INTEGER NOT NULL DEFAULT 1 CHECK (visitas > 0),
    PRIMARY KEY (id_curso, dia)
);

GRANT SELECT, INSERT, UPDATE ON visita_curso_dia TO learnity_app;
GRANT SELECT ON visita_curso_dia TO learnity_lectura;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('031', 'resenas_gestion_docente');

COMMIT;
