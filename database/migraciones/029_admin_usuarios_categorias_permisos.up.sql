-- Sprint 4: permisos de administracion para gestion de usuarios y categorias (RF-21, RF-23, ADR-012).
-- Solo privilegios: gestion de roles (DELETE en usuario_rol) y gestion de categorias (UPDATE en categoria).
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '029') THEN
    RAISE EXCEPTION 'La migracion 029 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '028') THEN
    RAISE EXCEPTION 'La 029 necesita la 028.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- El administrador puede modificar y retirar roles de usuario
GRANT SELECT, INSERT, UPDATE, DELETE ON usuario_rol TO learnity_app;
-- El administrador puede crear, editar y activar/desactivar categorias
GRANT SELECT, INSERT, UPDATE ON categoria TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('029', 'admin_usuarios_categorias_permisos');
COMMIT;
