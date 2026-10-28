import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import type { DatosProgreso, PaginacionEstudiantes } from './aprendizaje.esquemas.js';
import type {
  CursoInscrito, DetalleAprendizaje, InscripcionResumen, ModuloAprendizaje, ProgresoGuardado, SeguimientoDocente,
  RecursoAprendizaje, TipoLeccionAprendizaje,
} from './aprendizaje.modelo.js';
import { aprendizajeRepository as repo, type FilaCursoInscrito, type FilaInscripcion, type FilaLeccion } from './aprendizaje.repository.js';

function exigirEstudiante(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ESTUDIANTE')) throw AppError.sinPermiso();
}

function inscripcionPublica(fila: FilaInscripcion): InscripcionResumen {
  return {
    id: fila.id, cursoId: fila.cursoId, estado: fila.estado, progresoPct: fila.progresoPct,
    ultimaLeccionId: fila.ultimaLeccionId, inscritoEn: fila.inscritoEn.toISOString(),
    completadoEn: fila.completadoEn?.toISOString() ?? null,
  };
}

function cursoInscrito(fila: FilaCursoInscrito): CursoInscrito {
  return {
    curso: {
      id: fila.cursoId, titulo: fila.titulo, subtitulo: fila.subtitulo,
      portadaUrl: fila.portadaUrl, nivel: fila.nivel,
      categoria: { id: fila.categoriaId, nombre: fila.categoriaNombre }, docente: fila.docente,
    },
    inscripcion: inscripcionPublica(fila),
    totalLecciones: fila.totalLecciones, leccionesCompletadas: fila.leccionesCompletadas,
  };
}

function ordenarTemario(filas: FilaLeccion[], recursos: (RecursoAprendizaje & { leccionId: number })[] = []): ModuloAprendizaje[] {
  const modulos: ModuloAprendizaje[] = [];
  for (const fila of filas) {
    let modulo = modulos.at(-1);
    if (modulo?.id !== fila.moduloId) {
      modulo = { id: fila.moduloId, orden: fila.moduloOrden, titulo: fila.moduloTitulo, lecciones: [] };
      modulos.push(modulo);
    }
    if (fila.id !== null && fila.orden !== null && fila.titulo !== null && fila.tipo !== null) {
      modulo.lecciones.push({
        id: fila.id, orden: fila.orden, titulo: fila.titulo, tipo: fila.tipo,
        archivoId: fila.archivoId,
        youtubeVideoId: fila.tipo === 'VIDEO' ? fila.youtubeVideoId : null,
        evaluacionId: fila.tipo === 'EVALUACION' ? fila.evaluacionId : null,
        recursos: recursos.filter((r) => r.leccionId === fila.id).map(({ leccionId: _, ...r }) => r),
        progreso: { segundosVistos: fila.segundosVistos ?? 0, completada: fila.completada ?? false },
      });
    }
  }
  // Un módulo nuevo de un curso publicado no se muestra hasta que tenga algún contenido listo.
  return modulos.filter((m) => m.lecciones.length > 0);
}

/** Guarda el avance de una lección y recalcula el porcentaje de la inscripción (ya bloqueada). */
async function registrarAvance(
  cliente: PoolClient, contexto: ContextoLeccionInscrita, idLeccion: number,
  segundosVistos?: number, completada?: boolean,
): Promise<ProgresoGuardado> {
  const progreso = await repo.guardarLeccion(cliente, contexto.inscripcionId, idLeccion, segundosVistos, completada);
  const { total, completadas } = await repo.contarLecciones(cliente, contexto.inscripcionId, contexto.cursoId);
  // Redondear antes podría mostrar 100 % sin haber completado la última lección.
  const porcentaje = total > 0 && completadas === total ? 100 : total > 0 ? Math.floor(completadas * 100 / total) : 0;
  await repo.actualizarInscripcion(cliente, contexto.inscripcionId, idLeccion, porcentaje);
  return {
    leccionId: idLeccion, segundosVistos: progreso.segundosVistos, completada: progreso.completada,
    progresoPct: porcentaje, estado: porcentaje === 100 ? 'COMPLETADA' : 'ACTIVA',
    ultimaLeccionId: idLeccion,
  };
}

export interface ContextoLeccionInscrita {
  inscripcionId: number;
  cursoId: number;
  tipo: TipoLeccionAprendizaje;
}

/** Interfaz estable para Contenido y Evaluaciones: no necesitan acceder al repositorio de Aprendizaje. */
export interface ServicioAprendizaje {
  estaInscritoEnCurso(idPersona: number, idCurso: number): Promise<boolean>;
  /** Inscripción del estudiante en el curso publicado de una lección disponible; con `bloquear`, FOR UPDATE. */
  inscripcionParaLeccion(
    cliente: PoolClient, idPersona: number, idLeccion: number, bloquear?: boolean,
  ): Promise<ContextoLeccionInscrita | null>;
  /** Registra la actividad en la lección y, si `completada`, la marca como completada. */
  registrarAvance(
    cliente: PoolClient, contexto: ContextoLeccionInscrita, idLeccion: number, completada?: boolean,
  ): Promise<ProgresoGuardado>;
}

