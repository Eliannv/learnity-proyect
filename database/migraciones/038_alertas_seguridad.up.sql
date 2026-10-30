-- Sprint 4 · panel de administración: alertas de seguridad.
--   1. alerta_seguridad: un hallazgo por fila, con su severidad, la cuenta implicada y la evidencia
--      ({"auditoria": [id_auditoria...], "accesos": [id_evento...]}). `clave` es única: repetir el análisis
--      no duplica hallazgos. Atender una alerta (fecha, administrador y nota) queda auditado.
--   2. analizar_alertas_seguridad(p_desde): SECURITY DEFINER de learnity_owner. Revisa evento_acceso y
--      auditoria_cambio desde p_desde (por defecto, 24 horas; como mucho, 31 días) y crea las alertas nuevas.
--      Si un hallazgo pendiente crece (más intentos, más cambios), se actualiza su severidad y su evidencia.
--      Devuelve cuántas alertas nuevas creó. Reglas (umbrales fijos aquí):
--        · INTENTOS_FALLIDOS: ≥ 5 fallos de contraseña sobre una cuenta en 15 minutos → MEDIA;
--          ≥ 10, o se siguió intentando con la cuenta ya bloqueada (motivo CUENTA_BLOQUEADA) → ALTA.
--          El bloqueo llega al 5.º fallo seguido y evento_acceso solo registra los intentos posteriores.
--        · CAMBIO_PRIVILEGIOS: alta o baja de ADMIN o DOCENTE en usuario_rol → ALTA si es ADMIN; DOCENTE: MEDIA,
--          o BAJA si en la misma transacción se aprobó su solicitud (el flujo normal).
--        · RAFAGA_RESENAS: un mismo actor hace ≥ 5 cambios en resena en 10 minutos → MEDIA.
--        · MODIFICACION_MASIVA: un mismo actor (o el mismo rol de la base sin actor) hace ≥ 20 cambios o ≥ 3 DELETE
--          en 10 minutos en curso, modulo, leccion o recurso_adjunto de un curso publicado → MEDIA; ALTA con DELETE.
--          Solo cuentan los cambios hechos después de publicarlo (o sobre un curso que ya estaba publicado):
--          lo que el docente editó mientras era borrador no es una modificación de un curso publicado.
--      Una ráfaga es un grupo de cambios separados por menos que la ventana; se identifica por su primer registro.
--   3. learnity_app: SELECT, UPDATE solo de (atendida_en, atendida_por, nota) y EXECUTE de la función. Sin INSERT
--      ni DELETE: un fallo del backend no puede fabricar ni borrar alertas.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '038') THEN
    RAISE EXCEPTION 'La migracion 038 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '037') THEN
    RAISE EXCEPTION 'La 038 necesita la 037.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE TABLE alerta_seguridad (
    id_alerta     BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo          VARCHAR(20)  NOT NULL CHECK (tipo IN
                  ('INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA')),
    severidad     VARCHAR(5)   NOT NULL CHECK (severidad IN ('ALTA', 'MEDIA', 'BAJA')),
    descripcion   VARCHAR(300) NOT NULL CHECK (length(btrim(descripcion)) > 0),
    id_usuario    INTEGER      REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    evidencia     JSONB        NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(evidencia) = 'object'),
    clave         VARCHAR(120) NOT NULL UNIQUE,
    detectada_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atendida_en   TIMESTAMPTZ,
    atendida_por  INTEGER      REFERENCES persona (id_persona) ON DELETE SET NULL,
    nota          VARCHAR(300) CHECK (nota IS NULL OR length(btrim(nota)) > 0),
    CONSTRAINT alerta_seguridad_atencion CHECK (atendida_en IS NOT NULL OR (atendida_por IS NULL AND nota IS NULL))
);
COMMENT ON TABLE alerta_seguridad IS
  'Hallazgos de analizar_alertas_seguridad(). La app solo los lee y los marca como atendidos.';
COMMENT ON COLUMN alerta_seguridad.evidencia IS '{"auditoria": [id_auditoria], "accesos": [id_evento]}';

