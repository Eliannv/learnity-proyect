-- =====================================================================
-- Huella del esquema de la base actual (solo lectura).
--
-- Devuelve una fila por categoría (categoria | filas | md5) y una fila TOTAL.
-- Dos bases, o una misma base antes y después de un up+down, tienen el mismo
-- esquema si sus huellas coinciden. Solo lee pg_catalog, así que cualquier rol
-- puede ejecutarla.
--
-- Uso: psql -At -F "|" -f huella_esquema.sql   (lo hace probar-migraciones.ps1)
--
-- * Las ACL se normalizan con acldefault(): un ACL NULL y su equivalente
--   explícito dan el mismo acceso. Se comparan entradas, no el orden.
-- * Columnas en su orden relativo, sin attnum: un DROP COLUMN deja huecos.
-- * La categoría roles es del clúster: si otra base usa los roles learnity_*,
--   el down de la 018 los conserva y esa categoría puede diferir (está
--   documentado).
-- * datos_curso (estado, revisado_por y publicado_en de cada curso) comprueba
--   que ninguna migración cambia esos datos: la 022 y la 023 no tocan curso
--   (decisión BD-022).
-- * Las columnas "char" del catálogo (relkind, contype, attidentity…) se
--   convierten con ::TEXT antes de concatenar: text || "char" es ambiguo.
-- =====================================================================
WITH
rel AS (
  SELECT c.oid, c.relname, c.relkind, c.relowner, c.relacl
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
),
lineas AS (
  -- Relaciones: tipo, dueño, RLS, persistencia y opciones.
  SELECT 'relaciones' AS categoria,
         r.relname || '|' || r.relkind::TEXT || '|' || pg_get_userbyid(r.relowner) || '|' ||
         c.relrowsecurity || '|' || c.relforcerowsecurity || '|' || c.relpersistence::TEXT || '|' ||
         COALESCE(array_to_string(c.reloptions, ','), '') AS linea
    FROM rel r JOIN pg_class c ON c.oid = r.oid

  UNION ALL
  -- Columnas, en su orden relativo.
  SELECT 'columnas',
         r.relname || '|' ||
         row_number() OVER (PARTITION BY r.oid ORDER BY a.attnum) || '|' ||
         a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|' ||
         a.attnotnull || '|' || COALESCE(pg_get_expr(d.adbin, d.adrelid), '') || '|' ||
         a.attidentity::TEXT || '|' || a.attgenerated::TEXT
    FROM rel r
    JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE r.relkind IN ('r', 'p', 'v', 'm', 'f')

  UNION ALL
  SELECT 'restricciones',
         con.conrelid::regclass::TEXT || '|' || con.conname || '|' || con.contype::TEXT || '|' ||
         pg_get_constraintdef(con.oid)
    FROM pg_constraint con
   WHERE con.connamespace = 'public'::regnamespace

  UNION ALL
  SELECT 'indices', i.tablename || '|' || i.indexname || '|' || i.indexdef
    FROM pg_indexes i
   WHERE i.schemaname = 'public'

  UNION ALL
  SELECT 'vistas', r.relname || '|' || pg_get_viewdef(r.oid, true)
    FROM rel r
   WHERE r.relkind IN ('v', 'm')

  UNION ALL
  SELECT 'funciones',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
         pg_get_userbyid(p.proowner) || '|' || md5(pg_get_functiondef(p.oid))
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prokind IN ('f', 'p')

  UNION ALL
  SELECT 'acl_funciones',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' ||
         pg_get_userbyid(a.grantor) || '|' || a.privilege_type || '|' || a.is_grantable
    FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prokind IN ('f', 'p')

  UNION ALL
  SELECT 'triggers', t.tgrelid::regclass::TEXT || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE NOT t.tgisinternal
     AND c.relnamespace = 'public'::regnamespace

  UNION ALL
  SELECT 'acl_relaciones',
         r.relname || '|' ||
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' ||
         pg_get_userbyid(a.grantor) || '|' || a.privilege_type || '|' || a.is_grantable
    FROM rel r
         CROSS JOIN LATERAL aclexplode(COALESCE(
           r.relacl,
           acldefault(CASE WHEN r.relkind = 'S' THEN 's' ELSE 'r' END::"char", r.relowner))) a

  UNION ALL
  SELECT 'acl_columnas',
         r.relname || '|' || att.attname || '|' ||
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' ||
         pg_get_userbyid(a.grantor) || '|' || a.privilege_type || '|' || a.is_grantable
    FROM rel r
    JOIN pg_attribute att ON att.attrelid = r.oid AND att.attnum > 0
                         AND NOT att.attisdropped AND att.attacl IS NOT NULL
         CROSS JOIN LATERAL aclexplode(att.attacl) a

  UNION ALL
  SELECT 'acl_esquema',
         n.nspname || '|' || pg_get_userbyid(n.nspowner) || '|' ||
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' ||
         pg_get_userbyid(a.grantor) || '|' || a.privilege_type || '|' || a.is_grantable
    FROM pg_namespace n
         CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
   WHERE n.nspname = 'public'

  UNION ALL
  SELECT 'acl_base',
         pg_get_userbyid(d.datdba) || '|' ||
         CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' ||
         pg_get_userbyid(a.grantor) || '|' || a.privilege_type || '|' || a.is_grantable
    FROM pg_database d
         CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
   WHERE d.datname = current_database()

  UNION ALL
  SELECT 'acl_por_defecto',
         pg_get_userbyid(da.defaclrole) || '|' || da.defaclobjtype::TEXT || '|' ||
         COALESCE(da.defaclnamespace::regnamespace::TEXT, '') || '|' || da.defaclacl::TEXT
    FROM pg_default_acl da

  UNION ALL
  SELECT 'roles',
         r.rolname || '|' || r.rolcanlogin || '|' || r.rolsuper || '|' || r.rolinherit || '|' ||
         r.rolcreaterole || '|' || r.rolcreatedb || '|' || r.rolbypassrls
    FROM pg_roles r
   WHERE r.rolname LIKE 'learnity\_%'

  UNION ALL
  SELECT 'roles',
         'miembro|' || pg_get_userbyid(m.member) || '|de|' || pg_get_userbyid(m.roleid) || '|' ||
         m.admin_option || '|' || m.inherit_option || '|' || m.set_option
    FROM pg_auth_members m
   WHERE pg_get_userbyid(m.member) LIKE 'learnity\_%'
      OR pg_get_userbyid(m.roleid) LIKE 'learnity\_%'

  UNION ALL
  SELECT 'extensiones', e.extname || '|' || e.extversion || '|' || pg_get_userbyid(e.extowner)
    FROM pg_extension e

  UNION ALL
  SELECT 'datos_curso',
         c.id_curso || '|' || c.estado || '|' || COALESCE(c.revisado_por::TEXT, '') || '|' ||
         COALESCE(c.publicado_en::TEXT, '')
    FROM public.curso c
),
categorias AS (
  SELECT categoria,
         count(*) AS filas,
         md5(string_agg(linea, E'\n' ORDER BY linea)) AS huella
    FROM lineas
   GROUP BY categoria
)
SELECT categoria, filas, huella
  FROM categorias
UNION ALL
SELECT 'TOTAL',
       sum(filas)::BIGINT,
       md5(string_agg(categoria || '=' || huella, ',' ORDER BY categoria))
  FROM categorias
ORDER BY 1;
