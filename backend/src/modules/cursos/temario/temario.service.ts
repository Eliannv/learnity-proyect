import type { UsuarioSesion } from '../../../shared/auth/tipos.js';
import { enTransaccion } from '../../../shared/database/pool.js';
import { AppError } from '../../../shared/http/app-error.js';
import { registrarEvento } from '../../../shared/log/registro.js';
import type { CursoDetalle } from '../cursos.modelo.js';
import { detallePrivado, prevalidarPdfCurso } from '../detalle-privado.service.js';
import { fichaRepository } from '../ficha.repository.js';
import { MENSAJES, politicaCurso } from '../politica-curso.js';
import { obtenerLiberadorArchivos } from '../puertos.js';
import type { DatosLeccion, DatosModulo } from './temario.esquemas.js';
import { temarioRepository } from './temario.repository.js';
import { idYoutube } from './youtube.js';

function normalizarLeccion(datos: DatosLeccion) {
  return {
    titulo: datos.titulo,
    orden: datos.orden,
    tipo: datos.tipo,
    vistaPrevia: datos.vistaPrevia,

    youtubeId:
      datos.tipo === 'VIDEO'
        ? idYoutube(datos.youtubeUrl!)
        : null,
  };
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
      return detallePrivado(cliente, idCurso, prevalidados);
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

      return detallePrivado(cliente, modulo.idCurso, prevalidados);
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

      await temarioRepository.crearLeccion(
        cliente,
        idModulo,
        normalizarLeccion(datos),
      );
      return detallePrivado(cliente, modulo.idCurso, prevalidados);
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

      if (
        leccion.tipo !== datos.tipo ||
        !['DOCUMENTO', 'VIDEO'].includes(leccion.tipo)
      ) {
        throw AppError.solicitudInvalida(
          'El tipo de la lección no se puede cambiar.'
        );
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
        normalizarLeccion(datos),
      );
      if (!actualizado) {
        throw AppError.noEncontrado('Lección no disponible.');
      }

      return detallePrivado(cliente, leccion.idCurso, prevalidados);
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

      return detallePrivado(cliente, leccion.idCurso, prevalidados);
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

      const idsPdf = await temarioRepository.pdfDeModulo(cliente, idModulo);
      const eliminado = await temarioRepository.eliminarModulo(cliente, idModulo, modulo.idCurso);
      if (!eliminado) {
        throw AppError.noEncontrado('Módulo no disponible.');
      }

      const liberador = obtenerLiberadorArchivos();
      if (liberador) {
        await liberador.retirarSinUso(cliente, modulo.idCurso, idsPdf);
      }

      return detallePrivado(cliente, modulo.idCurso, prevalidados);
    }, { actor: usuario.idPersona });

    await limpiarPendientesFueraDeTransaccion();
    return resultado;
  },
};
