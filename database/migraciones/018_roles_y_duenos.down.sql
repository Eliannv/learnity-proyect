-- =====================================================================
-- 018 · Roles y dueños (down)
--
-- Devuelve cada tabla a su dueño original y restaura los permisos previos de la
-- base y del esquema, todo desde schema_migraciones.reversion. Intenta borrar
-- solo los roles que creó la 018; si otra base del servidor los usa, los
-- conserva y avisa.
-- Requiere superusuario (postgres).
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_ultima TEXT;
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'El down de la 018 requiere un superusuario (postgres); conectado como %.', current_user;
  END IF;
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '018' THEN
    RAISE EXCEPTION 'No se puede revertir la 018 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

DO $$
DECLARE
  r JSONB;
  v_tabla TEXT;
  v_dueno TEXT;
  v_rol TEXT;
BEGIN
  SELECT reversion INTO r FROM schema_migraciones WHERE version = '018';

  FOR v_tabla, v_dueno IN SELECT key, value FROM jsonb_each_text(r -> 'duenos') LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', v_tabla, v_dueno);
  END LOOP;

  -- Base: CONNECT de PUBLIC y de los roles que no lo tenían antes.
  IF (r ->> 'public_connect')::BOOLEAN THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO PUBLIC', current_database());
  END IF;
  FOREACH v_rol IN ARRAY ARRAY['learnity_owner', 'learnity_app', 'learnity_lectura'] LOOP
    IF NOT (r -> 'connect_previo') ? v_rol THEN
      EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM %I', current_database(), v_rol);
    END IF;
  END LOOP;

  -- Esquema public: lo que learnity_owner no tenía antes.
  IF NOT (r -> 'esquema_owner_previo') ? 'USAGE' THEN
    REVOKE USAGE ON SCHEMA public FROM learnity_owner;
  END IF;
  IF NOT (r -> 'esquema_owner_previo') ? 'CREATE' THEN
    REVOKE CREATE ON SCHEMA public FROM learnity_owner;
  END IF;

  DELETE FROM schema_migraciones WHERE version = '018';

  -- Roles creados por la 018: se borran solo si ya no tienen nada en ninguna base.
  FOR v_rol IN SELECT jsonb_array_elements_text(r -> 'roles_creados') LOOP
    BEGIN
      EXECUTE format('DROP ROLE %I', v_rol);
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Se conserva el rol % porque todavía tiene objetos o permisos en otra base: %', v_rol, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
