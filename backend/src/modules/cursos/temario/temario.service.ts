import type { UsuarioSesion } from '../../../shared/auth/tipos.js';
import { enTransaccion } from '../../../shared/database/pool.js';
import { AppError } from '../../../shared/http/app-error.js';
import { registrarEvento } from '../../../shared/log/registro.js';
import type { ContextoLeccion, CuestionarioDocente, CursoDetalle } from '../cursos.modelo.js';
import { detallePrivado, exigirVigencia, prevalidarPdfCurso, vigenciaPrevia } from '../detalle-privado.service.js';
import { fichaRepository } from '../ficha.repository.js';
import { MENSAJE_CONSULTAR_CURSO, MENSAJES, politicaCurso } from '../politica-curso.js';
import { obtenerLiberadorArchivos } from '../puertos.js';
import { cuestionarioRepository } from './cuestionario.repository.js';
import {
  extraerYoutubeVideoId, type DatosCuestionario, type DatosLeccion, type DatosModulo,
} from './temario.esquemas.js';
import { temarioRepository } from './temario.repository.js';

function exigirEvaluacion(contexto: ContextoLeccion): void {
  if (contexto.tipoLeccion !== 'EVALUACION') {
    throw AppError.solicitudInvalida('Solo las lecciones EVALUACION tienen preguntas.');
  }
}

async function limpiarPendientesFueraDeTransaccion(): Promise<void> {
  const liberador = obtenerLiberadorArchivos();
  if (!liberador) return;
  try {
    await liberador.ejecutarPendientes();
  } catch {
    registrarEvento('archivo.limpieza_reintentar', {}, 'aviso');
  }
}

/**
 * Lee del disco los PDF del curso del módulo o la lección ANTES de abrir la transacción: así
 * `detallePrivado` no toca el disco con `FOR UPDATE OF c` tomado (D-01). Si el módulo o la lección no
 * existen, no hay nada que validar y la transacción responde 404 como siempre.
 */
async function prevalidarDe(idCurso: number | null): Promise<ReadonlySet<string>> {
  return idCurso === null ? new Set<string>() : prevalidarPdfCurso(idCurso);
}

