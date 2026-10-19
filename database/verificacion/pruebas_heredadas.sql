-- =====================================================================
-- Prueba de la decisión BD-022 con filas heredadas (todo se deshace).
--
-- Simula, antes de la 022 y la 023, cursos PUBLICADO sin revisor o sin fecha
-- como los 3 de Learnity, aplica las migraciones reales y comprueba que:
--   * la 022 los inventaría en curso_publicado_sin_revision y no toca curso;
--   * siguen PUBLICADO y siguen en catalogo_curso;
--   * la 023 deja el CHECK NOT VALID: rechaza un INSERT nuevo PUBLICADO sin
--     revisor y un UPDATE que deje inválida una fila heredada;
--   * VALIDATE CONSTRAINT falla con ellas y pasa sin ellas.
--
-- No se ejecuta suelto: lo compone probar-migraciones.ps1 cuando la base está
-- justo antes de la 022 (017–021 aplicadas). Sustituye la línea
-- "-- @migraciones" por el cuerpo de cada migración pendiente, sin su BEGIN ni
-- su COMMIT y seguida de RESET ROLE: primero las no retenidas en orden (022,
-- 024–026) y al final las retenidas (023), como se aplicarían en Learnity.
-- Todo va en una sola transacción que termina en ROLLBACK.
--
-- Salida: n | prueba | esperado | obtenido | resultado (OK o FALLA), más una
-- fila final RESUMEN.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'pruebas_heredadas.sql requiere postgres (aplica migraciones y hace SET ROLE a learnity_app).';
  END IF;
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'pruebas_heredadas.sql solo corre en una base _test (conectado a %).', current_database();
  END IF;
  IF to_regclass('public.schema_migraciones') IS NULL
     OR NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '020')
     OR EXISTS (SELECT 1 FROM schema_migraciones WHERE version IN ('022', '023')) THEN
    RAISE EXCEPTION 'pruebas_heredadas.sql necesita la base con la 020 aplicada y sin la 022 ni la 023.';
  END IF;
END $$;

CREATE TEMP TABLE resultado (
  n         SERIAL,
  prueba    TEXT,
  esperado  TEXT,
  obtenido  TEXT
) ON COMMIT DROP;

-- papel: 'heredado' (incumple la regla) o 'valido' (no debe aparecer en el inventario).
CREATE TEMP TABLE caso (id_curso INTEGER, papel TEXT) ON COMMIT DROP;
CREATE TEMP TABLE contexto (docente INTEGER, categoria INTEGER, revisor INTEGER) ON COMMIT DROP;
CREATE TEMP TABLE foto (momento TEXT, huella TEXT) ON COMMIT DROP;

