import { AppError } from '../../shared/http/app-error.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type {
  DatosCurso,
  DatosModulo,
  DatosLeccion,
} from './cursos-gestion.esquemas.js';

import type { UsuarioSesion } from '../../shared/auth/tipos.js';

import {
  cursosIntegracionRepository,
} from './cursos-integracion.repository.js';

import {
  cursosIntegracionService,
} from './cursos-integracion.service.js';

import {
  limpiezaPdfService,
} from '../contenido/contenido-limpieza.service.js';

import {
  cursosRepository,
  type CursoFila,
  type FiltrosPublicos,
  type LeccionFila,
} from './cursos.repository.js';

function cursoPublico(fila: CursoFila) {
  return {
    id: fila.id,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,

    categoria: {
      id: fila.categoriaId,
      nombre: fila.categoriaNombre,
    },

    docente: fila.docente,
    nivel: fila.nivel,
    portadaUrl: fila.portadaUrl,

    modulos: fila.modulos,
    lecciones: fila.lecciones,
    minutos: Math.round(fila.segundos / 60),

    publicadoEn: fila.publicadoEn.toISOString(),

    estado: 'PUBLICADO' as const,
  };
}

function ordenarTemario(filas: LeccionFila[]) {
  const modulos: {
    id: number;
    orden: number;
    titulo: string;
    lecciones: {
      id: number;
      orden: number;
      titulo: string;
      tipo: NonNullable<LeccionFila['tipo']>;
      minutos: number;
    }[];
  }[] = [];

  for (const fila of filas) {
    let modulo = modulos.at(-1);

    if (modulo?.id !== fila.moduloId) {
      modulo = {
        id: fila.moduloId,
        orden: fila.moduloOrden,
        titulo: fila.moduloTitulo,
        lecciones: [],
      };

      modulos.push(modulo);
    }

    if (
      fila.id !== null &&
      fila.orden !== null &&
      fila.titulo !== null &&
      fila.tipo !== null
    ) {
      modulo.lecciones.push({
        id: fila.id,
        orden: fila.orden,
        titulo: fila.titulo,
        tipo: fila.tipo,

        minutos: Math.round(
          (fila.segundos ?? 0) / 60,
        ),
      });
    }
  }

  return modulos;
}

