import { consultar } from '../../shared/database/pool.js';
import type { ActividadMes, Analiticas, CursoAnalitica, LeccionEmbudo } from './analiticas.modelo.js';

// Solo lectura y siempre acotado a los cursos del docente ($1). $2 = curso elegido o NULL (todos).

const CURSOS = `
  SELECT c.id_curso FROM curso c JOIN docente d ON d.id_docente = c.id_docente
   WHERE d.id_persona = $1 AND d.estado = 'ACTIVO' AND ($2::int IS NULL OR c.id_curso = $2)`;

const numeroONull = (valor: string | null) => (valor === null ? null : Number(valor));

export const analiticasRepository = {
  async cursos(idPersona: number): Promise<{ id: number; titulo: string }[]> {
    const { rows } = await consultar<{ id: number; titulo: string }>(
      `SELECT c.id_curso AS id, c.titulo FROM curso c JOIN docente d ON d.id_docente = c.id_docente
        WHERE d.id_persona = $1 AND d.estado = 'ACTIVO' ORDER BY c.titulo, c.id_curso`,
      [idPersona],
    );
    return rows;
  },

  async resumen(idPersona: number, idCurso: number | null): Promise<Analiticas['resumen']> {
    const { rows } = await consultar<{
      inscritos: number; completados: number; promedio: string | null; mediana: string | null;
    }>(
      `WITH duracion AS (
         SELECT i.estado, EXTRACT(EPOCH FROM (i.completado_en - i.inscrito_en)) / 86400 AS dias
           FROM inscripcion i WHERE i.id_curso IN (${CURSOS})
       )
       SELECT count(*)::int AS inscritos,
              count(*) FILTER (WHERE estado = 'COMPLETADA')::int AS completados,
              round(avg(dias)::numeric, 2) AS promedio,
              round((percentile_cont(0.5) WITHIN GROUP (ORDER BY dias))::numeric, 2) AS mediana
         FROM duracion`,
      [idPersona, idCurso],
    );
    const f = rows[0]!;
    return {
      inscritos: f.inscritos, completados: f.completados,
      diasPromedioFinalizacion: numeroONull(f.promedio), diasMedianaFinalizacion: numeroONull(f.mediana),
    };
  },

  /** Inscripciones y cursos completados por mes en los últimos 12 meses (con ceros). */
  async actividad(idPersona: number, idCurso: number | null): Promise<ActividadMes[]> {
    const { rows } = await consultar<ActividadMes>(
      `WITH meses AS (
         SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()),
                                interval '1 month') AS mes
       ), propias AS (
         SELECT i.inscrito_en, i.completado_en FROM inscripcion i WHERE i.id_curso IN (${CURSOS})
       )
       SELECT to_char(m.mes, 'YYYY-MM') AS mes,
              (SELECT count(*)::int FROM propias WHERE date_trunc('month', inscrito_en) = m.mes) AS inscripciones,
              (SELECT count(*)::int FROM propias WHERE date_trunc('month', completado_en) = m.mes) AS completados
         FROM meses m ORDER BY m.mes`,
      [idPersona, idCurso],
    );
    return rows;
  },

  async conversion(idPersona: number, idCurso: number | null, dias: number): Promise<Analiticas['conversion']> {
    const { rows } = await consultar<{ visitas: number; inscripciones: number }>(
      `SELECT (SELECT COALESCE(sum(v.visitas), 0)::int FROM visita_curso_dia v
                WHERE v.id_curso IN (${CURSOS}) AND v.dia > current_date - $3::int) AS visitas,
              (SELECT count(*)::int FROM inscripcion i
                WHERE i.id_curso IN (${CURSOS}) AND i.inscrito_en > now() - make_interval(days => $3::int)) AS inscripciones`,
      [idPersona, idCurso, dias],
    );
    const { visitas, inscripciones } = rows[0]!;
    return {
      dias, visitas, inscripciones,
      // Puede pasar de 100 si alguien se inscribe sin abrir la ficha (por ejemplo, desde un enlace directo).
      tasaPct: visitas === 0 ? null : Math.round((inscripciones / visitas) * 1000) / 10,
    };
  },

  /** Cuántos inscritos completaron cada lección, en el orden del temario. */
  async embudo(idPersona: number, idCurso: number): Promise<LeccionEmbudo[]> {
    const { rows } = await consultar<LeccionEmbudo>(
      `SELECT l.id_leccion AS "leccionId", m.titulo AS modulo, l.titulo, l.tipo,
              (SELECT count(*)::int FROM progreso_leccion pl
                 JOIN inscripcion i ON i.id_inscripcion = pl.id_inscripcion
                WHERE pl.id_leccion = l.id_leccion AND pl.completada AND i.id_curso = m.id_curso) AS completaron
         FROM modulo m JOIN leccion l ON l.id_modulo = m.id_modulo
        WHERE m.id_curso IN (${CURSOS})
        ORDER BY m.orden, m.id_modulo, l.orden, l.id_leccion`,
      [idPersona, idCurso],
    );
    return rows;
  },

  async porCurso(idPersona: number): Promise<CursoAnalitica[]> {
    const { rows } = await consultar<CursoAnalitica>(
      `SELECT c.id_curso AS id, c.titulo,
              count(i.id_inscripcion)::int AS inscritos,
              count(i.id_inscripcion) FILTER (WHERE i.estado = 'COMPLETADA')::int AS completados
         FROM curso c
         JOIN docente d ON d.id_docente = c.id_docente
         LEFT JOIN inscripcion i ON i.id_curso = c.id_curso
        WHERE d.id_persona = $1 AND d.estado = 'ACTIVO'
        GROUP BY c.id_curso, c.titulo
        ORDER BY inscritos DESC, c.titulo`,
      [idPersona],
    );
    return rows;
  },
};
