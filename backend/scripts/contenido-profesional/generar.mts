/**
 * Genera database/contenido_profesional.sql (limpieza + catálogo profesional, idempotente) y
 * database/contenido_profesional_vista_previa.sql (solo lectura) a partir de catalogo.ts.
 *
 *   npm run contenido:generar
 *
 * No se conecta a ninguna base: solo escribe los dos archivos SQL, que se ejecutan como postgres
 * (psql en local o el SQL Editor de Supabase).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ACTIVIDAD, CATEGORIAS, CUENTAS, CURSOS, DOCENTES, REVISORA } from './catalogo.js';
import { crearPdf } from './pdf.js';
import type { Apunte, Curso } from './tipos.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const errores: string[] = [];
const exigir = (condicion: unknown, mensaje: string) => { if (!condicion) errores.push(mensaje); };
const largo = (texto: string, max: number, donde: string) => exigir(texto.trim().length > 0 && texto.length <= max, `${donde}: longitud ${texto.length} (máx. ${max})`);

function pdf(apunte: Apunte, curso: Curso) {
  largo(apunte.archivo, 200, `archivo ${apunte.archivo}`);
  exigir(apunte.archivo.endsWith('.pdf'), `${apunte.archivo} debe terminar en .pdf`);
  const bytes = crearPdf({ ...apunte, curso: curso.titulo, autor: curso.nombreAutor });
  exigir(bytes.length <= 10 * 1024 * 1024, `${apunte.archivo} supera 10 MiB`);
  return { nombre: apunte.archivo, titulo: apunte.titulo, b64: bytes.toString('base64'), bytes: bytes.length };
}

let totalPdf = 0;
let bytesPdf = 0;
const cursos = CURSOS.map((c) => {
  largo(c.titulo, 150, `curso ${c.clave}`);
  largo(c.subtitulo, 200, `subtítulo ${c.clave}`);
  exigir(CUENTAS.includes(c.autor) && DOCENTES.some((d) => d.correo === c.autor), `${c.clave}: autor sin cuenta/docente`);
  exigir(CATEGORIAS.some((k) => k.nombre === c.categoria), `${c.clave}: categoría ${c.categoria} no declarada`);
  exigir(c.modulos.length >= 1 && c.modulos.length <= 10, `${c.clave}: 1 a 10 módulos`);
  return {
    clave: c.clave, titulo: c.titulo, subtitulo: c.subtitulo, descripcion: c.descripcion, nivel: c.nivel,
    categoria: c.categoria, autor: c.autor, publicadoHaceDias: c.publicadoHaceDias,
    objetivos: c.objetivos, requisitos: c.requisitos,
    modulos: c.modulos.map((m, i) => {
      largo(m.titulo, 150, `${c.clave} módulo ${i + 1}`);
      exigir(m.lecciones.length >= 1 && m.lecciones.length <= 12, `${c.clave} módulo ${i + 1}: 1 a 12 lecciones`);
      return {
        titulo: m.titulo,
        lecciones: m.lecciones.map((l) => {
          largo(l.titulo, 150, `lección «${l.titulo}»`);
          if (l.tipo === 'VIDEO') {
            exigir(/^[A-Za-z0-9_-]{11}$/.test(l.youtube), `id de YouTube inválido: ${l.youtube}`);
            return { tipo: l.tipo, titulo: l.titulo, youtube: l.youtube, segundos: l.minutos * 60 };
          }
          if (l.tipo === 'DOCUMENTO') {
            const archivo = pdf(l.apunte, c);
            const recursos = (l.recursos ?? []).map((r) => pdf(r, c));
            for (const p of [archivo, ...recursos]) { totalPdf++; bytesPdf += p.bytes; largo(p.titulo, 150, `recurso ${p.nombre}`); }
            return { tipo: l.tipo, titulo: l.titulo, segundos: 0, archivo, recursos };
          }
          exigir(l.preguntas.length >= 1 && l.preguntas.length <= 10, `«${l.titulo}»: 1 a 10 preguntas`);
          exigir(l.aprobacion >= 1 && l.aprobacion <= 100, `«${l.titulo}»: aprobación 1-100`);
          for (const p of l.preguntas) {
            largo(p.enunciado, 300, `pregunta «${p.enunciado.slice(0, 40)}»`);
            p.opciones.forEach((o) => largo(o, 200, `opción «${o.slice(0, 40)}»`));
          }
          return { tipo: l.tipo, titulo: l.titulo, segundos: 0, aprobacion: l.aprobacion, preguntas: l.preguntas };
        }),
      };
    }),
  };
});

exigir(new Set(CURSOS.map((c) => c.clave)).size === CURSOS.length, 'claves de curso repetidas');
for (const a of ACTIVIDAD) {
  const curso = CURSOS.find((c) => c.clave === a.curso);
  const donde = `actividad ${a.curso} / ${a.estudiante}`;
  exigir(curso, `${donde}: curso inexistente`);
  exigir(CUENTAS.includes(a.estudiante), `${donde}: cuenta no declarada`);
  if (!curso) continue;
  exigir(curso.autor !== a.estudiante, `${donde}: el docente no se inscribe en su propio curso`);
  exigir(a.inscritoHaceDias < curso.publicadoHaceDias, `${donde}: inscripción anterior a la publicación`);
  const total = curso.modulos.reduce((n, m) => n + m.lecciones.length, 0);
  if (a.lecciones !== 'todas') exigir(a.lecciones >= 0 && a.lecciones < total, `${donde}: ${a.lecciones} de ${total} lecciones`);
  if (a.resena) {
    largo(a.resena.comentario, 1000, `${donde}: reseña`);
    exigir(a.resena.haceDias + 1 < a.inscritoHaceDias, `${donde}: reseña anterior a la inscripción`);
    for (const h of a.hilo ?? []) {
      largo(h.comentario, 1000, `${donde}: comentario del hilo`);
      exigir(CUENTAS.includes(h.autor), `${donde}: autor del hilo no declarado`);
      exigir(h.haceDias <= a.resena.haceDias, `${donde}: comentario anterior a la reseña`);
    }
  } else {
    exigir(!a.hilo?.length, `${donde}: hilo sin reseña`);
  }
}
exigir(new Set(ACTIVIDAD.map((a) => `${a.curso}|${a.estudiante}`)).size === ACTIVIDAD.length, 'inscripciones repetidas');

if (errores.length) {
  console.error(`El catálogo no es válido:\n- ${errores.join('\n- ')}`);
  process.exit(1);
}

const catalogo = JSON.stringify({
  cuentas: CUENTAS, revisora: REVISORA, docentes: DOCENTES, categorias: CATEGORIAS, cursos, actividad: ACTIVIDAD,
});
if (catalogo.includes('$catalogo$')) throw new Error('El catálogo contiene el delimitador $catalogo$.');

const lit = (s: string) => `'${s.replaceAll("'", "''")}'`;
const filasConservadas = CURSOS.map((c) => `    (${lit(c.autor)}, ${lit(c.titulo)})`).join(',\n');

const vistaPrevia = `-- =====================================================================
-- Vista previa (SOLO LECTURA) de database/contenido_profesional.sql
-- Generado por backend/scripts/contenido-profesional/generar.mts; no lo edites a mano.
--
-- Lista los cursos que el script ELIMINARÍA con todo su contenido (módulos, lecciones, archivos,
-- inscripciones, reseñas e hilos) y comprueba que existen las cuentas autoras.
-- No modifica nada: ejecútalo antes del script principal y revisa el resultado.
-- =====================================================================
WITH conservar (correo, titulo) AS (
  VALUES
${filasConservadas}
)
SELECT c.id_curso, c.estado, c.titulo, u.correo AS docente,
       (SELECT count(*) FROM inscripcion i WHERE i.id_curso = c.id_curso) AS inscripciones,
       (SELECT count(*) FROM resena r JOIN inscripcion i USING (id_inscripcion) WHERE i.id_curso = c.id_curso) AS resenas,
       (SELECT count(*) FROM archivo a WHERE a.id_curso = c.id_curso) AS archivos
  FROM curso c
  JOIN docente d ON d.id_docente = c.id_docente
  JOIN usuario u ON u.id_persona = d.id_persona
 WHERE NOT EXISTS (SELECT 1 FROM conservar k WHERE lower(k.correo) = lower(u.correo) AND k.titulo = c.titulo)
 ORDER BY c.id_curso;

-- Cuentas autoras: todas deben aparecer con existe = true.
SELECT x.correo, EXISTS (SELECT 1 FROM usuario u WHERE lower(u.correo) = lower(x.correo)) AS existe
  FROM (VALUES ${CUENTAS.map((c) => `(${lit(c)})`).join(', ')}) AS x(correo);
`;

const script = `-- =====================================================================
-- Learnity · Limpieza del contenido de prueba y catálogo profesional
-- Generado por backend/scripts/contenido-profesional/generar.mts; no lo edites a mano.
--
-- Qué hace, en una sola transacción (si algo falla, no cambia nada):
--   1. Comprueba que existen las cuentas autoras (${CUENTAS.length}) y las migraciones 040/041.
--   2. Habilita el perfil docente de las autoras que aún no lo tienen (rol, solicitud aprobada y docente).
--   3. Crea las categorías que falten.
--   4. ELIMINA todos los cursos que no son del catálogo profesional, con sus módulos, lecciones,
--      evaluaciones, archivos, inscripciones, progreso, reseñas, hilos y reportes.
--   5. Crea los ${cursos.length} cursos publicados con ${totalPdf} PDF propios y vídeos de YouTube verificados.
--   6. Registra inscripciones, avance, evaluaciones aprobadas, reseñas y debates entre las cuentas autoras.
--
-- No modifica cuentas, contraseñas, fotos ni datos personales. Es idempotente: si un curso del
-- catálogo ya existe, lo deja intacto (con su actividad) y no lo duplica.
--
-- Ejecútalo como postgres (psql o SQL Editor de Supabase) DESPUÉS de sincronizar_supabase_041.sql
-- y de revisar contenido_profesional_vista_previa.sql. Haz un respaldo antes: el borrado es definitivo.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '10min';

CREATE FUNCTION pg_temp.learnity_pdf(p_curso INTEGER, p_nombre TEXT, p_b64 TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $f$
DECLARE
  v_bytes BYTEA := decode(p_b64, 'base64');
  v_ruta  TEXT  := gen_random_uuid()::text || '.pdf';
  v_id    INTEGER;
BEGIN
  -- Mismo almacenamiento que una subida: bytes en archivo_binario y metadatos en archivo.
  INSERT INTO public.archivo_binario (nombre, bytes) VALUES (v_ruta, v_bytes);
  INSERT INTO public.archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes)
  VALUES (p_curso, 'PDF', p_nombre, v_ruta, octet_length(v_bytes))
  RETURNING id_archivo INTO v_id;
  RETURN v_id;
END
$f$;

CREATE TEMP TABLE _cuenta (correo TEXT PRIMARY KEY, id_persona INTEGER NOT NULL, id_usuario INTEGER NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE _curso_nuevo (clave TEXT PRIMARY KEY, id_curso INTEGER NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE _leccion_nueva (
  id_curso INTEGER NOT NULL, posicion INTEGER NOT NULL, id_leccion INTEGER NOT NULL, segundos INTEGER NOT NULL,
  PRIMARY KEY (id_curso, posicion)
) ON COMMIT DROP;

DO $contenido$
DECLARE
  cat           JSONB := $catalogo$${catalogo}$catalogo$::jsonb;
  c JSONB; m JSONB; l JSONB; p JSONB; r JSONB; a JSONB; h JSONB;
  i INTEGER; j INTEGER; k INTEGER; n INTEGER;
  v_faltan      TEXT;
  v_rol_docente SMALLINT;
  v_revisora    INTEGER;
  v_persona     INTEGER;
  v_usuario     INTEGER;
  v_docente     INTEGER;
  v_categoria   INTEGER;
  v_curso       INTEGER;
  v_modulo      INTEGER;
  v_leccion     INTEGER;
  v_archivo     INTEGER;
  v_evaluacion  INTEGER;
  v_pregunta    INTEGER;
  v_intento     INTEGER;
  v_inscripcion INTEGER;
  v_resena      INTEGER;
  v_ultima      INTEGER;
  v_total       INTEGER;
  v_hechas      INTEGER;
  v_pct         INTEGER;
  v_publicado   TIMESTAMPTZ;
  v_inscrito    TIMESTAMPTZ;
  v_actividad   TIMESTAMPTZ;
  v_borrar      INTEGER[];
  v_rutas       TEXT[];
  v_fotos       TEXT[];
  v_titulos     TEXT;
BEGIN
  -- 1. Requisitos ------------------------------------------------------------------------------
  IF to_regclass('public.archivo_binario') IS NULL OR to_regclass('public.resena_respuesta') IS NULL THEN
    RAISE EXCEPTION 'Faltan las migraciones 040/041 (archivo_binario, resena_respuesta). Ejecuta antes database/sincronizar_supabase_041.sql.';
  END IF;

  SELECT string_agg(x, ', ') INTO v_faltan
    FROM jsonb_array_elements_text(cat->'cuentas') x
   WHERE NOT EXISTS (SELECT 1 FROM public.usuario u WHERE lower(u.correo) = lower(x));
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan estas cuentas; regístralas antes de ejecutar el script: %', v_faltan;
  END IF;

  INSERT INTO _cuenta (correo, id_persona, id_usuario)
  SELECT lower(u.correo), u.id_persona, u.id_usuario
    FROM public.usuario u
   WHERE lower(u.correo) IN (SELECT lower(x) FROM jsonb_array_elements_text(cat->'cuentas') x);

  SELECT id_rol INTO v_rol_docente FROM public.rol WHERE nombre = 'DOCENTE';
  SELECT id_persona INTO v_revisora FROM _cuenta WHERE correo = lower(cat->>'revisora');
  IF v_rol_docente IS NULL THEN RAISE EXCEPTION 'Falta el rol DOCENTE.'; END IF;

  -- 2. Perfiles docentes -----------------------------------------------------------------------
  FOR c IN SELECT e FROM jsonb_array_elements(cat->'docentes') e LOOP
    SELECT id_persona, id_usuario INTO v_persona, v_usuario FROM _cuenta WHERE correo = lower(c->>'correo');
    INSERT INTO public.usuario_rol (id_usuario, id_rol, asignado_por)
    VALUES (v_usuario, v_rol_docente, v_revisora)
    ON CONFLICT (id_usuario, id_rol) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.docente WHERE id_persona = v_persona) THEN
      INSERT INTO public.solicitud_docente (id_persona, especialidad, motivo, estado, revisada_por, revisada_en)
      VALUES (v_persona, c->>'especialidad', c->>'motivo', 'APROBADA', v_revisora, now());
      INSERT INTO public.docente (id_persona, especialidad) VALUES (v_persona, c->>'especialidad');
      RAISE NOTICE '+ perfil docente: %', c->>'correo';
    ELSIF EXISTS (SELECT 1 FROM public.docente WHERE id_persona = v_persona AND estado <> 'ACTIVO') THEN
      RAISE WARNING '% tiene el perfil docente INACTIVO: reactívalo desde el panel para que sus cursos se muestren.', c->>'correo';
    END IF;
  END LOOP;

  -- 3. Categorías ------------------------------------------------------------------------------
  FOR c IN SELECT e FROM jsonb_array_elements(cat->'categorias') e LOOP
    SELECT id_categoria INTO v_categoria FROM public.categoria WHERE lower(nombre) = lower(c->>'nombre');
    IF v_categoria IS NULL THEN
      INSERT INTO public.categoria (nombre, descripcion, activa, creada_por, icono)
      VALUES (c->>'nombre', c->>'descripcion', true, v_revisora, c->>'icono');
      RAISE NOTICE '+ categoría: %', c->>'nombre';
    ELSE
      UPDATE public.categoria SET activa = true WHERE id_categoria = v_categoria AND NOT activa;
      IF FOUND THEN RAISE NOTICE '~ categoría reactivada: %', c->>'nombre'; END IF;
    END IF;
  END LOOP;

  -- 4. Limpieza de cursos ajenos al catálogo ---------------------------------------------------
  SELECT coalesce(array_agg(cu.id_curso), '{}'), string_agg(cu.titulo, ' | ')
    INTO v_borrar, v_titulos
    FROM public.curso cu
   WHERE NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(cat->'cursos') x
       JOIN _cuenta ca ON ca.correo = lower(x->>'autor')
       JOIN public.docente d ON d.id_persona = ca.id_persona
      WHERE d.id_docente = cu.id_docente AND cu.titulo = x->>'titulo');

  SELECT coalesce(array_agg(ruta), '{}') INTO v_rutas FROM public.archivo WHERE id_curso = ANY (v_borrar);
  -- Portadas subidas a la plataforma que ninguna persona ni otro curso usa.
  SELECT coalesce(array_agg(DISTINCT 'fotos/' || substr(cu.portada_url, 12)), '{}') INTO v_fotos
    FROM public.curso cu
   WHERE cu.id_curso = ANY (v_borrar) AND cu.portada_url LIKE '/api/fotos/%'
     AND NOT EXISTS (SELECT 1 FROM public.persona pe WHERE pe.foto_url = cu.portada_url)
     AND NOT EXISTS (SELECT 1 FROM public.curso o WHERE o.portada_url = cu.portada_url AND NOT (o.id_curso = ANY (v_borrar)));

  RAISE NOTICE 'Cursos eliminados: % %', cardinality(v_borrar), coalesce('(' || v_titulos || ')', '');

  DELETE FROM public.alerta_seguridad
   WHERE tipo = 'REPORTE_CURSO' AND split_part(clave, ':', 2) = ANY (SELECT x::text FROM unnest(v_borrar) x);
  -- inscripcion no se borra en cascada desde curso; al borrarla caen progreso, intentos, reseñas, hilos y reportes.
  DELETE FROM public.inscripcion WHERE id_curso = ANY (v_borrar);
  -- leccion -> archivo es NO ACTION: primero las lecciones (caen evaluaciones y recursos), luego el curso.
  DELETE FROM public.leccion le USING public.modulo mo
   WHERE le.id_modulo = mo.id_modulo AND mo.id_curso = ANY (v_borrar);
  DELETE FROM public.curso WHERE id_curso = ANY (v_borrar);
  DELETE FROM public.archivo_binario WHERE nombre = ANY (v_rutas) OR nombre = ANY (v_fotos);
  -- Copias en disco del servidor: el limpiador de la API las retira de la cola.
  INSERT INTO public.archivo_borrado_pendiente (nombre)
  SELECT x FROM unnest(v_rutas) x
   WHERE x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(pdf|ppt|pptx|zip)$'
  ON CONFLICT (nombre) DO UPDATE SET disponible_desde = LEAST(public.archivo_borrado_pendiente.disponible_desde, now());

  -- 5. Cursos del catálogo ---------------------------------------------------------------------
  FOR c IN SELECT e FROM jsonb_array_elements(cat->'cursos') e LOOP
    SELECT d.id_docente INTO v_docente
      FROM public.docente d JOIN _cuenta ca ON ca.id_persona = d.id_persona
     WHERE ca.correo = lower(c->>'autor');
    IF EXISTS (SELECT 1 FROM public.curso WHERE id_docente = v_docente AND titulo = c->>'titulo') THEN
      RAISE NOTICE '= % (ya existe, sin cambios)', c->>'titulo';
      CONTINUE;
    END IF;

    SELECT id_categoria INTO v_categoria FROM public.categoria WHERE lower(nombre) = lower(c->>'categoria');
    v_publicado := now() - make_interval(days => (c->>'publicadoHaceDias')::int);

    INSERT INTO public.curso (
      id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, objetivos, requisitos,
      estado, revisado_por, publicado_en, creado_en
    ) VALUES (
      v_docente, v_categoria, c->>'titulo', c->>'subtitulo', c->>'descripcion', c->>'nivel',
      ARRAY(SELECT jsonb_array_elements_text(c->'objetivos')),
      ARRAY(SELECT jsonb_array_elements_text(c->'requisitos')),
      'PUBLICADO', v_revisora, v_publicado, v_publicado - interval '9 days'
    ) RETURNING id_curso INTO v_curso;
    INSERT INTO _curso_nuevo (clave, id_curso) VALUES (c->>'clave', v_curso);

    n := 0;
    FOR m, i IN SELECT e, o FROM jsonb_array_elements(c->'modulos') WITH ORDINALITY AS t(e, o) LOOP
      INSERT INTO public.modulo (id_curso, titulo, orden) VALUES (v_curso, m->>'titulo', i) RETURNING id_modulo INTO v_modulo;

      FOR l, j IN SELECT e, o FROM jsonb_array_elements(m->'lecciones') WITH ORDINALITY AS t(e, o) LOOP
        n := n + 1;
        v_archivo := NULL;
        IF l->>'tipo' = 'DOCUMENTO' THEN
          v_archivo := pg_temp.learnity_pdf(v_curso, l->'archivo'->>'nombre', l->'archivo'->>'b64');
        END IF;

        INSERT INTO public.leccion (id_modulo, id_archivo, titulo, tipo, orden, vista_previa, youtube_video_id)
        VALUES (v_modulo, v_archivo, l->>'titulo', l->>'tipo', j, (i = 1 AND j = 1), l->>'youtube')
        RETURNING id_leccion INTO v_leccion;
        INSERT INTO _leccion_nueva (id_curso, posicion, id_leccion, segundos) VALUES (v_curso, n, v_leccion, (l->>'segundos')::int);

        FOR r IN SELECT e FROM jsonb_array_elements(coalesce(l->'recursos', '[]'::jsonb)) e LOOP
          INSERT INTO public.recurso_adjunto (id_leccion, id_archivo, titulo)
          VALUES (v_leccion, pg_temp.learnity_pdf(v_curso, r->>'nombre', r->>'b64'), r->>'titulo');
        END LOOP;

        IF l->>'tipo' = 'EVALUACION' THEN
          INSERT INTO public.evaluacion (id_leccion, porcentaje_aprobacion)
          VALUES (v_leccion, (l->>'aprobacion')::smallint) RETURNING id_evaluacion INTO v_evaluacion;
          FOR p, k IN SELECT e, o FROM jsonb_array_elements(l->'preguntas') WITH ORDINALITY AS t(e, o) LOOP
            INSERT INTO public.pregunta (id_evaluacion, enunciado, orden)
            VALUES (v_evaluacion, p->>'enunciado', k) RETURNING id_pregunta INTO v_pregunta;
            INSERT INTO public.opcion (id_pregunta, letra, texto, es_correcta)
            SELECT v_pregunta, chr(64 + o::int), t.texto, chr(64 + o::int) = p->>'correcta'
              FROM jsonb_array_elements_text(p->'opciones') WITH ORDINALITY AS t(texto, o);
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;

    -- Visitas diarias de las últimas semanas para las métricas del docente.
    INSERT INTO public.visita_curso_dia (id_curso, dia, visitas)
    SELECT v_curso, d::date, 4 + abs(hashtext(v_curso::text || d::text)) % 22
      FROM generate_series(current_date - 45, current_date - 1, interval '1 day') d
     WHERE d >= v_publicado::date;

    RAISE NOTICE '+ curso: % (id %, % lecciones)', c->>'titulo', v_curso, n;
  END LOOP;

  -- 6. Actividad de aprendizaje (solo en cursos creados ahora) ---------------------------------
  FOR a IN SELECT e FROM jsonb_array_elements(cat->'actividad') e LOOP
    v_curso := NULL;
    SELECT id_curso INTO v_curso FROM _curso_nuevo WHERE clave = a->>'curso';
    CONTINUE WHEN v_curso IS NULL;

    SELECT id_persona INTO v_persona FROM _cuenta WHERE correo = lower(a->>'estudiante');
    SELECT count(*) INTO v_total FROM _leccion_nueva WHERE id_curso = v_curso;
    v_hechas := CASE WHEN a->>'lecciones' = 'todas' THEN v_total ELSE least((a->>'lecciones')::int, v_total) END;
    v_pct := CASE WHEN v_hechas = v_total THEN 100 ELSE floor(v_hechas * 100.0 / v_total)::int END;
    v_inscrito := now() - make_interval(days => (a->>'inscritoHaceDias')::int);
    v_actividad := CASE
      WHEN a ? 'resena' THEN now() - make_interval(days => (a->'resena'->>'haceDias')::int + 1)
      ELSE now() - make_interval(days => greatest(1, (a->>'inscritoHaceDias')::int / 3))
    END;
    SELECT id_leccion INTO v_ultima FROM _leccion_nueva WHERE id_curso = v_curso AND posicion = v_hechas;

    INSERT INTO public.inscripcion (
      id_persona, id_curso, estado, progreso_pct, id_ultima_leccion, inscrito_en, completado_en, ultima_actividad_en
    ) VALUES (
      v_persona, v_curso, CASE WHEN v_pct = 100 THEN 'COMPLETADA' ELSE 'ACTIVA' END, v_pct, v_ultima,
      v_inscrito, CASE WHEN v_pct = 100 THEN v_actividad END, v_actividad
    ) RETURNING id_inscripcion INTO v_inscripcion;

    INSERT INTO public.progreso_leccion (id_inscripcion, id_leccion, segundos_vistos, completada)
    SELECT v_inscripcion, id_leccion, segundos, true
      FROM _leccion_nueva WHERE id_curso = v_curso AND posicion <= v_hechas;

    -- Una evaluación completada exige un intento aprobado con sus respuestas.
    FOR v_evaluacion IN
      SELECT ev.id_evaluacion FROM _leccion_nueva ln JOIN public.evaluacion ev ON ev.id_leccion = ln.id_leccion
       WHERE ln.id_curso = v_curso AND ln.posicion <= v_hechas
    LOOP
      INSERT INTO public.intento_evaluacion (id_inscripcion, id_evaluacion, puntaje, aprobado, realizado_en)
      VALUES (v_inscripcion, v_evaluacion, 100, true, v_actividad) RETURNING id_intento INTO v_intento;
      INSERT INTO public.respuesta (id_intento, id_pregunta, id_opcion)
      SELECT v_intento, pr.id_pregunta, op.id_opcion
        FROM public.pregunta pr JOIN public.opcion op ON op.id_pregunta = pr.id_pregunta AND op.es_correcta
       WHERE pr.id_evaluacion = v_evaluacion;
    END LOOP;

    IF a ? 'resena' THEN
      -- «editado» es una columna generada (a partir de editado_en): no se inserta.
      INSERT INTO public.resena (id_inscripcion, estrellas, comentario, creado_en, actualizado_en, progreso_al_resenar)
      VALUES (
        v_inscripcion, (a->'resena'->>'estrellas')::smallint, a->'resena'->>'comentario',
        now() - make_interval(days => (a->'resena'->>'haceDias')::int),
        now() - make_interval(days => (a->'resena'->>'haceDias')::int),
        v_pct
      ) RETURNING id_resena INTO v_resena;

      FOR h IN SELECT e FROM jsonb_array_elements(coalesce(a->'hilo', '[]'::jsonb)) e LOOP
        INSERT INTO public.resena_respuesta (id_resena, id_persona, comentario, creado_en)
        SELECT v_resena, ca.id_persona, h->>'comentario', now() - make_interval(days => (h->>'haceDias')::int)
          FROM _cuenta ca WHERE ca.correo = lower(h->>'autor');
      END LOOP;
    END IF;
  END LOOP;
END
$contenido$;

COMMIT;

-- ------------------------------------------------------------------ verificación
SELECT c.id_curso, c.titulo, u.correo AS docente, k.nombre AS categoria, c.estado,
       (SELECT count(*) FROM modulo mo WHERE mo.id_curso = c.id_curso) AS modulos,
       (SELECT count(*) FROM leccion le JOIN modulo mo USING (id_modulo) WHERE mo.id_curso = c.id_curso) AS lecciones,
       (SELECT count(*) FROM archivo ar WHERE ar.id_curso = c.id_curso) AS pdfs,
       (SELECT count(*) FROM archivo ar WHERE ar.id_curso = c.id_curso
           AND NOT EXISTS (SELECT 1 FROM archivo_binario b WHERE b.nombre = ar.ruta AND octet_length(b.bytes) = ar.tamano_bytes)) AS pdfs_sin_bytes,
       (SELECT count(*) FROM inscripcion i WHERE i.id_curso = c.id_curso) AS inscripciones,
       (SELECT count(*) FROM resena re JOIN inscripcion i USING (id_inscripcion) WHERE i.id_curso = c.id_curso) AS resenas,
       (SELECT round(avg(re.estrellas), 2) FROM resena re JOIN inscripcion i USING (id_inscripcion) WHERE i.id_curso = c.id_curso) AS promedio,
       (SELECT count(*) FROM resena_respuesta rr JOIN resena re USING (id_resena) JOIN inscripcion i USING (id_inscripcion)
         WHERE i.id_curso = c.id_curso) AS comentarios_hilo
  FROM curso c
  JOIN docente d ON d.id_docente = c.id_docente
  JOIN usuario u ON u.id_persona = d.id_persona
  JOIN categoria k ON k.id_categoria = c.id_categoria
 ORDER BY c.id_curso;
`;

writeFileSync(path.join(raiz, 'database/contenido_profesional.sql'), script, 'utf8');
writeFileSync(path.join(raiz, 'database/contenido_profesional_vista_previa.sql'), vistaPrevia, 'utf8');
console.log(`✓ ${cursos.length} cursos, ${totalPdf} PDF (${Math.round(bytesPdf / 1024)} KiB), ${ACTIVIDAD.length} inscripciones.`);
console.log('  database/contenido_profesional.sql');
console.log('  database/contenido_profesional_vista_previa.sql');
