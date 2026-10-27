import type { PoolClient } from 'pg';
import type { EvaluacionEstudiante, LetraOpcion, ResumenIntentos } from './evaluaciones.modelo.js';

export interface FilaEvaluacion {
  id: number;
  leccionId: number;
  titulo: string;
  porcentajeAprobacion: number;
}

export interface OpcionCalificable {
  preguntaId: number;
  opcionId: number;
  letra: LetraOpcion;
  esCorrecta: boolean;
}

// Capa repository del módulo Evaluaciones: solo consultas SQL parametrizadas ($1, $2…).
export const evaluacionesRepository = {
  async evaluacion(cliente: PoolClient, idEvaluacion: number): Promise<FilaEvaluacion | null> {
    const { rows } = await cliente.query<FilaEvaluacion>(
      `SELECT e.id_evaluacion AS id, e.id_leccion AS "leccionId", l.titulo,
              e.porcentaje_aprobacion AS "porcentajeAprobacion"
         FROM evaluacion e
         JOIN leccion l ON l.id_leccion = e.id_leccion AND l.tipo = 'EVALUACION'
        WHERE e.id_evaluacion = $1`,
      [idEvaluacion],
    );
    return rows[0] ?? null;
  },

  /** Preguntas y opciones sin `es_correcta`: lo único que sale hacia el estudiante. */
  async preguntasPublicas(cliente: PoolClient, idEvaluacion: number): Promise<EvaluacionEstudiante['preguntas']> {
    const { rows } = await cliente.query<{
      id: number; orden: number; enunciado: string; letra: LetraOpcion; texto: string;
    }>(
      `SELECT p.id_pregunta AS id, p.orden, p.enunciado, o.letra, o.texto
         FROM pregunta p
         JOIN opcion o ON o.id_pregunta = p.id_pregunta
        WHERE p.id_evaluacion = $1
        ORDER BY p.orden, o.letra`,
      [idEvaluacion],
    );
    const preguntas: EvaluacionEstudiante['preguntas'] = [];
    for (const fila of rows) {
      let pregunta = preguntas.at(-1);
      if (pregunta?.id !== fila.id) {
        pregunta = { id: fila.id, orden: fila.orden, enunciado: fila.enunciado, opciones: [] };
        preguntas.push(pregunta);
      }
      pregunta.opciones.push({ letra: fila.letra, texto: fila.texto });
    }
    return preguntas;
  },

  /** Solo para calificar en el servidor. */
  async opcionesCalificables(cliente: PoolClient, idEvaluacion: number): Promise<OpcionCalificable[]> {
    const { rows } = await cliente.query<OpcionCalificable>(
      `SELECT p.id_pregunta AS "preguntaId", o.id_opcion AS "opcionId", o.letra,
              o.es_correcta AS "esCorrecta"
         FROM pregunta p
         JOIN opcion o ON o.id_pregunta = p.id_pregunta
        WHERE p.id_evaluacion = $1`,
      [idEvaluacion],
    );
    return rows;
  },

  async resumen(cliente: PoolClient, idInscripcion: number, idEvaluacion: number): Promise<ResumenIntentos> {
    const { rows } = await cliente.query<{
      intentos: number; mejor: string | null; ultimo: string | null; aprobada: boolean;
    }>(
      `SELECT count(*)::int AS intentos, max(puntaje) AS mejor,
              (array_agg(puntaje ORDER BY realizado_en DESC, id_intento DESC))[1] AS ultimo,
              COALESCE(bool_or(aprobado), false) AS aprobada
         FROM intento_evaluacion
        WHERE id_inscripcion = $1 AND id_evaluacion = $2`,
      [idInscripcion, idEvaluacion],
    );
    const fila = rows[0]!;
    return {
      intentos: fila.intentos,
      mejorPuntaje: fila.mejor === null ? null : Number(fila.mejor),
      ultimoPuntaje: fila.ultimo === null ? null : Number(fila.ultimo),
      aprobada: fila.aprobada,
    };
  },

  async crearIntento(
    cliente: PoolClient, idInscripcion: number, idEvaluacion: number, puntaje: number, aprobado: boolean,
  ): Promise<{ id: number; realizadoEn: Date }> {
    const { rows } = await cliente.query<{ id: number; realizadoEn: Date }>(
      `INSERT INTO intento_evaluacion (id_inscripcion, id_evaluacion, puntaje, aprobado)
       VALUES ($1, $2, $3, $4)
       RETURNING id_intento AS id, realizado_en AS "realizadoEn"`,
      [idInscripcion, idEvaluacion, puntaje, aprobado],
    );
    return rows[0]!;
  },

  async guardarRespuestas(
    cliente: PoolClient, idIntento: number, respuestas: { preguntaId: number; opcionId: number }[],
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO respuesta (id_intento, id_pregunta, id_opcion)
       SELECT $1, r.pregunta, r.opcion
         FROM unnest($2::int[], $3::int[]) AS r(pregunta, opcion)`,
      [idIntento, respuestas.map((r) => r.preguntaId), respuestas.map((r) => r.opcionId)],
    );
  },
};
