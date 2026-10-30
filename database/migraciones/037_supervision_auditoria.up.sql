-- Sprint 4 · panel de administración: visor de auditoría y salud de la base.
--   learnity_app sigue sin permisos sobre auditoria_cambio (decisión de la 020). El panel la consulta con funciones
--   SECURITY DEFINER de learnity_owner, como historial_resena (031):
--     · auditoria_listar: página filtrada (como mucho 100 filas por llamada) con la clave del registro y el actor.
--     · auditoria_detalle: una fila con su transacción y los datos antes y después (el diff lo calcula el frontend).
--     · auditoria_opciones: tablas, roles de base de datos y actores que aparecen, para los desplegables.
--     · estado_base_datos: versión, tamaño, conexiones a esta base, arranque del servidor y última migración.
--   Reglas: search_path fijo, nombres calificados, sin SQL dinámico (los filtros son parámetros tipados) y EXECUTE
--   solo para learnity_app. Quién puede llamarlas lo decide el backend (autorizar('ADMIN')).
--   Índice por fecha: el visor ordena por cambiado_en DESC sin filtro de tabla.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '037') THEN
    RAISE EXCEPTION 'La migracion 037 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '036') THEN
    RAISE EXCEPTION 'La 037 necesita la 036.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE INDEX auditoria_cambio_fecha_idx ON auditoria_cambio (cambiado_en DESC, id_auditoria DESC);

-- Clave legible del registro auditado (la de su clave primaria). NULL en una tabla que no se conoce.
CREATE FUNCTION auditoria_registro(p_tabla TEXT, p_fila JSONB) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT CASE p_tabla
           WHEN 'persona'           THEN p_fila ->> 'id_persona'
           WHEN 'usuario'           THEN p_fila ->> 'id_usuario'
           WHEN 'rol'               THEN p_fila ->> 'id_rol'
           WHEN 'usuario_rol'       THEN concat_ws(',', p_fila ->> 'id_usuario', p_fila ->> 'id_rol')
           WHEN 'solicitud_docente' THEN p_fila ->> 'id_solicitud'
           WHEN 'docente'           THEN p_fila ->> 'id_docente'
           WHEN 'categoria'         THEN p_fila ->> 'id_categoria'
           WHEN 'curso'             THEN p_fila ->> 'id_curso'
           WHEN 'modulo'            THEN p_fila ->> 'id_modulo'
           WHEN 'leccion'           THEN p_fila ->> 'id_leccion'
           WHEN 'archivo'           THEN p_fila ->> 'id_archivo'
           WHEN 'recurso_adjunto'   THEN p_fila ->> 'id_recurso'
           WHEN 'resena'            THEN p_fila ->> 'id_resena'
           WHEN 'reporte_resena'    THEN p_fila ->> 'id_reporte'
         END
$fn$;
REVOKE EXECUTE ON FUNCTION auditoria_registro(TEXT, JSONB) FROM PUBLIC;

-- Página del visor, de la más reciente a la más antigua. NULL en un filtro = sin filtrar; p_hasta es exclusivo.
-- total es el número de filas que cumplen los filtros (el mismo en cada fila devuelta).
CREATE FUNCTION auditoria_listar(
  p_tabla TEXT, p_operacion TEXT, p_usuario_bd TEXT, p_id_persona INTEGER,
  p_desde TIMESTAMPTZ, p_hasta TIMESTAMPTZ, p_limite INTEGER, p_offset INTEGER)
RETURNS TABLE (
  id_auditoria        BIGINT,
  tabla               TEXT,
  operacion           TEXT,
  registro            TEXT,
  id_persona_actor    INTEGER,
  actor               TEXT,
  actor_correo        TEXT,
  usuario_bd          TEXT,
  cambiado_en         TIMESTAMPTZ,
  columnas_cambiadas  TEXT[],
  total               BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT f.id_auditoria, f.tabla::TEXT, f.operacion::TEXT,
         public.auditoria_registro(f.tabla, COALESCE(f.despues, f.antes)),
         f.id_persona_actor, NULLIF(concat_ws(' ', p.nombres, p.apellidos), ''), u.correo::TEXT,
         f.usuario_bd, f.cambiado_en, f.columnas_cambiadas, f.total
    FROM (
      SELECT a.*, count(*) OVER () AS total
        FROM public.auditoria_cambio a
       WHERE (p_tabla IS NULL OR a.tabla = p_tabla)
         AND (p_operacion IS NULL OR a.operacion = p_operacion)
         AND (p_usuario_bd IS NULL OR a.usuario_bd = p_usuario_bd)
         AND (p_id_persona IS NULL OR a.id_persona_actor = p_id_persona)
         AND (p_desde IS NULL OR a.cambiado_en >= p_desde)
         AND (p_hasta IS NULL OR a.cambiado_en < p_hasta)
       ORDER BY a.cambiado_en DESC, a.id_auditoria DESC
       LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 100)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) f
    LEFT JOIN public.persona p ON p.id_persona = f.id_persona_actor
    LEFT JOIN public.usuario u ON u.id_persona = f.id_persona_actor
   ORDER BY f.cambiado_en DESC, f.id_auditoria DESC
