-- =====================================================================
-- 019b · Rol de los fixtures, SOLO en bases _test.
-- Propuesta de la decisión D-BD2 de docs/bd/PLAN_BD.md (opción 3, de qa-edge;
-- se decide en la Puerta 1).
--
-- Con la 019, learnity_app ya no puede crear ni borrar lo que preparan los
-- fixtures de backend/test/*.test.ts. Este script:
--   * da a learnity_pruebas (NOLOGIN) DML completo sobre las tablas del dominio
--     y SELECT sobre la auditoría, schema_migraciones y las vistas;
--   * hace a learnity_app miembro de learnity_pruebas SIN HERENCIA
--     (INHERIT FALSE, SET TRUE; requiere PostgreSQL 16 o superior).
-- Así las conexiones de la app siguen con el mínimo privilegio real: la suite
-- prueba los permisos verdaderos. Los fixtures usan un pool aparte
-- (backend/test/ayudas/, de qa-edge) que ejecuta SET ROLE learnity_pruebas al
-- conectarse, con las mismas credenciales de .env.test. En Learnity,
-- learnity_pruebas no tiene ningún permiso.
--
-- No es una migración: no se registra en schema_migraciones. Se aplica después
-- de probar el ciclo (cambia la huella) y se vuelve a ejecutar si una migración
-- nueva añade tablas. Se quita con quitar_privilegios_pruebas.sql. El down de
-- la 019 también revoca estos permisos.
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
  IF current_setting('server_version_num')::INT < 160000 THEN
    RAISE EXCEPTION 'privilegios_pruebas.sql requiere PostgreSQL 16 o superior (GRANT … WITH INHERIT FALSE).';
  END IF;
  IF to_regclass('public.schema_migraciones') IS NULL
     OR NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'Aplica antes la 019 (privilegios mínimos).';
  END IF;
END $$;

-- Pertenencia sin herencia. Se revoca primero por si ya existía con otras opciones.
REVOKE learnity_pruebas FROM learnity_app;
GRANT learnity_pruebas TO learnity_app WITH INHERIT FALSE, SET TRUE;

SET LOCAL ROLE learnity_owner;

GRANT SELECT, INSERT, UPDATE, DELETE
   ON persona, usuario, rol, usuario_rol, solicitud_docente, docente, categoria, curso, modulo,
      archivo, leccion, recurso_adjunto, inscripcion, progreso_leccion, evaluacion, pregunta,
      opcion, intento_evaluacion, respuesta, sesion, token_recuperacion, archivo_borrado_pendiente
   TO learnity_pruebas;
GRANT SELECT ON schema_migraciones TO learnity_pruebas;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnity_pruebas;

-- Lo que existe según las migraciones aplicadas (020 y 026).
DO $$
BEGIN
  IF to_regclass('public.auditoria_cambio') IS NOT NULL THEN
    GRANT SELECT ON auditoria_cambio TO learnity_pruebas;
  END IF;
  IF to_regclass('public.catalogo_curso') IS NOT NULL THEN
    GRANT SELECT ON catalogo_categoria, catalogo_curso, catalogo_temario TO learnity_pruebas;
  END IF;
  -- 032: los fixtures fabrican accesos antiguos y borran los de su marca (la app solo inserta).
  IF to_regclass('public.evento_acceso') IS NOT NULL THEN
    GRANT SELECT, INSERT, DELETE ON evento_acceso TO learnity_pruebas;
  END IF;
  -- 038: las alertas solo las crea analizar_alertas_seguridad(); los fixtures borran las de sus cuentas.
  IF to_regclass('public.alerta_seguridad') IS NOT NULL THEN
    GRANT SELECT, DELETE ON alerta_seguridad TO learnity_pruebas;
  END IF;
END $$;

COMMIT;
