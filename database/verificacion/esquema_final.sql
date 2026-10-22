-- =====================================================================
-- Verificación del esquema final (solo lectura).
--
-- Comprueba y resume el estado que deja scripts/reconstruir-base.ps1 (o
-- aplicar-migraciones.ps1 sobre una base existente): tablas, vistas y sus
-- columnas (sin archivo.ruta), restricciones (incluido el CHECK de PUBLICADO
-- de la 023, NOT VALID), índices, FK sin índice, triggers de auditoría y de
-- actualizado_en, funciones, dueños, roles, CONNECT de la base, la 019b y
-- schema_migraciones. La matriz de privilegios por tabla de learnity_app,
-- learnity_lectura y learnity_pruebas está en matriz_privilegios.sql.
--
-- Solo lee pg_catalog, schema_migraciones, rol y curso: no cambia nada y sirve
-- en cualquier base (también en Learnity). Requiere la 017.
-- Los números hasta la 026 salen de la huella H1 de probar-migraciones del
-- 19-10-2026 (verificacion/referencias/). La 027 agrega las columnas y permisos
-- de aprendizaje de Sprint 3. Desde el 20-10-2026 la 023 no está retenida. Al
-- añadir una migración, actualiza este archivo.
--
-- Salida: seccion | elemento | esperado | obtenido | resultado
--   OK / DISTINTO: comprobación (DISTINTO cuenta como diferencia)
--   AVISO: algo que conviene revisar pero no es un error (no cuenta)
--   INFO: dato para el resumen
-- más una fila final RESUMEN (ESQUEMA OK o ESQUEMA CON DIFERENCIAS).
-- Uso: psql -q -At -F " | " -v ON_ERROR_STOP=1 -f esquema_final.sql
-- =====================================================================
SET client_encoding = 'UTF8';

DO $$
BEGIN
  IF to_regclass('public.schema_migraciones') IS NULL THEN
    RAISE EXCEPTION 'esquema_final.sql verifica una base migrada y % no tiene schema_migraciones (017).', current_database();
  END IF;
END $$;

