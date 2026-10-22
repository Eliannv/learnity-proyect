import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { EstadoInscripcion, FichaCursoAprendizaje, TipoLeccionAprendizaje } from './aprendizaje.modelo.js';

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
  docente: string;
  totalLecciones: number;
  leccionesCompletadas: number;
}

export interface FilaLeccion {
  moduloId: number;
  moduloOrden: number;
  moduloTitulo: string;
  id: number | null;
  orden: number | null;
  titulo: string | null;
  tipo: TipoLeccionAprendizaje | null;
  vistaPrevia: boolean | null;
  archivoId: number | null;
  segundosVistos: number | null;
  completada: boolean | null;
}

export interface FilaEstudiante {
  idPersona: number;
  nombre: string;
  estado: EstadoInscripcion;
  progresoPct: number;
  ultimaLeccionId: number | null;
  inscritoEn: Date;
}

const CAMPOS_INSCRIPCION = `
  i.id_inscripcion AS id, i.id_curso AS "cursoId", i.estado,
  i.progreso_pct AS "progresoPct", i.id_ultima_leccion AS "ultimaLeccionId",
  i.inscrito_en AS "inscritoEn", i.completado_en AS "completadoEn"`;

const CAMPOS_CURSO = `
  c.titulo, c.subtitulo, c.portada_url AS "portadaUrl", c.nivel,
  cat.id_categoria AS "categoriaId", cat.nombre AS "categoriaNombre",
  concat_ws(' ', p.nombres, p.apellidos) AS docente,
  (SELECT count(*)::int FROM modulo m JOIN leccion l ON l.id_modulo = m.id_modulo
    WHERE m.id_curso = c.id_curso AND l.tipo IN ('DOCUMENTO', 'VIDEO')) AS "totalLecciones",
  (SELECT count(*)::int FROM progreso_leccion pl JOIN leccion l ON l.id_leccion = pl.id_leccion
    JOIN modulo m ON m.id_modulo = l.id_modulo
    WHERE pl.id_inscripcion = i.id_inscripcion AND m.id_curso = c.id_curso
      AND l.tipo IN ('DOCUMENTO', 'VIDEO') AND pl.completada) AS "leccionesCompletadas"`;

/** Toda consulta SQL de Aprendizaje reside aquí; los valores externos siempre usan parámetros. */
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

  async cursosDelEstudiante(idPersona: number): Promise<FilaCursoInscrito[]> {
    const { rows } = await consultar<FilaCursoInscrito>(
      `SELECT ${CAMPOS_INSCRIPCION}, ${CAMPOS_CURSO}
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
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
              l.id_leccion AS id, l.orden, l.titulo, l.tipo, l.vista_previa AS "vistaPrevia",
              a.id_archivo AS "archivoId", pl.segundos_vistos AS "segundosVistos", pl.completada
         FROM modulo m
         LEFT JOIN leccion l ON l.id_modulo = m.id_modulo AND l.tipo IN ('DOCUMENTO', 'VIDEO')
         LEFT JOIN archivo a ON a.id_archivo = l.id_archivo AND a.id_curso = m.id_curso AND a.tipo = 'PDF'
         LEFT JOIN progreso_leccion pl ON pl.id_leccion = l.id_leccion AND pl.id_inscripcion = $1
        WHERE m.id_curso = $2
        ORDER BY m.orden, m.id_modulo, l.orden, l.id_leccion`,
      [idInscripcion, idCurso],
    );
    return rows;
  },

  /** Bloquear la inscripción serializa el avance y el porcentaje concurrente. */
  async inscripcionParaLeccion(cliente: PoolClient, idPersona: number, idLeccion: number): Promise<{
    inscripcionId: number; cursoId: number;
  } | null> {
    const { rows } = await cliente.query<{ inscripcionId: number; cursoId: number }>(
      `SELECT i.id_inscripcion AS "inscripcionId", i.id_curso AS "cursoId"
         FROM inscripcion i
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
         JOIN modulo m ON m.id_curso = c.id_curso
         JOIN leccion l ON l.id_modulo = m.id_modulo AND l.tipo IN ('DOCUMENTO', 'VIDEO')
        WHERE i.id_persona = $1 AND l.id_leccion = $2
        FOR UPDATE OF i`,
      [idPersona, idLeccion],
    );
    return rows[0] ?? null;
  },

  async guardarLeccion(
    cliente: PoolClient, idInscripcion: number, idLeccion: number,
    segundosVistos: number, completada: boolean,
  ): Promise<{ segundosVistos: number; completada: boolean }> {
    const { rows } = await cliente.query<{ segundosVistos: number; completada: boolean }>(
      `INSERT INTO progreso_leccion (id_inscripcion, id_leccion, segundos_vistos, completada)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_inscripcion, id_leccion) DO UPDATE
         SET segundos_vistos = GREATEST(progreso_leccion.segundos_vistos, EXCLUDED.segundos_vistos),
             completada = progreso_leccion.completada OR EXCLUDED.completada
       RETURNING segundos_vistos AS "segundosVistos", completada`,
      [idInscripcion, idLeccion, segundosVistos, completada],
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
         JOIN leccion l ON l.id_modulo = m.id_modulo AND l.tipo IN ('DOCUMENTO', 'VIDEO')
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
              completado_en = CASE WHEN $2::smallint = 100 THEN COALESCE(completado_en, now()) ELSE NULL END
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

  async resumenSeguimiento(idCurso: number): Promise<{
    inscritos: number; completados: number; progresoPromedio: number;
  }> {
    const { rows } = await consultar<{
      inscritos: number; completados: number; progresoPromedio: number;
    }>(
      `SELECT count(*)::int AS inscritos,
              count(*) FILTER (WHERE estado = 'COMPLETADA')::int AS completados,
              COALESCE(round(avg(progreso_pct)), 0)::int AS "progresoPromedio"
         FROM inscripcion WHERE id_curso = $1`,
      [idCurso],
    );
    return rows[0]!;
  },

  async estudiantesDelCurso(idCurso: number, limite: number, offset: number): Promise<FilaEstudiante[]> {
    const { rows } = await consultar<FilaEstudiante>(
      `SELECT p.id_persona AS "idPersona", concat_ws(' ', p.nombres, p.apellidos) AS nombre,
              i.estado, i.progreso_pct AS "progresoPct",
              i.id_ultima_leccion AS "ultimaLeccionId", i.inscrito_en AS "inscritoEn"
         FROM inscripcion i JOIN persona p ON p.id_persona = i.id_persona
        WHERE i.id_curso = $1
        ORDER BY i.inscrito_en DESC, i.id_inscripcion DESC
        LIMIT $2 OFFSET $3`,
      [idCurso, limite, offset],
    );
    return rows;
  },
};