-- Ejecuta p_sql (como p_rol, o como postgres si es NULL) dentro de una
-- subtransacción que siempre se deshace. Devuelve 'aceptado', 'denegado',
-- 'rechazado (SQLSTATE)' para violaciones de restricciones o el error.
CREATE FUNCTION pg_temp.intentar(p_rol TEXT, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $fn$
DECLARE
  v TEXT;
BEGIN
  BEGIN
    IF p_rol IS NOT NULL THEN
      EXECUTE format('SET LOCAL ROLE %I', p_rol);
    END IF;
    EXECUTE p_sql;
    v := 'aceptado';
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN insufficient_privilege THEN v := 'denegado';
    WHEN integrity_constraint_violation THEN v := 'rechazado (' || SQLSTATE || ')';
    WHEN OTHERS THEN v := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  RETURN v;
END
$fn$;

CREATE FUNCTION pg_temp.anotar(p_prueba TEXT, p_esperado TEXT, p_obtenido TEXT) RETURNS VOID
LANGUAGE sql AS $fn$
  INSERT INTO pg_temp.resultado (prueba, esperado, obtenido) VALUES (p_prueba, p_esperado, COALESCE(p_obtenido, 'NULL'))
$fn$;

-- Filas de curso (todas las columnas y su ctid): un UPDATE, aunque no cambie
-- nada, crea otra versión de la fila y cambia el ctid.
CREATE FUNCTION pg_temp.huella_curso() RETURNS TEXT
LANGUAGE sql AS $fn$
  SELECT md5(COALESCE(string_agg(c.ctid::TEXT || '|' || c::TEXT, E'\n' ORDER BY c.id_curso), ''))
    FROM public.curso c
$fn$;

-- ---------------------------------------------------------------- Filas heredadas
DO $$
DECLARE
  v_persona INTEGER;
  v_docente INTEGER;
  v_cat     INTEGER;
  v_revisor INTEGER;
BEGIN
  INSERT INTO persona (nombres, apellidos) VALUES ('Heredado', 'Docente') RETURNING id_persona INTO v_persona;
  INSERT INTO docente (id_persona, especialidad) VALUES (v_persona, 'Pruebas') RETURNING id_docente INTO v_docente;
  INSERT INTO categoria (nombre, creada_por) VALUES ('Prueba heredados ' || v_persona, v_persona) RETURNING id_categoria INTO v_cat;
  INSERT INTO persona (nombres, apellidos) VALUES ('Heredado', 'Revisor') RETURNING id_persona INTO v_revisor;
  INSERT INTO pg_temp.contexto VALUES (v_docente, v_cat, v_revisor);

  WITH nuevos AS (
    INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
    VALUES (v_docente, v_cat, 'Heredado sin revisor ni fecha', 'PUBLICADO', NULL,      NULL),
           (v_docente, v_cat, 'Heredado sin revisor',          'PUBLICADO', NULL,      now() - interval '30 days'),
           (v_docente, v_cat, 'Heredado sin fecha',            'PUBLICADO', v_revisor, NULL),
           (v_docente, v_cat, 'Publicado con revisor y fecha', 'PUBLICADO', v_revisor, now() - interval '10 days'),
           (v_docente, v_cat, 'Borrador sin revisor',          'BORRADOR',  NULL,      NULL)
    RETURNING id_curso, estado, revisado_por, publicado_en
  )
  INSERT INTO pg_temp.caso
  SELECT id_curso,
         CASE WHEN estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL)
              THEN 'heredado' ELSE 'valido' END
    FROM nuevos;
END $$;

INSERT INTO pg_temp.foto VALUES ('antes', pg_temp.huella_curso());

-- ---------------------------------------------------------------- Migraciones
-- @migraciones

-- ---------------------------------------------------------------- Comprobaciones
DO $$
BEGIN
  IF to_regclass('public.curso_publicado_sin_revision') IS NULL
     OR to_regclass('public.catalogo_curso') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conrelid = 'public.curso'::regclass AND conname = 'curso_publicado_revisado') THEN
    RAISE EXCEPTION 'Faltan la 022, la 023 o la 026: este archivo lo compone probar-migraciones.ps1.';
  END IF;
END $$;

INSERT INTO pg_temp.foto VALUES ('despues', pg_temp.huella_curso());

-- 022
SELECT pg_temp.anotar('022: inventaría los heredados y no los válidos (id_curso)',
       (SELECT string_agg(id_curso::TEXT, ',' ORDER BY id_curso) FROM pg_temp.caso WHERE papel = 'heredado'),
       (SELECT string_agg(v.id_curso::TEXT, ',' ORDER BY v.id_curso)
          FROM curso_publicado_sin_revision v JOIN pg_temp.caso c USING (id_curso)));
SELECT pg_temp.anotar('022 a 026 y 023: curso no cambia (columnas y ctid)', 'sin cambios',
       (SELECT CASE WHEN a.huella = d.huella THEN 'sin cambios' ELSE 'cambió' END
          FROM pg_temp.foto a, pg_temp.foto d WHERE a.momento = 'antes' AND d.momento = 'despues'));
SELECT pg_temp.anotar('022 a 026 y 023: auditoría sin UPDATE ni DELETE de los casos', '0',
       (SELECT count(*)::TEXT FROM auditoria_cambio a
         WHERE a.tabla = 'curso' AND a.operacion <> 'INSERT'
           AND COALESCE(a.antes, a.despues) ->> 'id_curso' IN (SELECT id_curso::TEXT FROM pg_temp.caso)));

-- Catálogo
SELECT pg_temp.anotar('heredados siguen PUBLICADO', '3',
       (SELECT count(*)::TEXT FROM curso c JOIN pg_temp.caso k USING (id_curso)
         WHERE k.papel = 'heredado' AND c.estado = 'PUBLICADO'));