$fn$;
REVOKE EXECUTE ON FUNCTION auditoria_listar(TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auditoria_listar(TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO learnity_app;

-- Un registro con todo lo necesario para el diff. Sin filas si no existe.
CREATE FUNCTION auditoria_detalle(p_id BIGINT)
RETURNS TABLE (
  id_auditoria        BIGINT,
  tabla               TEXT,
  operacion           TEXT,
  registro            TEXT,
  id_persona_actor    INTEGER,
  actor               TEXT,
  actor_correo        TEXT,
  usuario_bd          TEXT,
  cambiado_en         TIMESTAMPTZ,
  id_transaccion      BIGINT,
  columnas_cambiadas  TEXT[],
  antes               JSONB,
  despues             JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT a.id_auditoria, a.tabla::TEXT, a.operacion::TEXT,
         public.auditoria_registro(a.tabla, COALESCE(a.despues, a.antes)),
         a.id_persona_actor, NULLIF(concat_ws(' ', p.nombres, p.apellidos), ''), u.correo::TEXT,
         a.usuario_bd, a.cambiado_en, a.id_transaccion, a.columnas_cambiadas, a.antes, a.despues
    FROM public.auditoria_cambio a
    LEFT JOIN public.persona p ON p.id_persona = a.id_persona_actor
    LEFT JOIN public.usuario u ON u.id_persona = a.id_persona_actor
   WHERE a.id_auditoria = p_id
$fn$;
REVOKE EXECUTE ON FUNCTION auditoria_detalle(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auditoria_detalle(BIGINT) TO learnity_app;

-- Valores para los desplegables: tablas, roles de base de datos y actores (los 500 más recientes).
CREATE FUNCTION auditoria_opciones()
RETURNS TABLE (tipo TEXT, valor TEXT, etiqueta TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT o.tipo, o.valor, o.etiqueta FROM (
    SELECT 'tabla' AS tipo, t.tabla::TEXT AS valor, t.tabla::TEXT AS etiqueta, 1 AS grupo
      FROM (SELECT DISTINCT a.tabla FROM public.auditoria_cambio a) t
    UNION ALL
    SELECT 'usuario_bd', r.usuario_bd, r.usuario_bd, 2
      FROM (SELECT DISTINCT a.usuario_bd FROM public.auditoria_cambio a) r
    UNION ALL
    SELECT 'actor', x.id_persona_actor::TEXT,
           COALESCE(NULLIF(concat_ws(' ', p.nombres, p.apellidos), ''), 'Persona ' || x.id_persona_actor), 3
      FROM (SELECT a.id_persona_actor, max(a.cambiado_en) AS ultimo
              FROM public.auditoria_cambio a
             WHERE a.id_persona_actor IS NOT NULL
             GROUP BY a.id_persona_actor
             ORDER BY ultimo DESC
             LIMIT 500) x
      LEFT JOIN public.persona p ON p.id_persona = x.id_persona_actor
  ) o
  ORDER BY o.grupo, o.etiqueta
$fn$;
REVOKE EXECUTE ON FUNCTION auditoria_opciones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auditoria_opciones() TO learnity_app;

-- Salud de la base. Solo cuenta las conexiones de pg_stat_activity: no lee su consulta ni su estado.
CREATE FUNCTION estado_base_datos()
RETURNS TABLE (
  version           TEXT,
  tamano_bytes      BIGINT,
  conexiones        INTEGER,
  iniciada_en       TIMESTAMPTZ,
  ultima_migracion  TEXT,
  aplicada_en       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT current_setting('server_version'),
         pg_database_size(current_database()),
         (SELECT count(*)::INTEGER FROM pg_stat_activity s WHERE s.datname = current_database()),
         pg_postmaster_start_time(),
         m.version || '_' || m.nombre,
         m.aplicada_en
    FROM (SELECT 1) uno
    LEFT JOIN LATERAL (
      SELECT sm.version::TEXT, sm.nombre::TEXT, sm.aplicada_en
        FROM public.schema_migraciones sm
       ORDER BY sm.orden DESC
       LIMIT 1) m ON TRUE
$fn$;
REVOKE EXECUTE ON FUNCTION estado_base_datos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION estado_base_datos() TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('037', 'supervision_auditoria');
COMMIT;