export const aprendizajeService = {
  async inscribir(idCurso: number, usuario: UsuarioSesion): Promise<{ creada: boolean; inscripcion: InscripcionResumen }> {
    exigirEstudiante(usuario);
    return enTransaccion(async (cliente) => {
      if (!(await repo.cursoPublicado(cliente, idCurso))) throw AppError.noEncontrado('Curso no disponible.');
      const creada = await repo.crearInscripcion(cliente, usuario.idPersona, idCurso);
      const fila = await repo.inscripcion(cliente, usuario.idPersona, idCurso);
      if (!fila) throw AppError.noEncontrado('Curso no disponible.');
      return { creada, inscripcion: inscripcionPublica(fila) };
    }, { actor: usuario.idPersona });
  },

  async listar(usuario: UsuarioSesion): Promise<{ items: CursoInscrito[] }> {
    exigirEstudiante(usuario);
    return { items: (await repo.cursosDelEstudiante(usuario.idPersona)).map(cursoInscrito) };
  },

  async detalle(idCurso: number, usuario: UsuarioSesion): Promise<DetalleAprendizaje> {
    exigirEstudiante(usuario);
    const fila = await repo.cursoDelEstudiante(usuario.idPersona, idCurso);
    if (!fila) throw AppError.noEncontrado('Curso no disponible.');
    const [temario, recursos] = await Promise.all([
      repo.temarioDelEstudiante(fila.id, idCurso),
      repo.recursosDelCurso(idCurso),
    ]);
    return { ...cursoInscrito(fila), modulos: ordenarTemario(temario, recursos) };
  },

  async guardarProgreso(idLeccion: number, datos: DatosProgreso, usuario: UsuarioSesion): Promise<ProgresoGuardado> {
    exigirEstudiante(usuario);
    return enTransaccion(async (cliente) => {
      const contexto = await repo.inscripcionParaLeccion(cliente, usuario.idPersona, idLeccion);
      if (!contexto) throw AppError.noEncontrado('Lección no disponible.');
      if (contexto.tipo === 'EVALUACION' && datos.completada !== undefined) {
        throw AppError.solicitudInvalida('Una evaluación se completa al aprobarla, no se marca a mano.', [
          { campo: 'completada', mensaje: 'Responde la evaluación y apruébala para completarla.' },
        ]);
      }
      return registrarAvance(cliente, contexto, idLeccion, datos.segundosVistos, datos.completada);
    }, { actor: usuario.idPersona });
  },

  async seguimiento(idCurso: number, filtro: PaginacionEstudiantes, usuario: UsuarioSesion): Promise<SeguimientoDocente> {
    if (!usuario.roles.includes('DOCENTE') && !usuario.roles.includes('ADMIN')) throw AppError.sinPermiso();
    const curso = await repo.cursoParaSeguimiento(idCurso);
    if (!curso || (!usuario.roles.includes('ADMIN') &&
        (curso.docentePersonaId !== usuario.idPersona || !curso.docenteActivo))) {
      throw AppError.noEncontrado('Curso no disponible.');
    }
    const resumen = await repo.resumenSeguimiento(idCurso);
    const filas = await repo.estudiantesDelCurso(idCurso, filtro.limite, (filtro.pagina - 1) * filtro.limite);
    return {
      curso: { id: curso.id, titulo: curso.titulo },
      items: filas.map((fila) => ({
        idPersona: fila.idPersona, nombre: fila.nombre, estado: fila.estado,
        progresoPct: fila.progresoPct, ultimaLeccionId: fila.ultimaLeccionId,
        inscritoEn: fila.inscritoEn.toISOString(), ultimaActividadEn: fila.ultimaActividadEn.toISOString(),
      })),
      pagina: filtro.pagina, limite: filtro.limite, total: resumen.inscritos,
      totalPaginas: Math.ceil(resumen.inscritos / filtro.limite), resumen,
    };
  },

  estaInscritoEnCurso: (idPersona: number, idCurso: number) => repo.tieneInscripcionPublicada(idPersona, idCurso),
};

export const aprendizajeApi: ServicioAprendizaje = {
  estaInscritoEnCurso: (idPersona, idCurso) => aprendizajeService.estaInscritoEnCurso(idPersona, idCurso),
  inscripcionParaLeccion: (cliente, idPersona, idLeccion, bloquear = false) =>
    repo.inscripcionParaLeccion(cliente, idPersona, idLeccion, bloquear),
  registrarAvance: (cliente, contexto, idLeccion, completada) =>
    registrarAvance(cliente, contexto, idLeccion, undefined, completada),
};