export const cursosService = {
  ...cursosIntegracionService,

  async listarMisCursos(usuario: UsuarioSesion) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    const items =
      await cursosIntegracionRepository.listarDelDocente(
        usuario.idPersona,
      );

    return { items };
  },

  async obtenerMiCurso(
    id: number,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async (cliente) => {
      const base =
        await cursosIntegracionRepository.base(cliente, id);

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      if (
        base.idPersonaDocente !== usuario.idPersona ||
        !base.docenteActivo
      ) {
        throw AppError.sinPermiso(
          'No tienes permiso para consultar este curso.',
        );
      }

      return cursosService.detallePrivado(cliente, id);
    });
  },

  async crearCurso(
    datos: DatosCurso,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async (cliente) => {
      const idDocente =
        await cursosIntegracionRepository.docentePorPersona(
          cliente,
          usuario.idPersona,
        );

      if (idDocente === null) {
        throw AppError.sinPermiso(
          'No tienes un perfil docente activo.',
        );
      }

      const categoriaActiva =
        await cursosIntegracionRepository.categoriaActiva(
          cliente,
          datos.categoriaId,
        );

      if (!categoriaActiva) {
        throw AppError.solicitudInvalida(
          'Selecciona una categoría existente y activa.',
          [{
            campo: 'categoriaId',
            mensaje: 'La categoría no existe o está inactiva.',
          }],
        );
      }

      const idCurso =
        await cursosIntegracionRepository.crearBorrador(
          cliente,
          idDocente,
          datos,
        );

      return cursosService.detallePrivado(
        cliente,
        idCurso,
      );
    });
  },

  async actualizarMiCurso(
    idCurso: number,
    datos: DatosCurso,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async (cliente) => {
      const base =
        await cursosIntegracionRepository.base(
          cliente,
          idCurso,
          true,
        );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      if (
        base.idPersonaDocente !== usuario.idPersona ||
        !base.docenteActivo
      ) {
        throw AppError.sinPermiso(
          'No puedes editar este curso.',
        );
      }

      if (
        base.estado !== 'BORRADOR' &&
        base.estado !== 'RECHAZADO'
      ) {
        throw AppError.conflicto(
          'El curso no permite modificaciones.',
          'CURSO_BLOQUEADO',
        );
      }

      const categoriaValida =
        await cursosIntegracionRepository.categoriaActiva(
          cliente,
          datos.categoriaId,
        );

      if (!categoriaValida) {
        throw AppError.solicitudInvalida(
          'Selecciona una categoría activa.',
          [{
            campo: 'categoriaId',
            mensaje: 'La categoría no existe o está inactiva.',
          }],
        );
      }

      await cursosIntegracionRepository.actualizarCurso(
        cliente,
        idCurso,
        datos,
      );

      return cursosService.detallePrivado(
        cliente,
        idCurso,
      );
    });
  },

    async crearModulo(
    idCurso: number,
    datos: DatosModulo,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async (cliente) => {
      // Bloquear el curso durante toda la operación.
      const base =
        await cursosIntegracionRepository.base(
          cliente,
          idCurso,
          true,
        );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      if (
        base.idPersonaDocente !== usuario.idPersona ||
        !base.docenteActivo
      ) {
        throw AppError.sinPermiso(
          'No puedes modificar este curso.',
        );
      }

      if (
        base.estado !== 'BORRADOR' &&
        base.estado !== 'RECHAZADO'
      ) {
        throw AppError.conflicto(
          'Este curso no permite modificaciones.',
          'CURSO_BLOQUEADO',
        );
      }

      const cantidad =
        await cursosIntegracionRepository.contarModulos(
          cliente,
          idCurso,
        );

      if (cantidad >= 10) {
        throw AppError.solicitudInvalida(
          'Un curso puede tener como máximo 10 módulos.',
          [{
            campo: 'modulos',
            mensaje: 'Se alcanzó el límite de módulos.',
          }],
        );
      }

      const ocupado =
        await cursosIntegracionRepository.ordenModuloOcupado(
          cliente,
          idCurso,
          datos.orden,
        );

      if (ocupado) {
        throw AppError.solicitudInvalida(
          'El orden del módulo ya está ocupado.',
          [{
            campo: 'orden',
            mensaje: 'Selecciona un orden disponible.',
          }],
        );
      }

      await cursosIntegracionRepository.crearModulo(
        cliente,
        idCurso,
        datos,
      );

      return cursosService.detallePrivado(
        cliente,
        idCurso,
      );
    });
  },

  async actualizarModulo(
  idModulo: number,
  datos: DatosModulo,
  usuario: UsuarioSesion,
) {
  if (!usuario.roles.includes('DOCENTE')) {
    throw AppError.sinPermiso();
  }

  return enTransaccion(async (cliente) => {
    const modulo =
      await cursosIntegracionRepository.buscarModulo(
        cliente,
        idModulo,
      );

    if (!modulo) {
      throw AppError.noEncontrado(
        'Módulo no disponible.',
      );
    }

    const base =
      await cursosIntegracionRepository.base(
        cliente,
        modulo.idCurso,
        true,
      );

    if (!base) {
      throw AppError.noEncontrado(
        'Curso no disponible.',
      );
    }

    if (
      base.idPersonaDocente !== usuario.idPersona ||
      !base.docenteActivo
    ) {
      throw AppError.sinPermiso(
        'No puedes modificar este módulo.',
      );
    }

    if (
      base.estado !== 'BORRADOR' &&
      base.estado !== 'RECHAZADO'
    ) {
      throw AppError.conflicto(
        'El curso está bloqueado.',
        'CURSO_BLOQUEADO',
      );
    }

    // La búsqueda inicial solo localiza el curso que debemos bloquear.
    // Repetimos la lectura con el bloqueo adquirido por si lo eliminaron.
    const moduloActual =
      await cursosIntegracionRepository.buscarModulo(
        cliente,
        idModulo,
      );

    if (!moduloActual || moduloActual.idCurso !== base.id) {
      throw AppError.noEncontrado(
        'Módulo no disponible.',
      );
    }

    const ocupado =
      await cursosIntegracionRepository.ordenModuloOcupado(
        cliente,
        base.id,
        datos.orden,
        idModulo,
      );

    if (ocupado) {
      throw AppError.solicitudInvalida(
        'El orden del módulo ya está ocupado.',
        [{
          campo: 'orden',
          mensaje: 'Selecciona otro orden.',
        }],
      );
    }

    const actualizado =
      await cursosIntegracionRepository.actualizarModulo(
        cliente,
        idModulo,
        base.id,
        datos.titulo,
        datos.orden,
      );

    if (!actualizado) {
      throw AppError.noEncontrado(
        'Módulo no disponible.',
      );
    }

    return cursosService.detallePrivado(
      cliente,
      modulo.idCurso,
    );
  });
},

  async crearLeccion(
    idModulo: number,
    datos: DatosLeccion,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async (cliente) => {
      const modulo =
        await cursosIntegracionRepository.buscarModulo(
          cliente,
          idModulo,
        );

      if (!modulo) {
        throw AppError.noEncontrado(
          'Módulo no disponible.',
        );
      }

      const base =
        await cursosIntegracionRepository.base(
          cliente,
          modulo.idCurso,
          true,
        );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      if (
        base.idPersonaDocente !== usuario.idPersona ||
        !base.docenteActivo
      ) {
        throw AppError.sinPermiso(
          'No puedes modificar este curso.',
        );
      }

      if (
        base.estado !== 'BORRADOR' &&
        base.estado !== 'RECHAZADO'
      ) {
        throw AppError.conflicto(
          'El curso no permite modificaciones.',
          'CURSO_BLOQUEADO',
        );
      }

      const cantidad =
        await cursosIntegracionRepository.contarLecciones(
          cliente,
          idModulo,
        );

      if (cantidad >= 12) {
        throw AppError.solicitudInvalida(
          'Un módulo admite como máximo 12 lecciones.',
          [{
            campo: 'lecciones',
            mensaje: 'Se alcanzó el límite de lecciones.',
          }],
        );
      }

      const ocupado =
        await cursosIntegracionRepository.ordenLeccionOcupado(
          cliente,
          idModulo,
          datos.orden,
        );

      if (ocupado) {
        throw AppError.solicitudInvalida(
          'El orden de la lección ya está ocupado.',
          [{
            campo: 'orden',
            mensaje: 'Selecciona un orden disponible.',
          }],
        );
      }

      await cursosIntegracionRepository.crearLeccion(
        cliente,
        idModulo,
        datos,
      );

      return cursosService.detallePrivado(
        cliente,
        modulo.idCurso,
      );
    });
  },

  async actualizarLeccion(
  idLeccion: number,
  datos: DatosLeccion,
  usuario: UsuarioSesion,
) {
  if (!usuario.roles.includes('DOCENTE')) {
    throw AppError.sinPermiso();
  }

  return enTransaccion(async cliente => {
    const leccion =
      await cursosIntegracionRepository.buscarLeccionParaEditar(
        cliente,
        idLeccion,
      );

    if (!leccion) {
      throw AppError.noEncontrado(
        'Lección no disponible.',
      );
    }

    // Bloquear el curso, igual que las demás escrituras.
    const base =
      await cursosIntegracionRepository.base(
        cliente,
        leccion.idCurso,
        true,
      );

    if (!base) {
      throw AppError.noEncontrado(
        'Curso no disponible.',
      );
    }

    if (
      base.idPersonaDocente !== usuario.idPersona ||
      !base.docenteActivo
    ) {
      throw AppError.sinPermiso(
        'No puedes modificar esta lección.',
      );
    }

    if (
      base.estado !== 'BORRADOR' &&
      base.estado !== 'RECHAZADO'
    ) {
      throw AppError.conflicto(
        'El curso no permite modificaciones.',
        'CURSO_BLOQUEADO',
      );
    }

    if (leccion.tipo !== 'DOCUMENTO') {
      throw AppError.solicitudInvalida(
        'En este sprint solo se editan lecciones DOCUMENTO.',
      );
    }

    const ocupado =
      await cursosIntegracionRepository.ordenLeccionOcupado(
        cliente,
        leccion.idModulo,
        datos.orden,
        idLeccion,
      );

    if (ocupado) {
      throw AppError.solicitudInvalida(
        'El orden de la lección ya está ocupado.',
        [{
          campo: 'orden',
          mensaje: 'Selecciona otro orden.',
        }],
      );
    }

    const actualizado =
      await cursosIntegracionRepository.actualizarLeccion(
        cliente,
        idLeccion,
        leccion.idModulo,
        datos,
      );

    if (!actualizado) {
      throw AppError.noEncontrado(
        'Lección no disponible.',
      );
    }

    return cursosService.detallePrivado(
      cliente,
      leccion.idCurso,
    );
  });
},

  async eliminarLeccion(
    idLeccion: number,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    const resultado = await enTransaccion(
      async cliente => {
        const leccion =
          await cursosIntegracionRepository
            .buscarLeccionParaEditar(
              cliente,
              idLeccion,
            );

        if (!leccion) {
          throw AppError.noEncontrado(
            'Lección no disponible.',
          );
        }

        // Bloquear el curso antes de modificar contenido.
        const base =
          await cursosIntegracionRepository.base(
            cliente,
            leccion.idCurso,
            true,
          );

        if (!base) {
          throw AppError.noEncontrado(
            'Curso no disponible.',
          );
        }

        if (
          base.idPersonaDocente !== usuario.idPersona ||
          !base.docenteActivo
        ) {
          throw AppError.sinPermiso(
            'No puedes eliminar esta lección.',
          );
        }

        if (
          base.estado !== 'BORRADOR' &&
          base.estado !== 'RECHAZADO'
        ) {
          throw AppError.conflicto(
            'El curso no permite modificaciones.',
            'CURSO_BLOQUEADO',
          );
        }

        const idsPdf =
          await cursosIntegracionRepository.pdfDeLeccion(
            cliente,
            idLeccion,
          );

        const eliminada =
          await cursosIntegracionRepository.eliminarLeccion(
            cliente,
            idLeccion,
            leccion.idModulo,
          );

        if (!eliminada) {
          throw AppError.noEncontrado(
            'Lección no disponible.',
          );
        }

        await limpiezaPdfService.retirarPdfSinUso(
          cliente,
          leccion.idCurso,
          idsPdf,
        );

        return cursosService.detallePrivado(
          cliente,
          leccion.idCurso,
        );
      },
    );

    // La eliminación física ocurre después del COMMIT.
    try {
      await limpiezaPdfService.limpiarPendientes();
    } catch {
      registrarEvento(
        'archivo.limpieza_reintentar',
        {},
        'aviso',
      );
    }

    return resultado;
  },

  async eliminarModulo(
    idModulo: number,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    const resultado = await enTransaccion(
      async (cliente) => {
        const modulo =
          await cursosIntegracionRepository.buscarModulo(
            cliente,
            idModulo,
          );

        if (!modulo) {
          throw AppError.noEncontrado(
            'Módulo no disponible.',
          );
        }

        const base =
          await cursosIntegracionRepository.base(
            cliente,
            modulo.idCurso,
            true,
          );

        if (!base) {
          throw AppError.noEncontrado(
            'Curso no disponible.',
          );
        }

        if (
          base.idPersonaDocente !== usuario.idPersona ||
          !base.docenteActivo
        ) {
          throw AppError.sinPermiso(
            'No puedes eliminar este módulo.',
          );
        }

        if (
          base.estado !== 'BORRADOR' &&
          base.estado !== 'RECHAZADO'
        ) {
          throw AppError.conflicto(
            'El curso está bloqueado.',
            'CURSO_BLOQUEADO',
          );
        }

        const idsPdf =
          await cursosIntegracionRepository.pdfDeModulo(
            cliente,
            idModulo,
          );

        const eliminado =
          await cursosIntegracionRepository.eliminarModulo(
            cliente,
            idModulo,
            modulo.idCurso,
          );

        if (!eliminado) {
          throw AppError.noEncontrado(
            'Módulo no disponible.',
          );
        }

        await limpiezaPdfService.retirarPdfSinUso(
          cliente,
          modulo.idCurso,
          idsPdf,
        );

        return cursosService.detallePrivado(
          cliente,
          modulo.idCurso,
        );
      },
    );

    // Limpieza física después del COMMIT.
    try {
      await limpiezaPdfService.limpiarPendientes();
    } catch {
      registrarEvento(
        'archivo.limpieza_reintentar',
        {},
        'aviso',
      );
    }

    return resultado;
  },

  async enviarCursoARevision(
    idCurso: number,
    usuario: UsuarioSesion,
  ) {
    if (!usuario.roles.includes('DOCENTE')) {
      throw AppError.sinPermiso();
    }

    return enTransaccion(async cliente => {
      // Bloquear la fila del curso.
      const base =
        await cursosIntegracionRepository.base(
          cliente,
          idCurso,
          true,
        );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      // Verificar al propietario real.
      if (
        base.idPersonaDocente !== usuario.idPersona ||
        !base.docenteActivo
      ) {
        throw AppError.sinPermiso(
          'No puedes enviar este curso a revisión.',
        );
      }

      // Comprobar el estado actual.
      if (
        base.estado !== 'BORRADOR' &&
        base.estado !== 'RECHAZADO'
      ) {
        throw AppError.conflicto(
          'Este curso ya no puede enviarse a revisión.',
          'CURSO_BLOQUEADO',
        );
      }

      // Revalidar todo el contenido guardado.
      const detalle =
        await cursosService.detallePrivado(
          cliente,
          idCurso,
        );

      if (!detalle.validacion.completo) {
        throw AppError.solicitudInvalida(
          'El curso todavía está incompleto.',
          detalle.validacion.problemas,
        );
      }

      // Cambiar el estado dentro de la transacción.
      const actualizado =
        await cursosIntegracionRepository.enviarARevision(
          cliente,
          idCurso,
        );

      if (!actualizado) {
        throw AppError.conflicto(
          'No se pudo enviar el curso a revisión.',
        );
      }

      // Devolver CursoDetalle actualizado.
      return cursosService.detallePrivado(
        cliente,
        idCurso,
      );
    });
  },

  categoriasPublicas: () =>
    cursosRepository.categoriasPublicas(),

  async catalogoPublico(
    filtros: FiltrosPublicos,
  ) {
    const { filas, total } =
      await cursosRepository.catalogoPublico(
        filtros,
      );

    return {
      items: filas.map(cursoPublico),
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,

      totalPaginas: Math.ceil(
        total / filtros.limite,
      ),
    };
  },

  async detallePublico(id: number) {
    const fila =
      await cursosRepository.detallePublico(id);

    if (!fila) {
      throw AppError.noEncontrado(
        'Curso no disponible.',
      );
    }

    const temario =
      await cursosRepository.temarioPublico(id);

    return {
      ...cursoPublico(fila),

      descripcion: fila.descripcion,
      docenteBio: fila.docenteBio,
      objetivos: fila.objetivos,
      requisitos: fila.requisitos,

      temario: ordenarTemario(temario),
    };
  },
};