import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { EstadoInscripcion, FichaCursoAprendizaje, RecursoAprendizaje, TipoLeccionAprendizaje } from './aprendizaje.modelo.js';

export interface FilaInscripcion {
  id: number;
  cursoId: number;
  estado: EstadoInscripcion;
  progresoPct: number;
  ultimaLeccionId: number | null;
  inscritoEn: Date;
  completadoEn: Date | null;
}

export interface FilaCursoInscrito extends FilaInscripcion {
  titulo: string;
  subtitulo: string | null;
  portadaUrl: string | null;
  nivel: FichaCursoAprendizaje['nivel'];
  categoriaId: number;
  categoriaNombre: string;
  categoriaIcono: string;
  docente: string;
  totalLecciones: number;
  leccionesCompletadas: number;
  suspendido: boolean;
}

export interface FilaLeccion {
  moduloId: number;
  moduloOrden: number;
  moduloTitulo: string;
  id: number | null;
  orden: number | null;
  titulo: string | null;
  tipo: TipoLeccionAprendizaje | null;
  archivoId: number | null;
  youtubeVideoId: string | null;
  evaluacionId: number | null;
  segundosVistos: number | null;
  completada: boolean | null;
}

export interface FilaEstudiante {
  idPersona: number;
  nombre: string;
  cursoId?: number;
  cursoTitulo?: string;
  estado: EstadoInscripcion;
  progresoPct: number;
  ultimaLeccionId: number | null;
  inscritoEn: Date;
  ultimaActividadEn: Date;
  estrellas: number | null;
}

export interface FilaExportacion extends FilaEstudiante {
  completadoEn: Date | null;
  comentario: string | null;
}

const CAMPOS_INSCRIPCION = `
  i.id_inscripcion AS id, i.id_curso AS "cursoId", i.estado,
  i.progreso_pct AS "progresoPct", i.id_ultima_leccion AS "ultimaLeccionId",
  i.inscrito_en AS "inscritoEn", i.completado_en AS "completadoEn"`;

// Un curso publicado se edita sin volver a revisión: el estudiante solo ve y cuenta lo que ya está listo
// (un vídeo con su ID, un documento con su PDF o una evaluación con al menos 5 preguntas),
// nunca un contenido a medio preparar.
const LECCION_DISPONIBLE = `((l.tipo = 'VIDEO' AND l.youtube_video_id IS NOT NULL)
  OR (l.tipo = 'DOCUMENTO' AND l.id_archivo IS NOT NULL)
  OR (l.tipo = 'EVALUACION' AND (SELECT count(*) FROM evaluacion ev
        JOIN pregunta pr ON pr.id_evaluacion = ev.id_evaluacion
       WHERE ev.id_leccion = l.id_leccion) >= 5))`;

const CAMPOS_CURSO = `
  c.titulo, c.subtitulo, c.portada_url AS "portadaUrl", c.nivel, (c.estado = 'SUSPENDIDO') AS suspendido,
  cat.id_categoria AS "categoriaId", cat.nombre AS "categoriaNombre", cat.icono AS "categoriaIcono",
  concat_ws(' ', p.nombres, p.apellidos) AS docente,
  (SELECT count(*)::int FROM modulo m JOIN leccion l ON l.id_modulo = m.id_modulo
    WHERE m.id_curso = c.id_curso AND ${LECCION_DISPONIBLE}) AS "totalLecciones",
  (SELECT count(*)::int FROM progreso_leccion pl JOIN leccion l ON l.id_leccion = pl.id_leccion
    JOIN modulo m ON m.id_modulo = l.id_modulo
    WHERE pl.id_inscripcion = i.id_inscripcion AND m.id_curso = c.id_curso
      AND ${LECCION_DISPONIBLE} AND pl.completada) AS "leccionesCompletadas"`;

