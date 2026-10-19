-- =====================================================================
-- Pruebas funcionales de las migraciones 019–026 (todo se deshace).
--
-- Ejecutar con postgres en learnity_test: hace SET ROLE a learnity_app y a
-- learnity_lectura para probar los permisos reales, y prueba la auditoría,
-- actualizado_en, el CHECK, el índice único parcial y las vistas.
-- Todo corre dentro de BEGIN … ROLLBACK, así que no deja datos.
-- Las pruebas de una migración que no está aplicada salen como NO APLICA.
--
-- Salida: n | prueba | esperado | obtenido | resultado (OK, FALLA o NO APLICA),
-- más una fila final RESUMEN.
-- Uso: psql -At -F "|" -v ON_ERROR_STOP=1 -f pruebas_funcionales.sql
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'pruebas_funcionales.sql requiere postgres (hace SET ROLE a learnity_app y a learnity_lectura).';
  END IF;
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'pruebas_funcionales.sql solo corre en una base _test (conectado a %).', current_database();
  END IF;
END $$;

CREATE TEMP TABLE resultado (
  n         SERIAL,
  prueba    TEXT,
  esperado  TEXT,
  obtenido  TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE aplicadas (version TEXT) ON COMMIT DROP;
DO $$
BEGIN
  IF to_regclass('public.schema_migraciones') IS NOT NULL THEN
    EXECUTE 'INSERT INTO pg_temp.aplicadas SELECT version FROM public.schema_migraciones';
  END IF;
END $$;

-- Ejecuta una sentencia como p_rol dentro de una subtransacción que siempre se
-- deshace. Devuelve 'permitido', 'denegado' o el error.
CREATE FUNCTION pg_temp.intentar(p_rol TEXT, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $fn$
DECLARE
  v TEXT;
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', p_rol);
    EXECUTE p_sql;
    v := 'permitido';
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN insufficient_privilege THEN v := 'denegado';
    WHEN OTHERS THEN v := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RETURN v;
END
$fn$;

CREATE FUNCTION pg_temp.aplicada(p_version TEXT) RETURNS BOOLEAN
LANGUAGE sql AS $fn$ SELECT EXISTS (SELECT 1 FROM pg_temp.aplicadas WHERE version = p_version) $fn$;

CREATE FUNCTION pg_temp.anotar(p_prueba TEXT, p_version TEXT, p_esperado TEXT, p_obtenido TEXT) RETURNS VOID
LANGUAGE sql AS $fn$
  INSERT INTO pg_temp.resultado (prueba, esperado, obtenido)
  VALUES (p_prueba,
          CASE WHEN p_version IS NULL OR pg_temp.aplicada(p_version) THEN p_esperado ELSE 'NO APLICA' END,
          p_obtenido)
$fn$;

-- ---------------------------------------------------------------- 019: learnity_app
SELECT pg_temp.anotar('app: INSERT persona (identidad sin USAGE de secuencia)', '019', 'permitido',
       pg_temp.intentar('learnity_app', $q$INSERT INTO persona (nombres, apellidos) VALUES ('Prueba', 'Funcional')$q$));
SELECT pg_temp.anotar('app: INSERT sesion (identidad BIGINT)', '019', 'permitido',
       pg_temp.intentar('learnity_app', $q$INSERT INTO sesion (id_usuario, familia, token_hash, iniciada_en, expira_en)
                                           SELECT id_usuario, gen_random_uuid(), repeat('a', 64), now(), now() + interval '1 day'
                                             FROM usuario LIMIT 1$q$));
SELECT pg_temp.anotar('app: DELETE rol', '019', 'denegado',
       pg_temp.intentar('learnity_app', 'DELETE FROM rol WHERE false'));
SELECT pg_temp.anotar('app: UPDATE usuario_rol', '019', 'denegado',
       pg_temp.intentar('learnity_app', 'UPDATE usuario_rol SET asignado_en = asignado_en WHERE false'));
SELECT pg_temp.anotar('app: TRUNCATE curso', '019', 'denegado',
       pg_temp.intentar('learnity_app', 'TRUNCATE curso CASCADE'));
SELECT pg_temp.anotar('app: SELECT progreso_leccion (Sprint 3)', '019', 'denegado',
       pg_temp.intentar('learnity_app', 'SELECT 1 FROM progreso_leccion LIMIT 1'));
SELECT pg_temp.anotar('app: CREATE TABLE en public', '019', 'denegado',
       pg_temp.intentar('learnity_app', 'CREATE TABLE public.prueba_funcional (id INTEGER)'));
SELECT pg_temp.anotar('app: DELETE persona (solo con 019b)', '019',
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_pruebas')
                 AND pg_has_role('learnity_app', 'learnity_pruebas', 'MEMBER')
            THEN 'permitido' ELSE 'denegado' END,
       pg_temp.intentar('learnity_app', 'DELETE FROM persona WHERE false'));

-- ---------------------------------------------------------------- 019: learnity_lectura
SELECT pg_temp.anotar('lectura: SELECT usuario.id_usuario', '019', 'permitido',
       pg_temp.intentar('learnity_lectura', 'SELECT id_usuario FROM usuario LIMIT 1'));
SELECT pg_temp.anotar('lectura: SELECT usuario.contrasena_hash', '019', 'denegado',
       pg_temp.intentar('learnity_lectura', 'SELECT contrasena_hash FROM usuario LIMIT 1'));
SELECT pg_temp.anotar('lectura: SELECT archivo.ruta', '019', 'denegado',
       pg_temp.intentar('learnity_lectura', 'SELECT ruta FROM archivo LIMIT 1'));
SELECT pg_temp.anotar('lectura: SELECT sesion', '019', 'denegado',
       pg_temp.intentar('learnity_lectura', 'SELECT 1 FROM sesion LIMIT 1'));
SELECT pg_temp.anotar('lectura: INSERT categoria', '019', 'denegado',
       pg_temp.intentar('learnity_lectura', 'INSERT INTO categoria (nombre, creada_por) SELECT ''x'', 1 WHERE false'));

-- ---------------------------------------------------------------- 020: auditoría
SELECT pg_temp.anotar('app: SELECT auditoria_cambio', '020', 'denegado',
       pg_temp.intentar('learnity_app', 'SELECT 1 FROM auditoria_cambio LIMIT 1'));
SELECT pg_temp.anotar('app: INSERT auditoria_cambio', '020', 'denegado',
       pg_temp.intentar('learnity_app', $q$INSERT INTO auditoria_cambio (tabla, operacion, despues) VALUES ('x', 'INSERT', '{}')$q$));

DO $$
DECLARE
  v_obtenido TEXT;
  v_persona  INTEGER;
  v_usuario  INTEGER;
  v_ins      RECORD;
  v_upd      RECORD;
  v_nupd     INTEGER;
BEGIN
  IF NOT pg_temp.aplicada('020') THEN
    PERFORM pg_temp.anotar('auditoría de usuario (actor, sin hash, UPDATE sin cambios)', '020', 'ok', '-');
    RETURN;
  END IF;
  BEGIN
    SET LOCAL ROLE learnity_app;
    PERFORM set_config('learnity.id_persona', '987654', true);
    INSERT INTO persona (nombres, apellidos) VALUES ('Auditoria', 'Prueba') RETURNING id_persona INTO v_persona;
    INSERT INTO usuario (id_persona, correo, contrasena_hash)
    VALUES (v_persona, 'auditoria-' || v_persona || '@pruebas.test', repeat('x', 60))
    RETURNING id_usuario INTO v_usuario;
    UPDATE usuario SET contrasena_hash = repeat('y', 60) WHERE id_usuario = v_usuario;
    UPDATE usuario SET correo = correo WHERE id_usuario = v_usuario;          -- sin cambios: no se audita
    RESET ROLE;

    SELECT * INTO v_ins FROM auditoria_cambio
     WHERE tabla = 'usuario' AND operacion = 'INSERT' AND (despues ->> 'id_usuario')::INT = v_usuario;
    SELECT count(*) INTO v_nupd FROM auditoria_cambio
     WHERE tabla = 'usuario' AND operacion = 'UPDATE' AND (despues ->> 'id_usuario')::INT = v_usuario;
    SELECT * INTO v_upd FROM auditoria_cambio
     WHERE tabla = 'usuario' AND operacion = 'UPDATE' AND (despues ->> 'id_usuario')::INT = v_usuario;

    v_obtenido := CASE
      WHEN v_ins.id_auditoria IS NULL THEN 'sin fila de INSERT'
      WHEN v_ins.id_persona_actor IS DISTINCT FROM 987654 THEN 'actor ' || COALESCE(v_ins.id_persona_actor::TEXT, 'NULL')
      WHEN v_ins.usuario_bd <> session_user THEN 'usuario_bd ' || v_ins.usuario_bd
      WHEN v_ins.despues ? 'contrasena_hash' THEN 'INSERT guarda contrasena_hash'
      WHEN v_nupd <> 1 THEN v_nupd || ' filas de UPDATE (se esperaba 1)'
      WHEN v_upd.antes ? 'contrasena_hash' OR v_upd.despues ? 'contrasena_hash' THEN 'UPDATE guarda contrasena_hash'
      WHEN NOT ('contrasena_hash' = ANY (v_upd.columnas_cambiadas)) THEN 'columnas_cambiadas sin contrasena_hash'
      ELSE 'ok'
    END;
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('auditoría de usuario (actor, sin hash, UPDATE sin cambios)', '020', 'ok', v_obtenido);
END $$;

DO $$
DECLARE
  v_obtenido TEXT;
  v_persona  INTEGER;
  v_docente  INTEGER;
  v_cat      INTEGER;
  v_curso    INTEGER;
  v_archivo  INTEGER;
  v_despues  JSONB;
  v_actor    INTEGER;
BEGIN
  IF NOT pg_temp.aplicada('020') THEN
    PERFORM pg_temp.anotar('auditoría de archivo sin ruta; actor no numérico = NULL', '020', 'ok', '-');
    RETURN;
  END IF;
  BEGIN
    PERFORM set_config('learnity.id_persona', 'no-es-un-numero', true);
    INSERT INTO persona (nombres, apellidos) VALUES ('Docente', 'Prueba') RETURNING id_persona INTO v_persona;
    INSERT INTO docente (id_persona, especialidad) VALUES (v_persona, 'Pruebas') RETURNING id_docente INTO v_docente;
    INSERT INTO categoria (nombre, creada_por) VALUES ('Prueba funcional ' || v_persona, v_persona) RETURNING id_categoria INTO v_cat;
    INSERT INTO curso (id_docente, id_categoria, titulo) VALUES (v_docente, v_cat, 'Curso de prueba') RETURNING id_curso INTO v_curso;
    INSERT INTO archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes)
    VALUES (v_curso, 'PDF', 'guia.pdf', 'prueba-funcional-' || v_curso || '.pdf', 1000)
    RETURNING id_archivo INTO v_archivo;
    SELECT despues, id_persona_actor INTO v_despues, v_actor FROM auditoria_cambio
     WHERE tabla = 'archivo' AND operacion = 'INSERT' AND (despues ->> 'id_archivo')::INT = v_archivo;
    v_obtenido := CASE
      WHEN v_despues IS NULL THEN 'sin fila de INSERT'
      WHEN v_despues ? 'ruta' THEN 'guarda ruta'
      WHEN NOT v_despues ? 'nombre_original' THEN 'falta nombre_original'
      WHEN v_actor IS NOT NULL THEN 'actor no numérico guardado como ' || v_actor
      ELSE 'ok'
    END;
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('auditoría de archivo sin ruta; actor no numérico = NULL', '020', 'ok', v_obtenido);
END $$;

-- ---------------------------------------------------------------- 021: actualizado_en
DO $$
DECLARE
  v_obtenido TEXT;
  v_persona  INTEGER;
  v_valor    TIMESTAMPTZ;
BEGIN
  IF NOT pg_temp.aplicada('021') THEN
    PERFORM pg_temp.anotar('actualizado_en lo fija el trigger', '021', 'ok', '-');
    RETURN;
  END IF;
  BEGIN
    INSERT INTO persona (nombres, apellidos) VALUES ('Fecha', 'Prueba') RETURNING id_persona INTO v_persona;
    UPDATE persona SET nombres = 'Fecha2', actualizado_en = '2000-01-01' WHERE id_persona = v_persona;
    SELECT actualizado_en INTO v_valor FROM persona WHERE id_persona = v_persona;
    v_obtenido := CASE WHEN v_valor = now() THEN 'ok' ELSE 'quedó ' || v_valor END;
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('actualizado_en lo fija el trigger', '021', 'ok', v_obtenido);
END $$;

-- ---------------------------------------------------------------- 023: CHECK de PUBLICADO
DO $$
DECLARE
  v_obtenido TEXT;
  v_persona  INTEGER;
  v_docente  INTEGER;
  v_cat      INTEGER;
BEGIN
  BEGIN
    INSERT INTO persona (nombres, apellidos) VALUES ('Check', 'Prueba') RETURNING id_persona INTO v_persona;
    INSERT INTO docente (id_persona, especialidad) VALUES (v_persona, 'Pruebas') RETURNING id_docente INTO v_docente;
    INSERT INTO categoria (nombre, creada_por) VALUES ('Prueba check ' || v_persona, v_persona) RETURNING id_categoria INTO v_cat;
    INSERT INTO curso (id_docente, id_categoria, titulo, estado) VALUES (v_docente, v_cat, 'Publicado sin revisor', 'PUBLICADO');
    v_obtenido := 'aceptado';
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN check_violation THEN v_obtenido := 'rechazado';
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('curso PUBLICADO sin revisor', '023', 'rechazado', v_obtenido);
END $$;

-- ---------------------------------------------------------------- 024: una PENDIENTE por persona
DO $$
DECLARE
  v_obtenido TEXT;
  v_persona  INTEGER;
  v_motivo   TEXT := repeat('Quiero enseñar en Learnity. ', 3);
BEGIN
  BEGIN
    INSERT INTO persona (nombres, apellidos) VALUES ('Solicitud', 'Prueba') RETURNING id_persona INTO v_persona;
    INSERT INTO solicitud_docente (id_persona, especialidad, motivo) VALUES (v_persona, 'Pruebas', v_motivo);
    INSERT INTO solicitud_docente (id_persona, especialidad, motivo) VALUES (v_persona, 'Pruebas', v_motivo);
    v_obtenido := 'aceptada';
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN unique_violation THEN v_obtenido := 'rechazada';
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('segunda solicitud PENDIENTE de la misma persona', '024', 'rechazada', v_obtenido);
END $$;

-- ---------------------------------------------------------------- 026: vistas
SELECT pg_temp.anotar('vistas sin columnas prohibidas', '026', '0',
       (SELECT count(*)::TEXT FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name IN ('catalogo_categoria', 'catalogo_curso', 'catalogo_temario')
           AND column_name IN ('ruta', 'id_archivo', 'nombre_original', 'correo',
                               'contrasena_hash', 'token_hash', 'vista_previa', 'estado')));
SELECT pg_temp.anotar('app: SELECT catalogo_curso', '026', 'permitido',
       pg_temp.intentar('learnity_app', 'SELECT * FROM catalogo_curso LIMIT 1'));
SELECT pg_temp.anotar('app: SELECT catalogo_temario', '026', 'permitido',
       pg_temp.intentar('learnity_app', 'SELECT * FROM catalogo_temario LIMIT 1'));
SELECT pg_temp.anotar('app: SELECT catalogo_categoria', '026', 'permitido',
       pg_temp.intentar('learnity_app', 'SELECT * FROM catalogo_categoria LIMIT 1'));
SELECT pg_temp.anotar('lectura: SELECT catalogo_curso', '026', 'permitido',
       pg_temp.intentar('learnity_lectura', 'SELECT * FROM catalogo_curso LIMIT 1'));
DO $$
DECLARE
  v_obtenido TEXT := '-';
BEGIN
  IF to_regclass('public.catalogo_curso') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*)::TEXT FROM curso c
                WHERE c.estado <> 'PUBLICADO'
                  AND c.id_curso IN (SELECT id FROM catalogo_curso)$q$ INTO v_obtenido;
  END IF;
  PERFORM pg_temp.anotar('vistas: solo cursos PUBLICADO', '026', '0', v_obtenido);
END $$;

-- ---------------------------------------------------------------- Resultado
SELECT n, prueba, esperado, obtenido,
       CASE WHEN esperado = 'NO APLICA' THEN 'NO APLICA'
            WHEN esperado = obtenido THEN 'OK'
            ELSE 'FALLA' END AS resultado
  FROM pg_temp.resultado
UNION ALL
SELECT 999, 'RESUMEN', current_database(),
       (SELECT count(*) FROM pg_temp.resultado
         WHERE esperado <> 'NO APLICA' AND esperado <> obtenido)::TEXT || ' fallas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_temp.resultado WHERE esperado <> 'NO APLICA' AND esperado <> obtenido)
            THEN 'PRUEBAS CON FALLAS' ELSE 'PRUEBAS OK' END
ORDER BY 1;

ROLLBACK;
