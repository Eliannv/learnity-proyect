import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import type { FiltrosAnaliticas } from './analiticas.esquemas.js';
import type { Analiticas } from './analiticas.modelo.js';
import { analiticasRepository as repo } from './analiticas.repository.js';

/** Ventana de la tasa de conversión: lo bastante larga para tener datos y lo bastante corta para ser actual. */
const DIAS_CONVERSION = 30;

export const analiticasService = {
  async obtener({ curso }: FiltrosAnaliticas, usuario: UsuarioSesion): Promise<Analiticas> {
    if (!usuario.roles.includes('DOCENTE')) throw AppError.sinPermiso();
    const cursos = await repo.cursos(usuario.idPersona);
    // Un curso ajeno responde igual que uno inexistente: no revela cursos de otros docentes.
    if (curso !== undefined && !cursos.some((c) => c.id === curso)) throw AppError.noEncontrado('Curso no disponible.');
    const idCurso = curso ?? null;
    const [resumen, actividad, conversion, embudo, porCurso] = await Promise.all([
      repo.resumen(usuario.idPersona, idCurso),
      repo.actividad(usuario.idPersona, idCurso),
      repo.conversion(usuario.idPersona, idCurso, DIAS_CONVERSION),
      idCurso === null ? null : repo.embudo(usuario.idPersona, idCurso),
      idCurso === null ? repo.porCurso(usuario.idPersona) : null,
    ]);
    return { cursos, resumen, actividad, conversion, embudo, porCurso };
  },
};
