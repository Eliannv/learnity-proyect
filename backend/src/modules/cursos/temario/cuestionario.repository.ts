import type { PoolClient } from 'pg';
import type { CuestionarioDocente, LetraOpcion } from '../cursos.modelo.js';
import { LETRAS, type DatosCuestionario } from './temario.esquemas.js';

interface FilaOpcion {
  preguntaId: number;
  orden: number;
  enunciado: string;
  letra: LetraOpcion;
  texto: string;
  esCorrecta: boolean;
}

/** SQL del cuestionario que edita el docente (tablas evaluacion, pregunta y opcion). */
export const cuestionarioRepository = {
  async porcentajeAprobacion(cliente: PoolClient, idLeccion: number): Promise<number | null> {
    const { rows } = await cliente.query<{ porcentaje: number }>(
      'SELECT porcentaje_aprobacion AS porcentaje FROM evaluacion WHERE id_leccion = $1',
      [idLeccion],
    );
    return rows[0]?.porcentaje ?? null;
  },

  async preguntas(cliente: PoolClient, idLeccion: number): Promise<CuestionarioDocente['preguntas']> {
    const { rows } = await cliente.query<FilaOpcion>(
      `SELECT p.id_pregunta AS "preguntaId", p.orden, p.enunciado,
              o.letra, o.texto, o.es_correcta AS "esCorrecta"
         FROM evaluacion e
         JOIN pregunta p ON p.id_evaluacion = e.id_evaluacion
         JOIN opcion o ON o.id_pregunta = p.id_pregunta
        WHERE e.id_leccion = $1
        ORDER BY p.orden, o.letra`,
      [idLeccion],
    );

    const preguntas: CuestionarioDocente['preguntas'] = [];
    for (const fila of rows) {
      let pregunta = preguntas.at(-1);
      if (pregunta?.id !== fila.preguntaId) {
        pregunta = { id: fila.preguntaId, orden: fila.orden, enunciado: fila.enunciado, opciones: [], correcta: 'A' };
        preguntas.push(pregunta);
      }
      pregunta.opciones.push({ letra: fila.letra, texto: fila.texto });
      if (fila.esCorrecta) pregunta.correcta = fila.letra;
    }
    return preguntas;
  },

  /**
   * Reemplaza las preguntas conservando la fila de evaluacion: sus intentos (puntaje y fecha) siguen
   * siendo historial del estudiante. Las respuestas a preguntas borradas caen en cascada.
   */
  async reemplazar(cliente: PoolClient, idLeccion: number, datos: DatosCuestionario): Promise<void> {
    const existente = await cliente.query<{ id: number }>(
      'SELECT id_evaluacion AS id FROM evaluacion WHERE id_leccion = $1',
      [idLeccion],
    );
    let idEvaluacion = existente.rows[0]?.id;
    if (idEvaluacion === undefined) {
      const creada = await cliente.query<{ id: number }>(
        'INSERT INTO evaluacion (id_leccion) VALUES ($1) RETURNING id_evaluacion AS id',
        [idLeccion],
      );
      idEvaluacion = creada.rows[0]!.id;
    }

    await cliente.query('DELETE FROM pregunta WHERE id_evaluacion = $1', [idEvaluacion]);

    for (const [i, pregunta] of datos.preguntas.entries()) {
      const { rows } = await cliente.query<{ id: number }>(
        `INSERT INTO pregunta (id_evaluacion, enunciado, orden)
         VALUES ($1, $2, $3) RETURNING id_pregunta AS id`,
        [idEvaluacion, pregunta.enunciado, i + 1],
      );
      await cliente.query(
        `INSERT INTO opcion (id_pregunta, letra, texto, es_correcta)
         SELECT $1, o.letra, o.texto, o.letra = $3
           FROM unnest($2::text[], $4::text[]) AS o(texto, letra)`,
        [rows[0]!.id, pregunta.opciones, pregunta.correcta, [...LETRAS]],
      );
    }
  },
};
