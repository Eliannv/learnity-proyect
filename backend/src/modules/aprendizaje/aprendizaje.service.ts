import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import type { DatosProgreso, PaginacionEstudiantes } from './aprendizaje.esquemas.js';
import type { CursoInscrito, DetalleAprendizaje, InscripcionResumen, ModuloAprendizaje, ProgresoGuardado, SeguimientoDocente } from './aprendizaje.modelo.js';
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

function ordenarTemario(filas: FilaLeccion[]): ModuloAprendizaje[] {
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
        vistaPrevia: fila.vistaPrevia ?? false, archivoId: fila.archivoId,
        youtubeVideoId: fila.tipo === 'VIDEO' ? fila.youtubeVideoId : null,
        progreso: { segundosVistos: fila.segundosVistos ?? 0, completada: fila.completada ?? false },
      });
    }
  }
  return modulos;
}

/** Interfaz estable para Contenido: no necesita acceder al repositorio de Aprendizaje. */
export interface ServicioAprendizaje {
  estaInscritoEnCurso(idPersona: number, idCurso: number): Promise<boolean>;
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
    return { ...cursoInscrito(fila), modulos: ordenarTemario(await repo.temarioDelEstudiante(fila.id, idCurso)) };
  },

  async guardarProgreso(idLeccion: number, datos: DatosProgreso, usuario: UsuarioSesion): Promise<ProgresoGuardado> {
    exigirEstudiante(usuario);
    return enTransaccion(async (cliente) => {
      const contexto = await repo.inscripcionParaLeccion(cliente, usuario.idPersona, idLeccion);
      if (!contexto) throw AppError.noEncontrado('Lección no disponible.');
      const progreso = await repo.guardarLeccion(
        cliente, contexto.inscripcionId, idLeccion, datos.segundosVistos ?? 0, datos.completada ?? false,
      );
      const { total, completadas } = await repo.contarLecciones(cliente, contexto.inscripcionId, contexto.cursoId);
      // Redondear antes podría mostrar 100 % sin haber completado la última lección.
      const porcentaje = total > 0 && completadas === total ? 100 : total > 0 ? Math.floor(completadas * 100 / total) : 0;
      await repo.actualizarInscripcion(cliente, contexto.inscripcionId, idLeccion, porcentaje);
      return {
        leccionId: idLeccion, segundosVistos: progreso.segundosVistos, completada: progreso.completada,
        progresoPct: porcentaje, estado: porcentaje === 100 ? 'COMPLETADA' : 'ACTIVA',
        ultimaLeccionId: idLeccion,
      };
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
};
