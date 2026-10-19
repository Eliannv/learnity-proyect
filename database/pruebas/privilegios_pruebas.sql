-- =====================================================================
-- 019b · Permisos de limpieza de los fixtures, SOLO en bases _test.
-- Es la propuesta de la decisión D-BD2 de docs/bd/PLAN_BD.md (Puerta 1).
--
-- Con la 019, learnity_app ya no puede borrar lo que crean los fixtures de
-- backend/test/*.test.ts, que se conectan con el mismo pool. Este script
-- concede esos permisos a learnity_pruebas (NOLOGIN) y hace a learnity_app
-- miembro de ese rol. La pertenencia vale para todo el servidor, pero en
-- Learnity learnity_pruebas no tiene ningún permiso: allí no aporta nada.
--
-- Contrapartida: en learnity_test la app corre con más permisos que en
-- Learnity. verificacion/matriz_privilegios.sql mira solo los permisos propios
-- de learnity_app y lo sigue detectando.
--
-- No es una migración: no se registra en schema_migraciones. Se aplica después
-- de probar el ciclo (si no, cambia la huella) y se quita con
-- quitar_privilegios_pruebas.sql. El down de la 019 también revoca estos
-- permisos.
-- Ejecutar con postgres, conectado a learnity_test.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'privilegios_pruebas.sql solo se aplica en bases _test (conectado a %).', current_database();
  END IF;
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'privilegios_pruebas.sql requiere postgres.';
  END IF;
  IF to_regclass('public.schema_migraciones') IS NULL
     OR NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'Aplica antes la 019 (privilegios mínimos).';
  END IF;
END $$;

GRANT learnity_pruebas TO learnity_app;

SET LOCAL ROLE learnity_owner;

-- Lo que hacen los fixtures y la app no necesita (PLAN_BD §2.1, punto 1).
GRANT DELETE ON persona, usuario, usuario_rol, curso, categoria, docente, solicitud_docente, inscripcion
  TO learnity_pruebas;
GRANT INSERT ON inscripcion TO learnity_pruebas;
GRANT UPDATE ON archivo, categoria TO learnity_pruebas;

COMMIT;