SELECT pg_temp.anotar('heredados siguen en catalogo_curso', '3',
       (SELECT count(*)::TEXT FROM catalogo_curso v JOIN pg_temp.caso k ON k.id_curso = v.id
         WHERE k.papel = 'heredado'));

-- 023
SELECT pg_temp.anotar('023: CHECK curso_publicado_revisado', 'NOT VALID',
       (SELECT CASE WHEN convalidated THEN 'VALIDADO' ELSE 'NOT VALID' END
          FROM pg_constraint WHERE conrelid = 'public.curso'::regclass AND conname = 'curso_publicado_revisado'));
SELECT pg_temp.anotar('app: INSERT nuevo PUBLICADO sin revisor', 'rechazado (23514)',
       pg_temp.intentar('learnity_app', format(
         $q$INSERT INTO curso (id_docente, id_categoria, titulo, estado, publicado_en)
            VALUES (%s, %s, 'Nuevo sin revisor', 'PUBLICADO', now())$q$, k.docente, k.categoria)))
  FROM pg_temp.contexto k;
SELECT pg_temp.anotar('app: INSERT nuevo PUBLICADO con revisor y fecha', 'aceptado',
       pg_temp.intentar('learnity_app', format(
         $q$INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
            VALUES (%s, %s, 'Nuevo con revisor', 'PUBLICADO', %s, now())$q$, k.docente, k.categoria, k.revisor)))
  FROM pg_temp.contexto k;
-- Efecto documentado: cualquier UPDATE de una fila heredada que la deje inválida
-- se rechaza, aunque no toque estado, revisado_por ni publicado_en.
SELECT pg_temp.anotar('app: UPDATE de un heredado que lo deja inválido (subtitulo)', 'rechazado (23514)',
       pg_temp.intentar('learnity_app', format(
         $q$UPDATE curso SET subtitulo = 'Editado' WHERE id_curso = %s$q$,
         (SELECT min(id_curso) FROM pg_temp.caso WHERE papel = 'heredado'))));
SELECT pg_temp.anotar('app: UPDATE de un heredado que lo corrige (revisor y fecha)', 'aceptado',
       pg_temp.intentar('learnity_app', format(
         $q$UPDATE curso SET revisado_por = %s, publicado_en = COALESCE(publicado_en, now()) WHERE id_curso = %s$q$,
         k.revisor, (SELECT min(id_curso) FROM pg_temp.caso WHERE papel = 'heredado'))))
  FROM pg_temp.contexto k;
SELECT pg_temp.anotar('VALIDATE CONSTRAINT con filas heredadas', 'rechazado (23514)',
       pg_temp.intentar(NULL, 'ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado'));
DO $$
DECLARE
  v_obtenido TEXT;
BEGIN
  BEGIN
    DELETE FROM curso WHERE id_curso IN (SELECT id_curso FROM curso_publicado_sin_revision);
    ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado;
    v_obtenido := 'aceptado';
    RAISE EXCEPTION USING ERRCODE = 'LRN01';
  EXCEPTION
    WHEN SQLSTATE 'LRN01' THEN NULL;
    WHEN integrity_constraint_violation THEN v_obtenido := 'rechazado (' || SQLSTATE || ')';
    WHEN OTHERS THEN v_obtenido := 'error ' || SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.anotar('VALIDATE CONSTRAINT sin filas heredadas (tras borrarlas)', 'aceptado', v_obtenido);
END $$;

-- ---------------------------------------------------------------- Resultado
SELECT n, prueba, esperado, obtenido,
       CASE WHEN esperado = obtenido THEN 'OK' ELSE 'FALLA' END AS resultado
  FROM pg_temp.resultado
UNION ALL
SELECT 999, 'RESUMEN', current_database(),
       (SELECT count(*) FROM pg_temp.resultado WHERE esperado IS DISTINCT FROM obtenido)::TEXT || ' fallas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_temp.resultado WHERE esperado IS DISTINCT FROM obtenido)
            THEN 'PRUEBAS CON FALLAS' ELSE 'PRUEBAS OK' END
ORDER BY 1;

ROLLBACK;
