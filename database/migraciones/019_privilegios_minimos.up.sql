-- =====================================================================
-- 019 · Privilegios mínimos (up)
--
-- learnity_app pasa de DML completo en las 22 tablas (S2 de la auditoría) a
-- solo lo que usa el código (matriz de docs/bd/PLAN_BD.md §4).
-- learnity_lectura recibe SELECT sin datos sensibles: ni sesion ni
-- token_recuperacion, ni usuario.contrasena_hash ni archivo.ruta.
--
-- Los permisos explícitos que tenía learnity_app se guardan en
-- schema_migraciones.reversion para que el down los restaure exactamente.
--
-- Secuencias: no se concede USAGE. Una columna GENERATED ALWAYS AS IDENTITY no
-- debería necesitarlo; lo comprueba verificacion/pruebas_funcionales.sql
-- (NO VERIFICADO hasta la prueba en learnity_test).
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'La migración 019 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'La 019 necesita la 018 (roles y dueños).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- Permisos explícitos actuales de learnity_app (tablas, vistas y secuencias).
INSERT INTO schema_migraciones (version, nombre, reversion)
SELECT '019', 'privilegios_minimos',
       jsonb_build_object('learnity_app', COALESCE(jsonb_agg(jsonb_build_object(
         'relacion', c.relname,
         'tipo', c.relkind::TEXT,
         'privilegio', a.privilege_type,
         'con_grant', a.is_grantable) ORDER BY c.relname, a.privilege_type), '[]'::JSONB))
  FROM pg_class c
       CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relkind IN ('r', 'v', 'S')
   AND a.grantee = 'learnity_app'::regrole;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM learnity_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM learnity_app;

-- learnity_app: solo lo que usan los repositorios, seed.ts y sembrar-catalogo.ts.
GRANT SELECT, INSERT, UPDATE         ON persona, usuario, solicitud_docente, docente, curso TO learnity_app;
GRANT SELECT, INSERT                 ON usuario_rol, categoria TO learnity_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON modulo, leccion, sesion, token_recuperacion, archivo_borrado_pendiente TO learnity_app;
GRANT SELECT, INSERT, DELETE         ON archivo TO learnity_app;
GRANT SELECT                         ON rol, recurso_adjunto, inscripcion TO learnity_app;
-- Sin permisos: progreso_leccion, evaluacion, pregunta, opcion, intento_evaluacion,
-- respuesta (Sprint 3/4) y schema_migraciones.

-- learnity_lectura: lectura sin datos sensibles.
GRANT SELECT ON persona, rol, usuario_rol, solicitud_docente, docente, categoria, curso, modulo,
                leccion, recurso_adjunto, inscripcion, progreso_leccion, evaluacion, pregunta,
                opcion, intento_evaluacion, respuesta, archivo_borrado_pendiente, schema_migraciones
  TO learnity_lectura;
GRANT SELECT (id_usuario, id_persona, correo, estado, intentos_fallidos, bloqueado_hasta, ultimo_acceso)
  ON usuario TO learnity_lectura;
GRANT SELECT (id_archivo, id_curso, tipo, nombre_original, tamano_bytes, alto_px, duracion_seg)
  ON archivo TO learnity_lectura;

COMMIT;