/** Toda consulta SQL de Aprendizaje reside aquí; los valores externos siempre usan parámetros. */
/** Filtros de la lista de estudiantes del docente (además del curso). */
export interface FiltrosLista {
  categoria?: string | undefined;
  q?: string | undefined;
  estado?: 'ACTIVA' | 'COMPLETADA' | undefined;
}

/** $1 docente, $2 curso, $3 categoría, $4 texto del estudiante, $5 estado (alias i, p y c). */
const DONDE_ESTUDIANTES = `
  (($2::int IS NOT NULL AND i.id_curso = $2)
     OR ($2::int IS NULL AND ($1::int IS NULL OR c.id_docente IN (
          SELECT d.id_docente FROM docente d WHERE d.id_persona = $1 AND d.estado = 'ACTIVO'
        ))))
  AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM categoria cat WHERE cat.id_categoria = c.id_categoria AND cat.nombre ILIKE $3))
  AND ($4::text IS NULL OR concat_ws(' ', p.nombres, p.apellidos) ILIKE $4
       OR EXISTS (SELECT 1 FROM usuario u WHERE u.id_persona = p.id_persona AND u.correo ILIKE $4))
  AND ($5::text IS NULL OR i.estado = $5)`;

/** Texto buscado tal cual: los comodines de LIKE se escapan. */
const comoLike = (texto: string | undefined) => (texto ? `%${texto.replace(/[\\%_]/g, '\\$&')}%` : null);

function parametrosEstudiantes(idDocentePersona: number | null, idCurso: number | null, f: FiltrosLista): unknown[] {
  return [idDocentePersona, idCurso, comoLike(f.categoria), comoLike(f.q), f.estado ?? null];
}