WITH
ctx AS (
  SELECT current_database() ~ '_test$'                                 AS es_test,
         (SELECT oid FROM pg_roles WHERE rolname = 'learnity_pruebas') AS oid_pruebas
),
rel AS (
  SELECT c.oid, c.relname, c.relkind::TEXT AS relkind, pg_get_userbyid(c.relowner) AS dueno, c.reloptions
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
),
tablas_esperadas (nombre) AS (
  VALUES ('persona'), ('usuario'), ('rol'), ('usuario_rol'), ('solicitud_docente'), ('docente'),
         ('categoria'), ('curso'), ('modulo'), ('archivo'), ('leccion'), ('recurso_adjunto'),
         ('inscripcion'), ('progreso_leccion'), ('evaluacion'), ('pregunta'), ('opcion'),
         ('intento_evaluacion'), ('respuesta'), ('sesion'), ('token_recuperacion'),
         ('archivo_borrado_pendiente'), ('schema_migraciones'), ('auditoria_cambio')
),
vistas_esperadas (orden, nombre, columnas) AS (
  VALUES
    (1, 'catalogo_categoria', 'id,nombre'),
    (2, 'catalogo_curso', 'id,titulo,subtitulo,descripcion,categoria_id,categoria_nombre,docente,docente_bio,'
                          'nivel,portada_url,objetivos,requisitos,publicado_en,publicado_en_orden,modulos,'
                          'lecciones,segundos,inscripciones'),
    (3, 'catalogo_temario', 'curso_id,modulo_id,modulo_orden,modulo_titulo,leccion_id,leccion_orden,'
                            'leccion_titulo,leccion_tipo,segundos'),
    (4, 'curso_publicado_sin_revision', 'id_curso,titulo,id_docente,revisado_por,publicado_en,creado_en')
),
-- 020: tablas auditadas; archivo excluye además la columna ruta.
auditadas (tabla) AS (
  VALUES ('persona'), ('usuario'), ('rol'), ('usuario_rol'), ('solicitud_docente'), ('docente'),
         ('categoria'), ('curso'), ('modulo'), ('leccion'), ('archivo[''ruta'']'), ('recurso_adjunto')
),
-- 021: tablas con actualizado_en.
con_actualizado (tabla) AS (
  VALUES ('persona'), ('usuario'), ('docente'), ('solicitud_docente'), ('categoria'), ('curso'),
         ('modulo'), ('leccion')
),
-- Índices que no son de una PK ni de un UNIQUE de tabla (esquema base, 015, 020, 024 y 025).
indices_esperados (nombre) AS (
  VALUES ('curso_catalogo_idx'), ('curso_docente_idx'), ('modulo_curso_idx'), ('archivo_curso_idx'),
         ('inscripcion_curso_idx'), ('intento_inscripcion_idx'), ('opcion_una_correcta'),
         ('sesion_familia_idx'), ('sesion_usuario_activa_idx'), ('token_recuperacion_usuario_idx'),
         ('auditoria_cambio_tabla_idx'), ('auditoria_cambio_actor_idx'),
         ('solicitud_docente_pendiente_uq'),
         ('solicitud_docente_persona_idx'), ('solicitud_docente_estado_idx'), ('recurso_adjunto_leccion_idx'),
         ('progreso_leccion_leccion_idx'), ('inscripcion_ultima_leccion_idx'),
         ('inscripcion_curso_actividad_idx')
),
-- FK que se quedan sin índice a propósito (PLAN_BD §6.2).
fk_sin_indice_esperadas (fk) AS (
  VALUES ('categoria.creada_por'), ('curso.id_categoria'), ('curso.revisado_por'),
         ('intento_evaluacion.id_evaluacion'), ('respuesta.id_opcion'), ('respuesta.id_pregunta'),
         ('solicitud_docente.revisada_por'), ('usuario_rol.asignado_por'), ('usuario_rol.id_rol')
),
fk AS (
  SELECT con.conrelid::regclass::TEXT || '.' || a.attname AS fk, con.conrelid, con.conkey[1] AS columna
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
   WHERE con.contype = 'f'
     AND con.connamespace = 'public'::regnamespace
),
-- Una FK está cubierta si algún índice de su tabla empieza por su columna.
fk_sin_indice AS (
  SELECT f.fk
    FROM fk f
   WHERE NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = f.conrelid AND i.indkey[0] = f.columna)
),
trg AS (
  SELECT t.tgrelid::regclass::TEXT AS tabla,
         t.tgname,
         t.tgtype::INT AS tipo,               -- 1 fila, 2 BEFORE, 4 INSERT, 8 DELETE, 16 UPDATE
         t.tgenabled::TEXT AS activo,
         t.tgfoid::regproc::TEXT AS funcion,
         t.tgqual IS NOT NULL AS con_when,
         COALESCE(substring(pg_get_triggerdef(t.oid) FROM 'EXECUTE FUNCTION [^(]+\((.*)\)$'), '') AS argumentos
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE NOT t.tgisinternal
     AND c.relnamespace = 'public'::regnamespace
),
fn AS (
  SELECT p.oid, p.proname, pg_get_userbyid(p.proowner) AS dueno,
         CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END || ', ' ||
         CASE WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) x WHERE x LIKE 'search_path=%')
              THEN 'search_path fijo' ELSE 'sin search_path' END AS seguridad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prokind IN ('f', 'p')
),
base AS (
  SELECT d.datdba, d.datacl, pg_encoding_to_char(d.encoding) AS codificacion, d.datcollate
    FROM pg_database d
   WHERE d.datname = current_database()
),
connect_base AS (
  SELECT a.grantee
    FROM base b
         CROSS JOIN LATERAL aclexplode(COALESCE(b.datacl, acldefault('d', b.datdba))) a
   WHERE a.privilege_type = 'CONNECT'
),
chequeos (orden, seccion, elemento, esperado, obtenido, tipo) AS (
  -- Tablas, vistas, secuencias y columnas.
  SELECT 10, 'tablas', 'número de tablas en public', '24',
         (SELECT count(*) FROM rel WHERE relkind = 'r')::TEXT, 'comparar'
  UNION ALL
  SELECT 11, 'tablas', 'tablas que faltan', '-',
         COALESCE((SELECT string_agg(e.nombre, ',' ORDER BY e.nombre) FROM tablas_esperadas e
                    WHERE NOT EXISTS (SELECT 1 FROM rel WHERE relkind = 'r' AND relname = e.nombre)), '-'), 'comparar'
  UNION ALL
  SELECT 12, 'tablas', 'tablas que sobran', '-',
         COALESCE((SELECT string_agg(r.relname, ',' ORDER BY r.relname) FROM rel r
                    WHERE r.relkind = 'r' AND NOT EXISTS (SELECT 1 FROM tablas_esperadas e WHERE e.nombre = r.relname)), '-'), 'comparar'
  UNION ALL
  SELECT 13, 'tablas', 'número de secuencias (identidad)', '22',
         (SELECT count(*) FROM rel WHERE relkind = 'S')::TEXT, 'comparar'
  UNION ALL
  SELECT 14, 'tablas', 'columnas de tablas y vistas', '198',
         (SELECT count(*) FROM rel r JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
           WHERE r.relkind IN ('r', 'v'))::TEXT, 'comparar'
  UNION ALL
  SELECT 15, 'tablas', 'actualizado_en timestamptz NOT NULL DEFAULT now() (021)',
         (SELECT string_agg(tabla, ',' ORDER BY tabla) FROM con_actualizado),
         COALESCE((SELECT string_agg(r.relname, ',' ORDER BY r.relname)
                     FROM rel r
                     JOIN pg_attribute a ON a.attrelid = r.oid AND a.attname = 'actualizado_en' AND NOT a.attisdropped
                     JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                    WHERE r.relkind = 'r' AND a.attnotnull
                      AND format_type(a.atttypid, a.atttypmod) = 'timestamp with time zone'
                      AND pg_get_expr(d.adbin, d.adrelid) = 'now()'), '-'), 'comparar'
  UNION ALL
  SELECT 20, 'vistas', 'número de vistas en public', '4',
         (SELECT count(*) FROM rel WHERE relkind IN ('v', 'm'))::TEXT, 'comparar'
  UNION ALL
  SELECT 20 + v.orden, 'vistas', v.nombre || ': columnas', v.columnas,
         COALESCE((SELECT string_agg(a.attname, ',' ORDER BY a.attnum)
                     FROM pg_attribute a
                    WHERE a.attrelid = to_regclass('public.' || v.nombre) AND a.attnum > 0 AND NOT a.attisdropped),
                  'no existe'), 'comparar'
    FROM vistas_esperadas v
  UNION ALL
  SELECT 25 + v.orden, 'vistas', v.nombre || ': dueño y opciones', 'learnity_owner, sin opciones',
         COALESCE((SELECT r.dueno || ', ' || COALESCE(array_to_string(r.reloptions, ' '), 'sin opciones')
                     FROM rel r WHERE r.relname = v.nombre AND r.relkind = 'v'), 'no existe'), 'comparar'
    FROM vistas_esperadas v
  UNION ALL
  SELECT 30, 'vistas', 'columnas prohibidas en alguna vista (ruta, id_archivo, nombre_original, vista_previa, correo, hashes)', '-',
         COALESCE((SELECT string_agg(r.relname || '.' || a.attname, ',' ORDER BY r.relname, a.attname)
                     FROM rel r
                     JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
                    WHERE r.relkind IN ('v', 'm')
                      AND a.attname IN ('ruta', 'id_archivo', 'nombre_original', 'vista_previa', 'correo',
                                        'contrasena_hash', 'token_hash')), '-'), 'comparar'
  UNION ALL
  -- Más fuerte que el nombre: ninguna vista depende de la columna archivo.ruta.
  SELECT 31, 'vistas', 'vistas que leen archivo.ruta (pg_depend)', '-',
         COALESCE((SELECT string_agg(DISTINCT rw.ev_class::regclass::TEXT, ',')
                     FROM pg_depend d
                     JOIN pg_rewrite rw ON rw.oid = d.objid
                     JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                    WHERE d.classid = 'pg_rewrite'::regclass
                      AND d.refobjid = 'public.archivo'::regclass
                      AND a.attname = 'ruta'), '-'), 'comparar'
  UNION ALL
  -- Restricciones.
  SELECT 40, 'restricciones', 'número en public', '108',
         (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace)::TEXT, 'comparar'
  UNION ALL
  SELECT 41, 'restricciones', 'por tipo (c=CHECK, f=FK, p=PK, u=UNIQUE)', '-',
         (SELECT string_agg(contype::TEXT || '=' || n, ', ' ORDER BY contype::TEXT)
            FROM (SELECT contype, count(*) AS n FROM pg_constraint
                   WHERE connamespace = 'public'::regnamespace GROUP BY contype) t), 'info'
  UNION ALL
  -- NOT VALID a propósito (BD-022): VALIDADA también es una diferencia que hay que mirar.
  SELECT 42, 'restricciones', 'curso_publicado_revisado (023)', 'NOT VALID',
         COALESCE((SELECT CASE WHEN convalidated THEN 'VALIDADA' ELSE 'NOT VALID' END
                     FROM pg_constraint
                    WHERE conrelid = 'public.curso'::regclass AND conname = 'curso_publicado_revisado'), 'ausente'), 'comparar'
  UNION ALL
  SELECT 43, 'restricciones', 'curso_rechazo_con_motivo (esquema base)', 'presente',
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                            WHERE conrelid = 'public.curso'::regclass AND conname = 'curso_rechazo_con_motivo')
              THEN 'presente' ELSE 'ausente' END, 'comparar'
  UNION ALL
  SELECT 44, 'restricciones', 'auditoria_cambio_filas (020)', 'presente',
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auditoria_cambio_filas'
                              AND connamespace = 'public'::regnamespace)
              THEN 'presente' ELSE 'ausente' END, 'comparar'
  UNION ALL
  SELECT 45, 'restricciones', 'leccion_youtube_video_id_valido (027)', 'presente',
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                            WHERE conrelid = 'public.leccion'::regclass
                              AND conname = 'leccion_youtube_video_id_valido')
              THEN 'presente' ELSE 'ausente' END, 'comparar'
  UNION ALL
  SELECT 46, 'columnas', 'inscripcion.ultima_actividad_en (027)', 'timestamp con zona, NOT NULL',
         COALESCE((SELECT CASE WHEN a.attnotnull AND a.atttypid = 'timestamptz'::regtype
                              THEN 'timestamp con zona, NOT NULL' ELSE 'distinta' END
                     FROM pg_attribute a
                    WHERE a.attrelid = 'public.inscripcion'::regclass
                      AND a.attname = 'ultima_actividad_en' AND NOT a.attisdropped), 'ausente'), 'comparar'
  UNION ALL
  SELECT 47, 'columnas', 'leccion.youtube_video_id (027)', 'character varying(11)',
         COALESCE((SELECT format_type(a.atttypid, a.atttypmod)
                     FROM pg_attribute a
                    WHERE a.attrelid = 'public.leccion'::regclass
                      AND a.attname = 'youtube_video_id' AND NOT a.attisdropped), 'ausente'), 'comparar'
  UNION ALL
  -- Índices.
  SELECT 50, 'indices', 'número en public', '62',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public')::TEXT, 'comparar'
  UNION ALL
  SELECT 51, 'indices', 'índices esperados que faltan (base, 015, 020, 024 y 025)', '-',
         COALESCE((SELECT string_agg(e.nombre, ',' ORDER BY e.nombre) FROM indices_esperados e
                    WHERE NOT EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = e.nombre)), '-'),
         'comparar'
  UNION ALL
  SELECT 52, 'indices', 'solicitud_docente_pendiente_uq es UNIQUE y parcial (024)', 'si',
         CASE WHEN EXISTS (SELECT 1 FROM pg_indexes
                            WHERE schemaname = 'public' AND indexname = 'solicitud_docente_pendiente_uq'
                              AND indexdef LIKE 'CREATE UNIQUE INDEX %' AND indexdef LIKE '% WHERE %PENDIENTE%')
              THEN 'si' ELSE 'no' END, 'comparar'
  UNION ALL
  SELECT 53, 'indices', 'FK sin índice (las descartadas en PLAN_BD §6.2)',
         (SELECT string_agg(fk, ',' ORDER BY fk) FROM fk_sin_indice_esperadas),
         COALESCE((SELECT string_agg(fk, ',' ORDER BY fk) FROM fk_sin_indice), '-'), 'comparar'
  UNION ALL
  -- Triggers y funciones.
  SELECT 60, 'triggers', 'número en public', '20', (SELECT count(*) FROM trg)::TEXT, 'comparar'
  UNION ALL
  SELECT 61, 'triggers', 'auditoria: AFTER INSERT/UPDATE/DELETE por fila, activo, auditoria_registrar (020)',
         (SELECT string_agg(tabla, ',' ORDER BY tabla) FROM auditadas),
         COALESCE((SELECT string_agg(tabla || CASE WHEN argumentos <> '' THEN '[' || argumentos || ']' ELSE '' END,
                                     ',' ORDER BY tabla || CASE WHEN argumentos <> '' THEN '[' || argumentos || ']' ELSE '' END)
                     FROM trg
                    WHERE tgname = 'auditoria' AND tipo = 29 AND activo = 'O' AND funcion = 'auditoria_registrar'), '-'),
         'comparar'
  UNION ALL
  SELECT 62, 'triggers', 'actualizado_en: BEFORE UPDATE por fila con WHEN, activo, fijar_actualizado_en (021)',
         (SELECT string_agg(tabla, ',' ORDER BY tabla) FROM con_actualizado),
         COALESCE((SELECT string_agg(tabla, ',' ORDER BY tabla)
                     FROM trg
                    WHERE tgname = 'actualizado_en' AND tipo = 19 AND con_when AND activo = 'O'
                      AND funcion = 'fijar_actualizado_en'), '-'), 'comparar'
  UNION ALL
  SELECT 63, 'triggers', 'otros triggers', '-',
         COALESCE((SELECT string_agg(tabla || '.' || tgname, ',' ORDER BY tabla, tgname)
                     FROM trg WHERE tgname NOT IN ('auditoria', 'actualizado_en')), '-'), 'comparar'
  UNION ALL
  SELECT 64, 'funciones', 'auditoria_registrar', 'SECURITY DEFINER, search_path fijo',
         COALESCE((SELECT seguridad FROM fn WHERE proname = 'auditoria_registrar'), 'no existe'), 'comparar'
  UNION ALL
  SELECT 65, 'funciones', 'fijar_actualizado_en', 'SECURITY INVOKER, search_path fijo',
         COALESCE((SELECT seguridad FROM fn WHERE proname = 'fijar_actualizado_en'), 'no existe'), 'comparar'
  UNION ALL
  SELECT 66, 'funciones', 'funciones con EXECUTE para PUBLIC', '-',
         COALESCE((SELECT string_agg(f.proname, ',' ORDER BY f.proname)
                     FROM fn f JOIN pg_proc p ON p.oid = f.oid
                          CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'), '-'), 'comparar'
  UNION ALL
  -- Dueños.
  SELECT 70, 'dueños', 'relaciones de public que no son de learnity_owner', '-',
         COALESCE((SELECT string_agg(relname || '=' || dueno, ',' ORDER BY relname)
                     FROM rel WHERE dueno <> 'learnity_owner'), '-'), 'comparar'
  UNION ALL
  SELECT 71, 'dueños', 'funciones de public que no son de learnity_owner', '-',
         COALESCE((SELECT string_agg(proname || '=' || dueno, ',' ORDER BY proname)
                     FROM fn WHERE dueno <> 'learnity_owner'), '-'), 'comparar'
  UNION ALL
  SELECT 72, 'dueños', 'base y esquema public', '-',
         (SELECT 'base=' || pg_get_userbyid(datdba) FROM base) || ', public=' ||
         (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public'), 'info'
  UNION ALL
  -- Roles (del clúster) y CONNECT de la base.
  SELECT 80, 'roles', 'learnity_owner, learnity_lectura y learnity_pruebas (018)',
         'learnity_lectura:NOLOGIN,learnity_owner:NOLOGIN,learnity_pruebas:NOLOGIN',
         (SELECT string_agg(n || ':' || COALESCE(CASE WHEN r.rolcanlogin THEN 'LOGIN' ELSE 'NOLOGIN' END, 'no existe'),
                            ',' ORDER BY n)
            FROM unnest(ARRAY['learnity_owner', 'learnity_lectura', 'learnity_pruebas']) n
            LEFT JOIN pg_roles r ON r.rolname = n), 'comparar'
  UNION ALL
  SELECT 81, 'roles', 'learnity_app: atributos (sin SUPERUSER, CREATEROLE, CREATEDB, BYPASSRLS ni REPLICATION)', 'LOGIN',
         COALESCE((SELECT concat_ws(',',
                            CASE WHEN rolcanlogin THEN 'LOGIN' END, CASE WHEN rolsuper THEN 'SUPERUSER' END,
                            CASE WHEN rolcreaterole THEN 'CREATEROLE' END, CASE WHEN rolcreatedb THEN 'CREATEDB' END,
                            CASE WHEN rolbypassrls THEN 'BYPASSRLS' END, CASE WHEN rolreplication THEN 'REPLICATION' END)
                     FROM pg_roles WHERE rolname = 'learnity_app'), 'no existe'), 'comparar'
  UNION ALL
  SELECT 82, 'base', 'CONNECT de PUBLIC (la 018 lo revoca)', 'no',
         CASE WHEN EXISTS (SELECT 1 FROM connect_base WHERE grantee = 0) THEN 'si' ELSE 'no' END, 'comparar'
  UNION ALL
  -- Un login añadido por el riesgo R1 sale aquí como diferencia: es esperable, pero se revisa.
  SELECT 83, 'base', 'roles con CONNECT explícito, sin contar al dueño de la base',
         'learnity_app,learnity_lectura,learnity_owner',
         COALESCE((SELECT string_agg(pg_get_userbyid(c.grantee), ',' ORDER BY pg_get_userbyid(c.grantee))
                     FROM connect_base c
                    WHERE c.grantee <> 0 AND c.grantee <> (SELECT datdba FROM base)), '-'), 'comparar'
  UNION ALL
  SELECT 84, 'base', 'codificación y collation', '-',
         (SELECT codificacion || ', ' || datcollate FROM base), 'info'
  UNION ALL
  -- 019b: solo en bases _test. Fuera de _test, learnity_pruebas no tiene ningún permiso.
  SELECT 90, 'pruebas', '019b aplicada en esta base (learnity_pruebas con permisos)',
         CASE WHEN (SELECT es_test FROM ctx) THEN 'si' ELSE 'no' END,
         CASE WHEN EXISTS (SELECT 1
                             FROM pg_class c
                                  CROSS JOIN LATERAL aclexplode(c.relacl) a
                            WHERE c.relnamespace = 'public'::regnamespace
                              AND a.grantee = (SELECT oid_pruebas FROM ctx))
              THEN 'si' ELSE 'no' END, 'comparar'
  UNION ALL
  SELECT 91, 'pruebas', 'learnity_app miembro de learnity_pruebas (del clúster)', '-',
         COALESCE((SELECT 'inherit=' || m.inherit_option || ',set=' || m.set_option
                     FROM pg_auth_members m
                    WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = 'learnity_app')
                      AND m.roleid = (SELECT oid_pruebas FROM ctx)), '-'), 'info'
  UNION ALL
  -- schema_migraciones.
  SELECT 100, 'migraciones', 'versiones aplicadas (por versión)',
         '000,015,016,017,018,019,020,021,022,023,024,025,026,027',
         (SELECT string_agg(version, ',' ORDER BY version) FROM public.schema_migraciones), 'comparar'
  UNION ALL
  SELECT 101, 'migraciones', 'desde la 017, con checksum (sin él, se aplicaron a mano con psql -f)',
         (SELECT count(*) FROM public.schema_migraciones WHERE version >= '017')::TEXT,
         (SELECT count(*) FROM public.schema_migraciones WHERE version >= '017' AND checksum IS NOT NULL)::TEXT, 'aviso'
  UNION ALL
  SELECT 110 + row_number() OVER (ORDER BY s.orden), 'migraciones', s.version || ' ' || s.nombre, '-',
         to_char(s.aplicada_en, 'YYYY-MM-DD HH24:MI:SS') || ' por ' || s.aplicada_por ||
         CASE WHEN s.checksum IS NULL THEN '' ELSE ', sha256 ' || left(s.checksum, 12) END, 'info'
    FROM public.schema_migraciones s
  UNION ALL
  -- Datos que deja la reconstrucción.
  SELECT 200, 'datos', 'roles de la aplicación (tabla rol)', 'ADMIN,DOCENTE,ESTUDIANTE',
         COALESCE((SELECT string_agg(nombre, ',' ORDER BY nombre) FROM public.rol), '-'), 'comparar'
  UNION ALL
  SELECT 201, 'datos', 'cursos PUBLICADO sin revisor o sin fecha (heredados, BD-022)', '-',
         (SELECT count(*) FROM public.curso
           WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL))::TEXT, 'info'
),
evaluado AS (
  SELECT orden, seccion, elemento, esperado, obtenido,
         CASE tipo
           WHEN 'info'  THEN 'INFO'
           WHEN 'aviso' THEN CASE WHEN esperado = obtenido THEN 'OK' ELSE 'AVISO' END
           ELSE CASE WHEN esperado = obtenido THEN 'OK' ELSE 'DISTINTO' END
         END AS resultado
    FROM chequeos
)
SELECT seccion, elemento, esperado, obtenido, resultado
  FROM (
    SELECT orden, seccion, elemento, esperado, obtenido, resultado FROM evaluado
    UNION ALL
    SELECT 9999, 'RESUMEN', current_database(),
           count(*) FILTER (WHERE resultado IN ('OK', 'DISTINTO'))::TEXT || ' comprobaciones',
           count(*) FILTER (WHERE resultado = 'DISTINTO')::TEXT || ' diferencias, ' ||
           count(*) FILTER (WHERE resultado = 'AVISO')::TEXT || ' avisos',
           CASE WHEN bool_or(resultado = 'DISTINTO') THEN 'ESQUEMA CON DIFERENCIAS' ELSE 'ESQUEMA OK' END
      FROM evaluado
  ) t
 ORDER BY orden;