export const temarioService = {
  async crearModulo(
    idCurso: number,
    datos: DatosModulo,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarPdfCurso(idCurso);

    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.crearModulo);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      const cantidad = await temarioRepository.contarModulos(cliente, idCurso);
      if (cantidad >= 10) {
        throw AppError.solicitudInvalida('Un curso puede tener como máximo 10 módulos.', [
          {
            campo: 'modulos',
            mensaje: 'Se alcanzó el límite de módulos.',
          },
        ]);
      }

      const ocupado = await temarioRepository.ordenModuloOcupado(cliente, idCurso, datos.orden);
      if (ocupado) {
        throw AppError.solicitudInvalida('El orden del módulo ya está ocupado.', [
          {
            campo: 'orden',
            mensaje: 'Selecciona un orden disponible.',
          },
        ]);
      }

      await temarioRepository.crearModulo(cliente, idCurso, datos);
      return exigirVigencia(previos, await detallePrivado(cliente, idCurso, prevalidados));
    }, { actor: usuario.idPersona });
  },

  async actualizarModulo(
    idModulo: number,
    datos: DatosModulo,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeModulo(idModulo));

    return enTransaccion(async (cliente) => {
      const modulo = await temarioRepository.buscarModulo(cliente, idModulo);
      if (!modulo) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const base = await fichaRepository.base(cliente, modulo.idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.actualizarModulo);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      const moduloActual = await temarioRepository.buscarModulo(cliente, idModulo);
      if (!moduloActual || moduloActual.idCurso !== base.id) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const ocupado = await temarioRepository.ordenModuloOcupado(
        cliente,
        base.id,
        datos.orden,
        idModulo,
      );
      if (ocupado) {
        throw AppError.solicitudInvalida('El orden del módulo ya está ocupado.', [
          {
            campo: 'orden',
            mensaje: 'Selecciona otro orden.',
          },
        ]);
      }

      const actualizado = await temarioRepository.actualizarModulo(
        cliente,
        idModulo,
        base.id,
        datos.titulo,
        datos.orden,
      );
      if (!actualizado) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      return exigirVigencia(previos, await detallePrivado(cliente, modulo.idCurso, prevalidados));
    }, { actor: usuario.idPersona });
  },

  async crearLeccion(
    idModulo: number,
    datos: DatosLeccion,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeModulo(idModulo));

    return enTransaccion(async (cliente) => {
      const modulo = await temarioRepository.buscarModulo(cliente, idModulo);
      if (!modulo) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const base = await fichaRepository.base(cliente, modulo.idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.crearLeccion);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      const cantidad = await temarioRepository.contarLecciones(cliente, idModulo);
      if (cantidad >= 12) {
        throw AppError.solicitudInvalida('Un módulo admite como máximo 12 lecciones.', [
          {
            campo: 'lecciones',
            mensaje: 'Se alcanzó el límite de lecciones.',
          },
        ]);
      }

      const ocupado = await temarioRepository.ordenLeccionOcupado(cliente, idModulo, datos.orden);
      if (ocupado) {
        throw AppError.solicitudInvalida('El orden de la lección ya está ocupado.', [
          {
            campo: 'orden',
            mensaje: 'Selecciona un orden disponible.',
          },
        ]);
      }

      const youtubeVideoId = datos.tipo === 'VIDEO' ? extraerYoutubeVideoId(datos.youtubeUrl) : null;
      await temarioRepository.crearLeccion(cliente, idModulo, datos, youtubeVideoId);
      return exigirVigencia(previos, await detallePrivado(cliente, modulo.idCurso, prevalidados));
    }, { actor: usuario.idPersona });
  },

  async actualizarLeccion(
    idLeccion: number,
    datos: DatosLeccion,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeLeccion(idLeccion));

    return enTransaccion(async (cliente) => {
      const leccion = await temarioRepository.buscarLeccionParaEditar(cliente, idLeccion);
      if (!leccion) {
        throw AppError.noEncontrado('Lección no disponible.');
      }

      const base = await fichaRepository.base(cliente, leccion.idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.actualizarLeccion);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      if (leccion.tipo !== datos.tipo) {
        throw AppError.solicitudInvalida('No se puede cambiar el tipo de una lección.');
      }

      const ocupado = await temarioRepository.ordenLeccionOcupado(
        cliente,
        leccion.idModulo,
        datos.orden,
        idLeccion,
      );
      if (ocupado) {
        throw AppError.solicitudInvalida('El orden de la lección ya está ocupado.', [
          {
            campo: 'orden',
            mensaje: 'Selecciona otro orden.',
          },
        ]);
      }

      const actualizado = await temarioRepository.actualizarLeccion(
        cliente,
        idLeccion,
        leccion.idModulo,
        datos,
        datos.tipo === 'VIDEO' ? extraerYoutubeVideoId(datos.youtubeUrl) : null,
      );
      if (!actualizado) {
        throw AppError.noEncontrado('Lección no disponible.');
      }

      return exigirVigencia(previos, await detallePrivado(cliente, leccion.idCurso, prevalidados));
    }, { actor: usuario.idPersona });
  },

  async eliminarLeccion(
    idLeccion: number,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeLeccion(idLeccion));

    const resultado = await enTransaccion(async (cliente) => {
      const leccion = await temarioRepository.buscarLeccionParaEditar(cliente, idLeccion);
      if (!leccion) {
        throw AppError.noEncontrado('Lección no disponible.');
      }

      const base = await fichaRepository.base(cliente, leccion.idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.eliminarLeccion);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      const idsPdf = await temarioRepository.pdfDeLeccion(cliente, idLeccion);
      const eliminada = await temarioRepository.eliminarLeccion(
        cliente,
        idLeccion,
        leccion.idModulo,
      );
      if (!eliminada) {
        throw AppError.noEncontrado('Lección no disponible.');
      }

      const liberador = obtenerLiberadorArchivos();
      if (liberador) {
        await liberador.retirarSinUso(cliente, leccion.idCurso, idsPdf);
      }

      return exigirVigencia(previos, await detallePrivado(cliente, leccion.idCurso, prevalidados));
    }, { actor: usuario.idPersona });

    await limpiarPendientesFueraDeTransaccion();
    return resultado;
  },

  /** El docente dueño (o un administrador que revisa) ve las preguntas con su respuesta correcta. */
  async cuestionarioDocente(idLeccion: number, usuario: UsuarioSesion): Promise<CuestionarioDocente> {
    return enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, idLeccion);
      if (!contexto) throw AppError.noEncontrado('Lección no disponible.');
      if (!politicaCurso.puedeLeerArchivos(contexto, usuario)) {
        throw AppError.sinPermiso(MENSAJE_CONSULTAR_CURSO);
      }
      exigirEvaluacion(contexto);
      return {
        leccionId: idLeccion,
        porcentajeAprobacion: await cuestionarioRepository.porcentajeAprobacion(cliente, idLeccion) ?? 60,
        preguntas: await cuestionarioRepository.preguntas(cliente, idLeccion),
      };
    });
  },

  async guardarCuestionario(
    idLeccion: number,
    datos: DatosCuestionario,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeLeccion(idLeccion));

    return enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, idLeccion, true);
      if (!contexto) throw AppError.noEncontrado('Lección no disponible.');
      politicaCurso.exigirEditable(contexto, usuario, MENSAJES.cuestionario);
      exigirEvaluacion(contexto);
      const previos = await vigenciaPrevia(cliente, contexto.estado, contexto.id, prevalidados);

      await cuestionarioRepository.reemplazar(cliente, idLeccion, datos);
      return exigirVigencia(previos, await detallePrivado(cliente, contexto.id, prevalidados));
    }, { actor: usuario.idPersona });
  },

  /** Quita un recurso adjunto y retira su archivo del disco si ya nadie lo usa. */
  async eliminarRecurso(idRecurso: number, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const recurso = await temarioRepository.buscarRecurso(idRecurso);
    if (!recurso) throw AppError.noEncontrado('Recurso no disponible.');
    const prevalidados = await prevalidarPdfCurso(recurso.idCurso);

    const resultado = await enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, recurso.idLeccion, true);
      if (!contexto) throw AppError.noEncontrado('Recurso no disponible.');
      politicaCurso.exigirEditable(contexto, usuario, MENSAJES.archivoDeLeccion);

      const idArchivo = await temarioRepository.eliminarRecurso(cliente, idRecurso, recurso.idLeccion);
      if (idArchivo === null) throw AppError.noEncontrado('Recurso no disponible.');
      await obtenerLiberadorArchivos()?.retirarSinUso(cliente, contexto.id, [idArchivo]);
      return detallePrivado(cliente, contexto.id, prevalidados);
    }, { actor: usuario.idPersona });

    await limpiarPendientesFueraDeTransaccion();
    return resultado;
  },

  async eliminarModulo(
    idModulo: number,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarDe(await temarioRepository.idCursoDeModulo(idModulo));

    const resultado = await enTransaccion(async (cliente) => {
      const modulo = await temarioRepository.buscarModulo(cliente, idModulo);
      if (!modulo) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const base = await fichaRepository.base(cliente, modulo.idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.eliminarModulo);
      const previos = await vigenciaPrevia(cliente, base.estado, base.id, prevalidados);

      const idsPdf = await temarioRepository.pdfDeModulo(cliente, idModulo);
      const eliminado = await temarioRepository.eliminarModulo(cliente, idModulo, modulo.idCurso);
      if (!eliminado) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const liberador = obtenerLiberadorArchivos();
      if (liberador) {
        await liberador.retirarSinUso(cliente, modulo.idCurso, idsPdf);
      }

      return exigirVigencia(previos, await detallePrivado(cliente, modulo.idCurso, prevalidados));
    }, { actor: usuario.idPersona });

    await limpiarPendientesFueraDeTransaccion();
    return resultado;
  },
};
