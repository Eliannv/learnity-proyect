import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { aprendizajeApi, type ContextoLeccionInscrita } from '../aprendizaje/index.js';
import type { DatosIntento } from './evaluaciones.esquemas.js';
import type { EvaluacionEstudiante, ResultadoIntento } from './evaluaciones.modelo.js';
import { evaluacionesRepository as repo, type FilaEvaluacion, type OpcionCalificable } from './evaluaciones.repository.js';

// Capa service del módulo Evaluaciones: reglas del negocio.
// Si necesita datos de otro módulo, llama al service de ese módulo, nunca a su repository.

function exigirEstudiante(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ESTUDIANTE')) throw AppError.sinPermiso();
}

/**
 * La evaluación existe, su curso sigue publicado, el estudiante está inscrito y ya tiene las preguntas
 * mínimas. Cualquier otro caso responde 404 para no revelar evaluaciones ajenas.
 */
async function accesible(
  cliente: PoolClient, idEvaluacion: number, usuario: UsuarioSesion, bloquear: boolean,
): Promise<{ evaluacion: FilaEvaluacion; inscripcion: ContextoLeccionInscrita }> {
  const evaluacion = await repo.evaluacion(cliente, idEvaluacion);
  const inscripcion = evaluacion
    ? await aprendizajeApi.inscripcionParaLeccion(cliente, usuario.idPersona, evaluacion.leccionId, bloquear)
    : null;
  if (!evaluacion || !inscripcion) throw AppError.noEncontrado('Evaluación no disponible.');
  return { evaluacion, inscripcion };
}

/** Una respuesta por cada pregunta de esta evaluación, sin repetir ni traer preguntas de otra. */
function calificar(opciones: OpcionCalificable[], datos: DatosIntento) {
  const porPregunta = new Map<number, OpcionCalificable[]>();
  for (const o of opciones) porPregunta.set(o.preguntaId, [...(porPregunta.get(o.preguntaId) ?? []), o]);

  const vistas = new Set<number>();
  const respuestas = datos.respuestas.map((r, i) => {
    const elegida = porPregunta.get(r.preguntaId)?.find((o) => o.letra === r.opcion);
    if (!elegida || vistas.has(r.preguntaId)) {
      throw AppError.solicitudInvalida('Revisa tus respuestas.', [{
        campo: `respuestas.${i}`,
        mensaje: elegida ? 'Esta pregunta ya tiene una respuesta.' : 'La pregunta no pertenece a esta evaluación.',
      }]);
    }
    vistas.add(r.preguntaId);
    return { preguntaId: r.preguntaId, opcion: r.opcion, opcionId: elegida.opcionId, correcta: elegida.esCorrecta };
  });

  if (vistas.size !== porPregunta.size) {
    throw AppError.solicitudInvalida('Responde todas las preguntas antes de enviar.', [{
      campo: 'respuestas',
      mensaje: `Faltan ${porPregunta.size - vistas.size} pregunta(s) por responder.`,
    }]);
  }
  return respuestas;
}

export const evaluacionesService = {
  async obtener(idEvaluacion: number, usuario: UsuarioSesion): Promise<EvaluacionEstudiante> {
    exigirEstudiante(usuario);
    return enTransaccion(async (cliente) => {
      const { evaluacion, inscripcion } = await accesible(cliente, idEvaluacion, usuario, false);
      return {
        ...evaluacion,
        preguntas: await repo.preguntasPublicas(cliente, idEvaluacion),
        resumen: await repo.resumen(cliente, inscripcion.inscripcionId, idEvaluacion),
      };
    });
  },

  /** Intentos ilimitados. Aprobar marca la lección como completada; suspender no bloquea nada. */
  async responder(idEvaluacion: number, datos: DatosIntento, usuario: UsuarioSesion): Promise<ResultadoIntento> {
    exigirEstudiante(usuario);
    return enTransaccion(async (cliente) => {
      const { evaluacion, inscripcion } = await accesible(cliente, idEvaluacion, usuario, true);
      const respuestas = calificar(await repo.opcionesCalificables(cliente, idEvaluacion), datos);

      const correctas = respuestas.filter((r) => r.correcta).length;
      const puntaje = Math.round(correctas * 10_000 / respuestas.length) / 100;
      const aprobado = puntaje >= evaluacion.porcentajeAprobacion;

      const intento = await repo.crearIntento(cliente, inscripcion.inscripcionId, idEvaluacion, puntaje, aprobado);
      await repo.guardarRespuestas(cliente, intento.id, respuestas);
      const progreso = await aprendizajeApi.registrarAvance(
        cliente, inscripcion, evaluacion.leccionId, aprobado ? true : undefined,
      );

      return {
        intento: {
          id: intento.id, puntaje, aprobado, correctas, total: respuestas.length,
          realizadoEn: intento.realizadoEn.toISOString(),
        },
        respuestas: respuestas.map(({ preguntaId, opcion, correcta }) => ({ preguntaId, opcion, correcta })),
        resumen: await repo.resumen(cliente, inscripcion.inscripcionId, idEvaluacion),
        progresoPct: progreso.progresoPct,
        estado: progreso.estado,
      };
    }, { actor: usuario.idPersona });
  },
};