CREATE INDEX alerta_seguridad_pendiente_idx ON alerta_seguridad (detectada_en DESC) WHERE atendida_en IS NULL;
CREATE INDEX alerta_seguridad_fecha_idx ON alerta_seguridad (detectada_en DESC, id_alerta DESC);
CREATE INDEX alerta_seguridad_usuario_idx ON alerta_seguridad (id_usuario);
CREATE INDEX alerta_seguridad_atendida_por_idx ON alerta_seguridad (atendida_por);

CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON alerta_seguridad
  FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

CREATE FUNCTION analizar_alertas_seguridad(p_desde TIMESTAMPTZ) RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  v_desde  TIMESTAMPTZ := GREATEST(COALESCE(p_desde, now() - INTERVAL '24 hours'), now() - INTERVAL '31 days');
  v_nuevas INTEGER;
BEGIN
  WITH
  -- ------------------------------------------------------------------ INTENTOS_FALLIDOS
  fallos AS (
    SELECT e.id_evento, e.id_usuario, e.ocurrido_en, e.motivo,
           CASE WHEN e.ocurrido_en - lag(e.ocurrido_en) OVER (PARTITION BY e.id_usuario ORDER BY e.ocurrido_en, e.id_evento)
                     <= INTERVAL '15 minutes' THEN 0 ELSE 1 END AS inicio
      FROM public.evento_acceso e
     WHERE e.paso = 'CLAVE' AND NOT e.exito AND e.id_usuario IS NOT NULL AND e.ocurrido_en >= v_desde
  ),
  fallos_r AS (
    SELECT f.*, sum(f.inicio) OVER (PARTITION BY f.id_usuario ORDER BY f.ocurrido_en, f.id_evento) AS rafaga,
           count(*) OVER (PARTITION BY f.id_usuario ORDER BY f.ocurrido_en
                          RANGE BETWEEN CURRENT ROW AND INTERVAL '15 minutes' FOLLOWING) AS en_ventana
      FROM fallos f
  ),
  intentos AS (
    SELECT 'INTENTOS_FALLIDOS'::TEXT AS tipo,
           CASE WHEN max(r.en_ventana) >= 10 OR bool_or(r.motivo = 'CUENTA_BLOQUEADA') THEN 'ALTA' ELSE 'MEDIA' END AS severidad,
           format('%s intentos fallidos de inicio de sesión en la cuenta %s (hasta %s en 15 minutos)%s.',
                  count(*), u.correo, max(r.en_ventana),
                  CASE WHEN bool_or(r.motivo = 'CUENTA_BLOQUEADA')
                       THEN '; se siguió intentando con la cuenta bloqueada' ELSE '' END) AS descripcion,
           r.id_usuario,
           jsonb_build_object('accesos', (array_agg(r.id_evento ORDER BY r.ocurrido_en, r.id_evento))[1:50]) AS evidencia,
           'INTENTOS_FALLIDOS:' || r.id_usuario || ':' || min(r.id_evento) AS clave
      FROM fallos_r r
      JOIN public.usuario u ON u.id_usuario = r.id_usuario
     GROUP BY r.id_usuario, r.rafaga, u.correo
    HAVING max(r.en_ventana) >= 5
  ),
  -- ------------------------------------------------------------------ CAMBIO_PRIVILEGIOS
  roles_cambiados AS (
    SELECT a.id_auditoria, a.id_transaccion, a.id_persona_actor, a.usuario_bd, x.accion,
           x.id_usuario, r.nombre AS rol
      FROM public.auditoria_cambio a
     CROSS JOIN LATERAL (
       SELECT 'alta' AS accion, (a.despues ->> 'id_usuario')::INTEGER AS id_usuario, (a.despues ->> 'id_rol')::INTEGER AS id_rol
        WHERE a.operacion IN ('INSERT', 'UPDATE')
          AND (a.operacion = 'INSERT' OR (a.antes ->> 'id_rol') IS DISTINCT FROM (a.despues ->> 'id_rol'))
       UNION ALL
       SELECT 'baja', (a.antes ->> 'id_usuario')::INTEGER, (a.antes ->> 'id_rol')::INTEGER
        WHERE a.operacion IN ('DELETE', 'UPDATE')
          AND (a.operacion = 'DELETE' OR (a.antes ->> 'id_rol') IS DISTINCT FROM (a.despues ->> 'id_rol'))
     ) x
      JOIN public.rol r ON r.id_rol = x.id_rol AND r.nombre IN ('ADMIN', 'DOCENTE')
     WHERE a.tabla = 'usuario_rol' AND a.cambiado_en >= v_desde
  ),
  -- Solicitudes de docente aprobadas: el rol concedido en la misma transacción es el flujo normal.
  aprobaciones AS (
    SELECT b.id_transaccion, min(b.id_auditoria) AS id_auditoria
      FROM public.auditoria_cambio b
     WHERE b.tabla = 'solicitud_docente' AND b.cambiado_en >= v_desde - INTERVAL '1 minute'
       AND b.despues ->> 'estado' = 'APROBADA' AND b.antes ->> 'estado' IS DISTINCT FROM 'APROBADA'
     GROUP BY b.id_transaccion
  ),
  privilegios AS (
    SELECT 'CAMBIO_PRIVILEGIOS'::TEXT AS tipo,
           CASE WHEN c.rol = 'ADMIN' THEN 'ALTA' WHEN s.id_auditoria IS NOT NULL THEN 'BAJA' ELSE 'MEDIA' END AS severidad,
           left(format('Se %s el rol %s a %s%s.',
                       CASE c.accion WHEN 'alta' THEN 'concedió' ELSE 'retiró' END, c.rol,
                       COALESCE(NULLIF(concat_ws(' ', pu.nombres, pu.apellidos), ''), 'la cuenta ' || c.id_usuario),
                       CASE WHEN s.id_auditoria IS NOT NULL THEN ' al aprobar su solicitud de docente'
                            WHEN c.id_persona_actor IS NULL THEN ' sin actor registrado (rol de la base: ' || c.usuario_bd || ')'
                            ELSE ' (lo hizo ' || COALESCE(NULLIF(concat_ws(' ', pa.nombres, pa.apellidos), ''),
                                                          'la persona ' || c.id_persona_actor) || ')' END), 300) AS descripcion,
           u.id_usuario,
           jsonb_build_object('auditoria', to_jsonb(array_remove(ARRAY[c.id_auditoria, s.id_auditoria], NULL))) AS evidencia,
           'CAMBIO_PRIVILEGIOS:' || c.id_auditoria || ':' || c.accion AS clave
      FROM roles_cambiados c
      LEFT JOIN public.usuario u ON u.id_usuario = c.id_usuario
      LEFT JOIN public.persona pu ON pu.id_persona = u.id_persona
      LEFT JOIN public.persona pa ON pa.id_persona = c.id_persona_actor
      LEFT JOIN aprobaciones s ON c.rol = 'DOCENTE' AND c.accion = 'alta' AND s.id_transaccion = c.id_transaccion
  ),
  -- ------------------------------------------------------------------ RAFAGA_RESENAS
  cambios_resena AS (
    SELECT a.id_auditoria, a.id_persona_actor, a.cambiado_en,
           CASE WHEN a.cambiado_en - lag(a.cambiado_en) OVER (PARTITION BY a.id_persona_actor ORDER BY a.cambiado_en, a.id_auditoria)
                     <= INTERVAL '10 minutes' THEN 0 ELSE 1 END AS inicio
      FROM public.auditoria_cambio a
     WHERE a.tabla = 'resena' AND a.id_persona_actor IS NOT NULL AND a.cambiado_en >= v_desde
  ),
  cambios_resena_r AS (
    SELECT c.*, sum(c.inicio) OVER (PARTITION BY c.id_persona_actor ORDER BY c.cambiado_en, c.id_auditoria) AS rafaga,
           count(*) OVER (PARTITION BY c.id_persona_actor ORDER BY c.cambiado_en
                          RANGE BETWEEN CURRENT ROW AND INTERVAL '10 minutes' FOLLOWING) AS en_ventana
      FROM cambios_resena c
  ),
  resenas AS (
    SELECT 'RAFAGA_RESENAS'::TEXT AS tipo, 'MEDIA'::TEXT AS severidad,
           left(format('%s cambios en reseñas de %s (hasta %s en 10 minutos).', count(*),
                       COALESCE(NULLIF(concat_ws(' ', p.nombres, p.apellidos), ''), 'la persona ' || r.id_persona_actor),
                       max(r.en_ventana)), 300) AS descripcion,
           u.id_usuario,
           jsonb_build_object('auditoria', (array_agg(r.id_auditoria ORDER BY r.cambiado_en, r.id_auditoria))[1:50]) AS evidencia,
           'RAFAGA_RESENAS:' || r.id_persona_actor || ':' || min(r.id_auditoria) AS clave
      FROM cambios_resena_r r
      LEFT JOIN public.persona p ON p.id_persona = r.id_persona_actor
      LEFT JOIN public.usuario u ON u.id_persona = r.id_persona_actor
     GROUP BY r.id_persona_actor, r.rafaga, p.nombres, p.apellidos, u.id_usuario
    HAVING max(r.en_ventana) >= 5
  ),
  -- ------------------------------------------------------------------ MODIFICACION_MASIVA
  filas_contenido AS MATERIALIZED (
    SELECT a.id_auditoria, a.id_persona_actor, a.usuario_bd, a.cambiado_en, a.operacion, a.tabla, a.antes,
           COALESCE(a.despues, a.antes) AS fila
      FROM public.auditoria_cambio a
     WHERE a.tabla IN ('curso', 'modulo', 'leccion', 'recurso_adjunto') AND a.cambiado_en >= v_desde
  ),
  -- Curso de cada módulo y módulo de cada lección, también de los borrados en la ventana (su fila auditada).
  modulo_curso AS (
    SELECT DISTINCT ON (t.id_modulo) t.id_modulo, t.id_curso
      FROM (SELECT m.id_modulo, m.id_curso FROM public.modulo m
            UNION ALL
            SELECT (f.fila ->> 'id_modulo')::INTEGER, (f.fila ->> 'id_curso')::INTEGER
              FROM filas_contenido f WHERE f.tabla = 'modulo') t
     ORDER BY t.id_modulo
  ),
  leccion_modulo AS (
    SELECT DISTINCT ON (t.id_leccion) t.id_leccion, t.id_modulo
      FROM (SELECT l.id_leccion, l.id_modulo FROM public.leccion l
            UNION ALL
            SELECT (f.fila ->> 'id_leccion')::INTEGER, (f.fila ->> 'id_modulo')::INTEGER
              FROM filas_contenido f WHERE f.tabla = 'leccion') t
     ORDER BY t.id_leccion
  ),
  contenido AS (
    SELECT f.id_auditoria, f.id_persona_actor, f.usuario_bd, f.cambiado_en, f.operacion, f.tabla, f.antes,
           COALESCE(f.id_persona_actor::TEXT, 'bd:' || f.usuario_bd) AS quien,
           CASE WHEN f.tabla IN ('curso', 'modulo') THEN (f.fila ->> 'id_curso')::INTEGER ELSE mc.id_curso END AS id_curso
      FROM filas_contenido f
      LEFT JOIN leccion_modulo lm
             ON f.tabla = 'recurso_adjunto' AND lm.id_leccion = (f.fila ->> 'id_leccion')::INTEGER
      LEFT JOIN modulo_curso mc
             ON mc.id_modulo = CASE f.tabla WHEN 'leccion' THEN (f.fila ->> 'id_modulo')::INTEGER
                                            WHEN 'recurso_adjunto' THEN lm.id_modulo END
  ),
  contenido_publicado AS (
    SELECT c.*,
           CASE WHEN c.cambiado_en - lag(c.cambiado_en) OVER (PARTITION BY c.quien ORDER BY c.cambiado_en, c.id_auditoria)
                     <= INTERVAL '10 minutes' THEN 0 ELSE 1 END AS inicio
      FROM contenido c
      LEFT JOIN public.curso cu ON cu.id_curso = c.id_curso
     WHERE (cu.estado = 'PUBLICADO' AND c.cambiado_en > COALESCE(cu.publicado_en, '-infinity'))
        OR (c.tabla = 'curso' AND c.antes ->> 'estado' = 'PUBLICADO')
  ),
  contenido_r AS (
    SELECT c.*, sum(c.inicio) OVER (PARTITION BY c.quien ORDER BY c.cambiado_en, c.id_auditoria) AS rafaga,
           count(*) OVER (PARTITION BY c.quien ORDER BY c.cambiado_en
                          RANGE BETWEEN CURRENT ROW AND INTERVAL '10 minutes' FOLLOWING) AS en_ventana,
           count(*) FILTER (WHERE c.operacion = 'DELETE') OVER (PARTITION BY c.quien ORDER BY c.cambiado_en
                          RANGE BETWEEN CURRENT ROW AND INTERVAL '10 minutes' FOLLOWING) AS borrados_en_ventana
      FROM contenido_publicado c
  ),
  masiva AS (
    SELECT 'MODIFICACION_MASIVA'::TEXT AS tipo,
           CASE WHEN bool_or(r.operacion = 'DELETE') THEN 'ALTA' ELSE 'MEDIA' END AS severidad,
           left(format('%s cambios (%s borrados) en el contenido de %s curso(s) publicado(s) por %s.',
                       count(*), count(*) FILTER (WHERE r.operacion = 'DELETE'), count(DISTINCT r.id_curso),
                       CASE WHEN min(r.id_persona_actor) IS NULL THEN 'el rol de la base ' || min(r.usuario_bd) || ' sin actor'
                            ELSE COALESCE(NULLIF(concat_ws(' ', p.nombres, p.apellidos), ''), 'la persona ' || min(r.id_persona_actor))
                       END), 300) AS descripcion,
           u.id_usuario,
           jsonb_build_object('auditoria', (array_agg(r.id_auditoria ORDER BY r.cambiado_en, r.id_auditoria))[1:50]) AS evidencia,
           'MODIFICACION_MASIVA:' || r.quien || ':' || min(r.id_auditoria) AS clave
      FROM contenido_r r
      LEFT JOIN public.persona p ON p.id_persona = r.id_persona_actor
      LEFT JOIN public.usuario u ON u.id_persona = r.id_persona_actor
     GROUP BY r.quien, r.rafaga, p.nombres, p.apellidos, u.id_usuario
    HAVING max(r.en_ventana) >= 20 OR max(r.borrados_en_ventana) >= 3
  ),
  hallazgos AS (
    SELECT * FROM intentos
    UNION ALL SELECT * FROM privilegios
    UNION ALL SELECT * FROM resenas
    UNION ALL SELECT * FROM masiva
  ),
  guardadas AS (
    INSERT INTO public.alerta_seguridad AS al (tipo, severidad, descripcion, id_usuario, evidencia, clave)
    SELECT h.tipo, h.severidad, h.descripcion, h.id_usuario, h.evidencia, h.clave FROM hallazgos h
    ON CONFLICT (clave) DO UPDATE
       SET severidad = EXCLUDED.severidad, descripcion = EXCLUDED.descripcion, evidencia = EXCLUDED.evidencia
     WHERE al.atendida_en IS NULL
       AND (al.evidencia, al.severidad, al.descripcion) IS DISTINCT FROM (EXCLUDED.evidencia, EXCLUDED.severidad, EXCLUDED.descripcion)
    RETURNING (xmax = 0) AS nueva
  )
  SELECT count(*) FILTER (WHERE nueva) INTO v_nuevas FROM guardadas;
  RETURN v_nuevas;
END
$fn$;

REVOKE EXECUTE ON FUNCTION analizar_alertas_seguridad(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION analizar_alertas_seguridad(TIMESTAMPTZ) TO learnity_app;

GRANT SELECT ON alerta_seguridad TO learnity_app, learnity_lectura;
GRANT UPDATE (atendida_en, atendida_por, nota) ON alerta_seguridad TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('038', 'alertas_seguridad');
COMMIT;