export const aprendizajeRepository = {
  /** FOR SHARE impide que el curso cambie de estado mientras se inscribe al estudiante. */
  async cursoPublicado(cliente: PoolClient, idCurso: number): Promise<boolean> {
    const r = await cliente.query(
      "SELECT 1 FROM curso WHERE id_curso = $1 AND estado = 'PUBLICADO' FOR SHARE",
      [idCurso],
    );
    return r.rows.length === 1;
  },

  /** La restricción UNIQUE serializa las solicitudes simultáneas. */
  async crearInscripcion(cliente: PoolClient, idPersona: number, idCurso: number): Promise<boolean> {
    const r = await cliente.query(
      `INSERT INTO inscripcion (id_persona, id_curso) VALUES ($1, $2)
       ON CONFLICT (id_persona, id_curso) DO NOTHING RETURNING id_inscripcion`,
      [idPersona, idCurso],
    );
    return r.rows.length === 1;
  },

  async inscripcion(cliente: PoolClient, idPersona: number, idCurso: number): Promise<FilaInscripcion | null> {
    const { rows } = await cliente.query<FilaInscripcion>(
      `SELECT ${CAMPOS_INSCRIPCION} FROM inscripcion i
        WHERE i.id_persona = $1 AND i.id_curso = $2`,
      [idPersona, idCurso],
    );
    return rows[0] ?? null;
  },

  async tieneInscripcionPublicada(idPersona: number, idCurso: number): Promise<boolean> {
    const r = await consultar(
      `SELECT 1 FROM inscripcion i JOIN curso c ON c.id_curso = i.id_curso
        WHERE i.id_persona = $1 AND i.id_curso = $2 AND c.estado = 'PUBLICADO'`,
      [idPersona, idCurso],
    );
    return r.rows.length === 1;
  },

  /** D2 · Incluye los cursos suspendidos (marcados): el estudiante conserva su progreso, pero no puede abrirlos. */
  async cursosDelEstudiante(idPersona: number): Promise<FilaCursoInscrito[]> {
    const { rows } = await consultar<FilaCursoInscrito>(
      `SELECT ${CAMPOS_INSCRIPCION}, ${CAMPOS_CURSO}
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado IN ('PUBLICADO', 'SUSPENDIDO')
         JOIN categoria cat ON cat.id_categoria = c.id_categoria
         JOIN docente d ON d.id_docente = c.id_docente
         JOIN persona p ON p.id_persona = d.id_persona
        WHERE i.id_persona = $1
        ORDER BY i.inscrito_en DESC, i.id_inscripcion DESC`,
      [idPersona],
    );
    return rows;
  },

  async cursoDelEstudiante(idPersona: number, idCurso: number): Promise<FilaCursoInscrito | null> {
    const { rows } = await consultar<FilaCursoInscrito>(
      `SELECT ${CAMPOS_INSCRIPCION}, ${CAMPOS_CURSO}
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
         JOIN categoria cat ON cat.id_categoria = c.id_categoria
         JOIN docente d ON d.id_docente = c.id_docente
         JOIN persona p ON p.id_persona = d.id_persona
        WHERE i.id_persona = $1 AND i.id_curso = $2`,
      [idPersona, idCurso],
    );
    return rows[0] ?? null;
  },

  async temarioDelEstudiante(idInscripcion: number, idCurso: number): Promise<FilaLeccion[]> {
    const { rows } = await consultar<FilaLeccion>(
      `SELECT m.id_modulo AS "moduloId", m.orden AS "moduloOrden", m.titulo AS "moduloTitulo",
              l.id_leccion AS id, l.orden, l.titulo, l.tipo,
              a.id_archivo AS "archivoId", l.youtube_video_id AS "youtubeVideoId",
              e.id_evaluacion AS "evaluacionId",
              pl.segundos_vistos AS "segundosVistos", pl.completada
         FROM modulo m
         LEFT JOIN leccion l ON l.id_modulo = m.id_modulo AND ${LECCION_DISPONIBLE}
         LEFT JOIN archivo a ON a.id_archivo = l.id_archivo AND a.id_curso = m.id_curso AND a.tipo = 'PDF'
         LEFT JOIN evaluacion e ON e.id_leccion = l.id_leccion AND l.tipo = 'EVALUACION'
         LEFT JOIN progreso_leccion pl ON pl.id_leccion = l.id_leccion AND pl.id_inscripcion = $1
        WHERE m.id_curso = $2
        ORDER BY m.orden, m.id_modulo, l.orden, l.id_leccion`,
      [idInscripcion, idCurso],
    );
    return rows;
  },

  async recursosDelCurso(idCurso: number): Promise<(RecursoAprendizaje & { leccionId: number })[]> {
    const { rows } = await consultar<RecursoAprendizaje & { leccionId: number }>(
      `SELECT ra.id_recurso AS id, ra.id_leccion AS "leccionId", ra.titulo, a.id_archivo AS "archivoId",
              a.tipo, a.nombre_original AS "nombreOriginal", a.tamano_bytes AS "tamanoBytes"
         FROM recurso_adjunto ra
         JOIN archivo a ON a.id_archivo = ra.id_archivo AND a.tipo IN ('PDF', 'PPT', 'ZIP')
         JOIN leccion l ON l.id_leccion = ra.id_leccion
         JOIN modulo m ON m.id_modulo = l.id_modulo AND m.id_curso = a.id_curso
        WHERE m.id_curso = $1
        ORDER BY ra.id_leccion, ra.id_recurso`,
      [idCurso],
    );
    return rows;
  },

  /** Bloquear la inscripción serializa el avance y el porcentaje concurrente. */
  async inscripcionParaLeccion(cliente: PoolClient, idPersona: number, idLeccion: number, bloquear = true): Promise<{
    inscripcionId: number; cursoId: number; tipo: TipoLeccionAprendizaje;
  } | null> {
    const { rows } = await cliente.query<{ inscripcionId: number; cursoId: number; tipo: TipoLeccionAprendizaje }>(
      `SELECT i.id_inscripcion AS "inscripcionId", i.id_curso AS "cursoId", l.tipo
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
         JOIN modulo m ON m.id_curso = c.id_curso
         JOIN leccion l ON l.id_modulo = m.id_modulo AND ${LECCION_DISPONIBLE}
        WHERE i.id_persona = $1 AND l.id_leccion = $2
        ${bloquear ? 'FOR UPDATE OF i' : ''}`,
      [idPersona, idLeccion],
    );
    return rows[0] ?? null;
  },

  async guardarLeccion(
    cliente: PoolClient, idInscripcion: number, idLeccion: number,
    segundosVistos?: number, completada?: boolean,
  ): Promise<{ segundosVistos: number; completada: boolean }> {
    const { rows } = await cliente.query<{ segundosVistos: number; completada: boolean }>(
      `INSERT INTO progreso_leccion (id_inscripcion, id_leccion, segundos_vistos, completada)
       VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, false))
       ON CONFLICT (id_inscripcion, id_leccion) DO UPDATE
         SET segundos_vistos = CASE WHEN $3 IS NOT NULL THEN $3::int ELSE progreso_leccion.segundos_vistos END,
             completada = CASE WHEN $4 IS NOT NULL THEN $4::boolean ELSE progreso_leccion.completada END
       RETURNING segundos_vistos AS "segundosVistos", completada`,
      [idInscripcion, idLeccion, segundosVistos ?? null, completada ?? null],
    );
    return rows[0]!;
  },

  async contarLecciones(cliente: PoolClient, idInscripcion: number, idCurso: number): Promise<{
    total: number; completadas: number;
  }> {
    const { rows } = await cliente.query<{ total: number; completadas: number }>(
      `SELECT count(l.id_leccion)::int AS total,
              count(l.id_leccion) FILTER (WHERE pl.completada)::int AS completadas
         FROM modulo m
         JOIN leccion l ON l.id_modulo = m.id_modulo AND ${LECCION_DISPONIBLE}
         LEFT JOIN progreso_leccion pl ON pl.id_leccion = l.id_leccion AND pl.id_inscripcion = $1
        WHERE m.id_curso = $2`,
      [idInscripcion, idCurso],
    );
    return rows[0]!;
  },

  async actualizarInscripcion(
    cliente: PoolClient, idInscripcion: number, idLeccion: number, porcentaje: number,
  ): Promise<void> {
    await cliente.query(
      `UPDATE inscripcion
          SET progreso_pct = $2::smallint, id_ultima_leccion = $3,
              estado = CASE WHEN $2::smallint = 100 THEN 'COMPLETADA' ELSE 'ACTIVA' END,
              completado_en = CASE WHEN $2::smallint = 100 THEN COALESCE(completado_en, now()) ELSE NULL END,
              ultima_actividad_en = now()
        WHERE id_inscripcion = $1`,
      [idInscripcion, porcentaje, idLeccion],
    );
  },

  async cursoParaSeguimiento(idCurso: number): Promise<{
    id: number; titulo: string; docentePersonaId: number; docenteActivo: boolean;
  } | null> {
    const { rows } = await consultar<{
      id: number; titulo: string; docentePersonaId: number; docenteActivo: boolean;
    }>(
      `SELECT c.id_curso AS id, c.titulo, d.id_persona AS "docentePersonaId",
              (d.estado = 'ACTIVO') AS "docenteActivo"
         FROM curso c JOIN docente d ON d.id_docente = c.id_docente
        WHERE c.id_curso = $1`,
      [idCurso],
    );
    return rows[0] ?? null;
  },

  async resumenSeguimiento(idDocentePersona: number | null, idCurso: number | null): Promise<{
    inscritos: number; completados: number; progresoPromedio: number;
    valoracion: { promedio: number | null; total: number };
  }> {
    const { rows } = await consultar<{
      inscritos: number; completados: number; progresoPromedio: number; promedio: string | null; resenas: number;
    }>(
      `SELECT count(*)::int AS inscritos,
              count(*) FILTER (WHERE i.estado = 'COMPLETADA')::int AS completados,
              COALESCE(round(avg(i.progreso_pct)), 0)::int AS "progresoPromedio",
              round(avg(r.estrellas), 1) AS promedio, count(r.id_resena)::int AS resenas
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso
         LEFT JOIN resena r ON r.id_inscripcion = i.id_inscripcion AND r.eliminado_en IS NULL AND r.ocultada_en IS NULL
        WHERE ($2::int IS NOT NULL AND i.id_curso = $2)
           OR ($2::int IS NULL AND ($1::int IS NULL OR c.id_docente IN (
                SELECT d.id_docente FROM docente d WHERE d.id_persona = $1 AND d.estado = 'ACTIVO'
              )))`,
      [idDocentePersona, idCurso],
    );
    const { promedio, resenas, ...resumen } = rows[0]!;
    return { ...resumen, valoracion: { promedio: promedio === null ? null : Number(promedio), total: resenas } };
  },

  async estudiantesDelDocente(
    idDocentePersona: number | null, idCurso: number | null, limite: number, offset: number,
    filtros: FiltrosLista = {},
  ): Promise<FilaEstudiante[]> {
    const { rows } = await consultar<FilaEstudiante>(
      `SELECT p.id_persona AS "idPersona", concat_ws(' ', p.nombres, p.apellidos) AS nombre,
              c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
              i.estado, i.progreso_pct AS "progresoPct",
              i.id_ultima_leccion AS "ultimaLeccionId", i.inscrito_en AS "inscritoEn",
              i.ultima_actividad_en AS "ultimaActividadEn", r.estrellas
         FROM inscripcion i
         JOIN persona p ON p.id_persona = i.id_persona
         JOIN curso c ON c.id_curso = i.id_curso
         LEFT JOIN resena r ON r.id_inscripcion = i.id_inscripcion AND r.eliminado_en IS NULL AND r.ocultada_en IS NULL
        WHERE ${DONDE_ESTUDIANTES}
        ORDER BY i.inscrito_en DESC, i.id_inscripcion DESC
        LIMIT $6 OFFSET $7`,
      [...parametrosEstudiantes(idDocentePersona, idCurso, filtros), limite, offset],
    );
    return rows;
  },

  /** Inscritos que cumplen los filtros (el total de la lista; el resumen no depende de ellos). */
  async contarEstudiantes(idDocentePersona: number | null, idCurso: number | null, filtros: FiltrosLista): Promise<number> {
    const { rows } = await consultar<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM inscripcion i
         JOIN persona p ON p.id_persona = i.id_persona
         JOIN curso c ON c.id_curso = i.id_curso
        WHERE ${DONDE_ESTUDIANTES}`,
      parametrosEstudiantes(idDocentePersona, idCurso, filtros),
    );
    return rows[0]!.total;
  },

  async estudiantesDelCurso(idCurso: number, limite: number, offset: number): Promise<FilaEstudiante[]> {
    return aprendizajeRepository.estudiantesDelDocente(null, idCurso, limite, offset);
  },

  /** Todos los inscritos para exportar (con un tope que ningún curso real alcanza). */
  async exportarEstudiantes(idCurso: number): Promise<FilaExportacion[]> {
    const { rows } = await consultar<FilaExportacion>(
      `SELECT p.id_persona AS "idPersona", concat_ws(' ', p.nombres, p.apellidos) AS nombre,
              i.estado, i.progreso_pct AS "progresoPct", i.id_ultima_leccion AS "ultimaLeccionId",
              i.inscrito_en AS "inscritoEn", i.ultima_actividad_en AS "ultimaActividadEn",
              i.completado_en AS "completadoEn", r.estrellas, r.comentario
         FROM inscripcion i JOIN persona p ON p.id_persona = i.id_persona
         LEFT JOIN resena r ON r.id_inscripcion = i.id_inscripcion AND r.eliminado_en IS NULL AND r.ocultada_en IS NULL
        WHERE i.id_curso = $1
        ORDER BY i.inscrito_en DESC, i.id_inscripcion DESC
        LIMIT 20000`,
      [idCurso],
    );
    return rows;
  },
};
