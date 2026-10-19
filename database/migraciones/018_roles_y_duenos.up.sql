-- =====================================================================
-- 018 · Roles y dueños (up)
--
-- 1. Crea, si no existen, los roles NOLOGIN learnity_owner (dueño de los
--    objetos), learnity_lectura (solo lectura) y learnity_pruebas (permisos de
--    limpieza, solo con permisos en bases _test). learnity_app ya existe y su
--    contraseña nunca va al repositorio.
-- 2. Pasa a learnity_owner las 22 tablas y schema_migraciones (las secuencias
--    de identidad siguen a su tabla).
-- 3. learnity_owner puede crear objetos en public.
-- 4. Solo los roles de Learnity se conectan a esta base: REVOKE CONNECT FROM
--    PUBLIC (ver el riesgo R1 de docs/bd/PLAN_BD.md antes de aplicar).
--
-- Lo que el down necesita (dueños originales, roles creados y permisos previos)
-- se guarda en schema_migraciones.reversion.
-- Requiere superusuario (postgres).
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'La 018 requiere un superusuario (postgres); conectado como %.', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'La migración 018 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '017') THEN
    RAISE EXCEPTION 'La 018 necesita la 017.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_app') THEN
    RAISE EXCEPTION 'Falta el rol learnity_app en este servidor. Créalo primero (database/README.md, "Rol learnity_app").';
  END IF;
END $$;

DO $$
DECLARE
  v_tablas TEXT[] := ARRAY[
    'persona', 'usuario', 'rol', 'usuario_rol', 'solicitud_docente', 'docente',
    'categoria', 'curso', 'modulo', 'archivo', 'leccion', 'recurso_adjunto',
    'inscripcion', 'progreso_leccion', 'evaluacion', 'pregunta', 'opcion',
    'intento_evaluacion', 'respuesta', 'sesion', 'token_recuperacion',
    'archivo_borrado_pendiente', 'schema_migraciones'];
  v_roles_nuevos TEXT[] := ARRAY['learnity_owner', 'learnity_lectura', 'learnity_pruebas'];
  v_roles_connect TEXT[] := ARRAY['learnity_owner', 'learnity_app', 'learnity_lectura'];
  v_tabla TEXT;
  v_rol TEXT;
  v_creados TEXT[] := '{}';
  v_duenos JSONB := '{}';
  v_connect_previo TEXT[] := '{}';
  v_public_connect BOOLEAN;
  v_esquema_previo TEXT[] := '{}';
BEGIN
  -- Permisos previos sobre la base: ¿PUBLIC y cada rol tenían CONNECT explícito?
  SELECT EXISTS (
           SELECT 1
             FROM pg_database d,
                  aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
            WHERE d.datname = current_database()
              AND a.grantee = 0 AND a.privilege_type = 'CONNECT')
    INTO v_public_connect;

  SELECT COALESCE(array_agg(DISTINCT r.rolname), '{}')
    INTO v_connect_previo
    FROM pg_database d
         CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
         JOIN pg_roles r ON r.oid = a.grantee
   WHERE d.datname = current_database()
     AND a.privilege_type = 'CONNECT'
     AND r.rolname = ANY (v_roles_connect);

  -- Permisos previos de learnity_owner sobre el esquema public (si ya existía).
  SELECT COALESCE(array_agg(DISTINCT a.privilege_type), '{}')
    INTO v_esquema_previo
    FROM pg_namespace n
         CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
         JOIN pg_roles r ON r.oid = a.grantee
   WHERE n.nspname = 'public'
     AND r.rolname = 'learnity_owner';

  -- Roles nuevos (los del clúster se comparten entre bases).
  FOREACH v_rol IN ARRAY v_roles_nuevos LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', v_rol);
      v_creados := v_creados || v_rol;
    ELSIF (SELECT rolcanlogin FROM pg_roles WHERE rolname = v_rol) THEN
      RAISE NOTICE 'El rol % ya existía y puede iniciar sesión. Si nadie lo usa para conectarse, ejecuta con postgres: ALTER ROLE % NOLOGIN;', v_rol, v_rol;
    END IF;
  END LOOP;

  -- Dueños: se guarda el original de cada tabla para el down.
  FOREACH v_tabla IN ARRAY v_tablas LOOP
    IF to_regclass(format('public.%I', v_tabla)) IS NULL THEN
      RAISE EXCEPTION 'Falta la tabla public.% en %.', v_tabla, current_database();
    END IF;
    SELECT v_duenos || jsonb_build_object(v_tabla, pg_get_userbyid(c.relowner))
      INTO v_duenos
      FROM pg_class c
     WHERE c.oid = format('public.%I', v_tabla)::regclass;
    EXECUTE format('ALTER TABLE public.%I OWNER TO learnity_owner', v_tabla);
  END LOOP;

  -- Esquema y base.
  GRANT USAGE, CREATE ON SCHEMA public TO learnity_owner;
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO learnity_owner, learnity_app, learnity_lectura', current_database());

  INSERT INTO schema_migraciones (version, nombre, reversion)
  VALUES ('018', 'roles_y_duenos',
          jsonb_build_object(
            'roles_creados', to_jsonb(v_creados),
            'duenos', v_duenos,
            'public_connect', v_public_connect,
            'connect_previo', to_jsonb(v_connect_previo),
            'esquema_owner_previo', to_jsonb(v_esquema_previo)));
END $$;

COMMIT;
