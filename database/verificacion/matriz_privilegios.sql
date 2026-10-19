-- =====================================================================
-- Matriz de privilegios de learnity_app y learnity_lectura (solo lectura).
--
-- Compara los permisos PROPIOS de cada rol (relacl/attacl, sin contar los que
-- hereda por pertenencia) con la matriz esperada de docs/bd/PLAN_BD.md §4.
-- Además comprueba que learnity_app no tiene CREATE en public, que no es dueño
-- de ninguna relación y que su pertenencia a learnity_pruebas (019b) es sin
-- herencia.
--
-- Es la ÚNICA fuente de la matriz esperada. Solo lee el catálogo, así que
-- también la puede ejecutar learnity_app: la prueba de qa-edge
-- (backend/test/seguridad/) puede leer este archivo, ejecutarlo y exigir que
-- todas las filas den OK.
--
-- Salida: rol | objeto | esperado | concedido | resultado (OK, FALTA, SOBRA o DISTINTO),
-- más una fila final RESUMEN. Las relaciones que todavía no existen (por
-- ejemplo, las vistas sin la 026) no se esperan. Requiere PostgreSQL 16 o
-- superior (pg_auth_members.inherit_option).
-- Uso: psql -At -F "|" -f matriz_privilegios.sql
-- =====================================================================
WITH
esperado_tabla (rol, objeto, privilegios) AS (
  VALUES
    ('learnity_app', 'persona',                   'INSERT,SELECT,UPDATE'),
    ('learnity_app', 'usuario',                   'INSERT,SELECT,UPDATE'),
    ('learnity_app', 'solicitud_docente',         'INSERT,SELECT,UPDATE'),
    ('learnity_app', 'docente',                   'INSERT,SELECT,UPDATE'),
    ('learnity_app', 'curso',                     'INSERT,SELECT,UPDATE'),
    ('learnity_app', 'usuario_rol',               'INSERT,SELECT'),
    ('learnity_app', 'categoria',                 'INSERT,SELECT'),
    ('learnity_app', 'modulo',                    'DELETE,INSERT,SELECT,UPDATE'),
    ('learnity_app', 'leccion',                   'DELETE,INSERT,SELECT,UPDATE'),
    ('learnity_app', 'sesion',                    'DELETE,INSERT,SELECT,UPDATE'),
    ('learnity_app', 'token_recuperacion',        'DELETE,INSERT,SELECT,UPDATE'),
    ('learnity_app', 'archivo_borrado_pendiente', 'DELETE,INSERT,SELECT,UPDATE'),
    ('learnity_app', 'archivo',                   'DELETE,INSERT,SELECT'),
    ('learnity_app', 'rol',                       'SELECT'),
    ('learnity_app', 'recurso_adjunto',           'SELECT'),
    ('learnity_app', 'inscripcion',               'SELECT'),
    ('learnity_app', 'catalogo_categoria',        'SELECT'),
    ('learnity_app', 'catalogo_curso',            'SELECT'),
    ('learnity_app', 'catalogo_temario',          'SELECT'),
    ('learnity_lectura', 'persona',                   'SELECT'),
    ('learnity_lectura', 'rol',                       'SELECT'),
    ('learnity_lectura', 'usuario_rol',               'SELECT'),
    ('learnity_lectura', 'solicitud_docente',         'SELECT'),
    ('learnity_lectura', 'docente',                   'SELECT'),
    ('learnity_lectura', 'categoria',                 'SELECT'),
    ('learnity_lectura', 'curso',                     'SELECT'),
    ('learnity_lectura', 'modulo',                    'SELECT'),
    ('learnity_lectura', 'leccion',                   'SELECT'),
    ('learnity_lectura', 'recurso_adjunto',           'SELECT'),
    ('learnity_lectura', 'inscripcion',               'SELECT'),
    ('learnity_lectura', 'progreso_leccion',          'SELECT'),
    ('learnity_lectura', 'evaluacion',                'SELECT'),
    ('learnity_lectura', 'pregunta',                  'SELECT'),
    ('learnity_lectura', 'opcion',                    'SELECT'),
    ('learnity_lectura', 'intento_evaluacion',        'SELECT'),
    ('learnity_lectura', 'respuesta',                 'SELECT'),
    ('learnity_lectura', 'archivo_borrado_pendiente', 'SELECT'),
    ('learnity_lectura', 'schema_migraciones',        'SELECT'),
    ('learnity_lectura', 'auditoria_cambio',          'SELECT'),
    ('learnity_lectura', 'catalogo_categoria',        'SELECT'),
    ('learnity_lectura', 'catalogo_curso',            'SELECT'),
    ('learnity_lectura', 'catalogo_temario',          'SELECT'),
    ('learnity_lectura', 'curso_publicado_sin_revision', 'SELECT')
),
esperado_columna (rol, objeto, columna) AS (
  SELECT 'learnity_lectura', 'usuario', unnest(ARRAY['id_usuario', 'id_persona', 'correo', 'estado',
                                                      'intentos_fallidos', 'bloqueado_hasta', 'ultimo_acceso',
                                                      'actualizado_en'])
  UNION ALL
  SELECT 'learnity_lectura', 'archivo', unnest(ARRAY['id_archivo', 'id_curso', 'tipo', 'nombre_original',
                                                      'tamano_bytes', 'alto_px', 'duracion_seg'])
),
esperado AS (
  SELECT rol, objeto, privilegios
    FROM esperado_tabla
   WHERE to_regclass('public.' || objeto) IS NOT NULL
  UNION ALL
  SELECT rol, objeto || '(SELECT por columna)', string_agg(columna, ',' ORDER BY columna)
    FROM esperado_columna e
   WHERE EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = to_regclass('public.' || e.objeto)
                    AND a.attname = e.columna AND NOT a.attisdropped)
   GROUP BY rol, objeto
),
concedido AS (
  SELECT pg_get_userbyid(a.grantee) AS rol,
         c.relname || CASE WHEN c.relkind = 'S' THEN ' (secuencia)' ELSE '' END AS objeto,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type) AS privilegios
    FROM pg_class c
         CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind IN ('r', 'v', 'm', 'S')
     AND pg_get_userbyid(a.grantee) IN ('learnity_app', 'learnity_lectura')
   GROUP BY 1, 2
  UNION ALL
  SELECT pg_get_userbyid(a.grantee),
         c.relname || '(' || a.privilege_type || ' por columna)',
         string_agg(att.attname, ',' ORDER BY att.attname)
    FROM pg_class c
    JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum > 0
                         AND NOT att.attisdropped AND att.attacl IS NOT NULL
         CROSS JOIN LATERAL aclexplode(att.attacl) a
   WHERE c.relnamespace = 'public'::regnamespace
     AND pg_get_userbyid(a.grantee) IN ('learnity_app', 'learnity_lectura')
   GROUP BY 1, 2, a.privilege_type
),
comparacion AS (
  SELECT COALESCE(e.rol, r.rol) AS rol,
         COALESCE(e.objeto, r.objeto) AS objeto,
         COALESCE(e.privilegios, '-') AS esperado,
         COALESCE(r.privilegios, '-') AS concedido,
         CASE
           WHEN e.privilegios IS NULL THEN 'SOBRA'
           WHEN r.privilegios IS NULL THEN 'FALTA'
           WHEN e.privilegios = r.privilegios THEN 'OK'
           ELSE 'DISTINTO'
         END AS resultado
    FROM esperado e
    FULL JOIN concedido r ON r.rol = e.rol AND r.objeto = e.objeto
),
-- Comprobaciones de rol (no de tabla).
membresia AS (
  SELECT 'inherit=' || m.inherit_option || ',set=' || m.set_option AS opciones
    FROM pg_auth_members m
   WHERE m.member = 'learnity_app'::regrole
     AND m.roleid = (SELECT oid FROM pg_roles WHERE rolname = 'learnity_pruebas')
),
roles AS (
  SELECT 'learnity_app' AS rol, 'CREATE en el esquema public' AS objeto, 'no' AS esperado,
         CASE WHEN has_schema_privilege('learnity_app', 'public', 'CREATE') THEN 'si' ELSE 'no' END AS concedido
  UNION ALL
  SELECT 'learnity_app', 'relaciones de las que es dueño', '0',
         (SELECT count(*) FROM pg_class
           WHERE relnamespace = 'public'::regnamespace AND relowner = 'learnity_app'::regrole)::TEXT
  UNION ALL
  -- Con la 019b, la pertenencia debe ser sin herencia (la app no usa los permisos de los fixtures).
  SELECT 'learnity_app', 'miembro de learnity_pruebas (019b)',
         CASE WHEN EXISTS (SELECT 1 FROM membresia) THEN 'inherit=false,set=true' ELSE '-' END,
         COALESCE((SELECT opciones FROM membresia), '-')
),
todo AS (
  SELECT rol, objeto, esperado, concedido, resultado FROM comparacion
  UNION ALL
  SELECT rol, objeto, esperado, concedido,
         CASE WHEN esperado = concedido THEN 'OK' ELSE 'DISTINTO' END
    FROM roles
)
SELECT rol, objeto, esperado, concedido, resultado
  FROM (
    SELECT rol, objeto, esperado, concedido, resultado, 0 AS bloque FROM todo
    UNION ALL
    SELECT 'RESUMEN', current_database(),
           (SELECT count(*) FROM todo)::TEXT || ' filas',
           (SELECT count(*) FROM todo WHERE resultado <> 'OK')::TEXT || ' diferencias',
           CASE WHEN EXISTS (SELECT 1 FROM todo WHERE resultado <> 'OK')
                THEN 'MATRIZ CON DIFERENCIAS' ELSE 'MATRIZ OK' END,
           1
  ) t
 ORDER BY bloque, rol, objeto;
