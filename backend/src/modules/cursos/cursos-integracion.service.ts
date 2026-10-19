import type { PoolClient } from 'pg';

import type {
  Rol,
  UsuarioSesion,
} from '../../shared/auth/tipos.js';

import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { almacenLocal } from '../../shared/archivos/almacen.js';

import {
  cursosIntegracionRepository as repo,
} from './cursos-integracion.repository.js';

import type {
  ContextoLeccion,
  CursoDetalle,
  DecisionRevision,
  ModuloPrivado,
  ProblemaCurso,
} from './cursos-privados.model.js';

function exigirRol(
  usuario: UsuarioSesion,
  rol: Rol,
): void {
  if (!usuario.roles.includes(rol)) {
    throw AppError.sinPermiso();
  }
}

function exigirEdicion(
  contexto: ContextoLeccion,
  usuario: UsuarioSesion,
): void {
  exigirRol(usuario, 'DOCENTE');

  if (
    contexto.idPersonaDocente !== usuario.idPersona ||
    !contexto.docenteActivo
  ) {
    throw AppError.sinPermiso(
      'No puedes modificar esta lección.',
    );
  }

  if (
    !['BORRADOR', 'RECHAZADO'].includes(
      contexto.estado,
    )
  ) {
    throw AppError.conflicto(
      'El curso ya no permite cambios. Actualiza su estado.',
      'CURSO_BLOQUEADO',
    );
  }

  if (contexto.tipoLeccion !== 'DOCUMENTO') {
    throw AppError.solicitudInvalida(
      'Solo las lecciones DOCUMENTO admiten este PDF.',
    );
  }
}

function portadaValida(valor: string): boolean {
  if (
    valor.startsWith('/') &&
    !valor.startsWith('//') &&
    !valor.includes('\\')
  ) {
    return true;
  }

  try {
    return ['http:', 'https:'].includes(
      new URL(valor).protocol,
    );
  } catch {
    return false;
  }
}

export function comprobarCompletitud(
  c: CursoDetalle,
  categoriaActiva: boolean,
  pdfValidos: Set<number>,
): ProblemaCurso[] {
  const problemas: ProblemaCurso[] = [];

  const agregar = (
    campo: string,
    mensaje: string,
  ) => problemas.push({ campo, mensaje });

  const texto = (
    valor: string,
    maximo: number,
  ) => !!valor.trim() && valor.length <= maximo;

  if (!texto(c.titulo, 150)) {
    agregar(
      'titulo',
      'Completa un título de hasta 150 caracteres.',
    );
  }

  if (!texto(c.subtitulo, 200)) {
    agregar(
      'subtitulo',
      'Completa un subtítulo de hasta 200 caracteres.',
    );
  }

  if (!texto(c.descripcion, 10000)) {
    agregar(
      'descripcion',
      'Completa la descripción de hasta 10 000 caracteres.',
    );
  }

  if (!categoriaActiva) {
    agregar(
      'categoriaId',
      'Selecciona una categoría activa.',
    );
  }

  if (
    ![
      'PRINCIPIANTE',
      'INTERMEDIO',
      'AVANZADO',
    ].includes(c.nivel)
  ) {
    agregar(
      'nivel',
      'Selecciona un nivel válido.',
    );
  }

  if (
    !c.portadaUrl ||
    c.portadaUrl.length > 255 ||
    !portadaValida(c.portadaUrl)
  ) {
    agregar(
      'portadaUrl',
      'Indica una portada válida.',
    );
  }

  if (
    c.objetivos.length < 3 ||
    c.objetivos.length > 10 ||
    c.objetivos.some(v => !texto(v, 200))
  ) {
    agregar(
      'objetivos',
      'Indica entre 3 y 10 objetivos de hasta 200 caracteres.',
    );
  }

  if (
    c.requisitos.length > 10 ||
    c.requisitos.some(v => !texto(v, 200))
  ) {
    agregar(
      'requisitos',
      'Usa como máximo 10 requisitos de hasta 200 caracteres.',
    );
  }

  if (
    c.modulos.length < 1 ||
    c.modulos.length > 10
  ) {
    agregar(
      'modulos',
      'El curso requiere entre 1 y 10 módulos.',
    );
  }

  const ordenesModulos = new Set<number>();

  let documentos = 0;

  for (const [i, m] of c.modulos.entries()) {
    const campo = 'modulos.' + i;

    if (!texto(m.titulo, 150)) {
      agregar(
        campo + '.titulo',
        'Completa el título del módulo.',
      );
    }

    if (
      !Number.isInteger(m.orden) ||
      m.orden < 1 ||
      m.orden > 10 ||
      ordenesModulos.has(m.orden)
    ) {
      agregar(
        campo + '.orden',
        'Revisa el orden del módulo.',
      );
    }

    ordenesModulos.add(m.orden);

    if (
      m.lecciones.length < 1 ||
      m.lecciones.length > 12
    ) {
      agregar(
        campo + '.lecciones',
        'Cada módulo requiere entre 1 y 12 lecciones.',
      );
    }

    const ordenes = new Set<number>();

    for (const [j, l] of m.lecciones.entries()) {
      const prefijo =
        campo + '.lecciones.' + j;

      if (!texto(l.titulo, 150)) {
        agregar(
          prefijo + '.titulo',
          'Completa el título de la lección.',
        );
      }

      if (
        !Number.isInteger(l.orden) ||
        l.orden < 1 ||
        l.orden > 12 ||
        ordenes.has(l.orden)
      ) {
        agregar(
          prefijo + '.orden',
          'Revisa el orden de la lección.',
        );
      }

      ordenes.add(l.orden);

      if (l.tipo === 'DOCUMENTO') {
        documentos++;

        if (
          !l.archivo ||
          !pdfValidos.has(l.archivo.id)
        ) {
          agregar(
            prefijo + '.archivo',
            'Sube un PDF válido para ' +
              l.titulo +
              '.',
          );
        }
      }
    }
  }

  if (!documentos) {
    agregar(
      'modulos',
      'Agrega al menos una lección DOCUMENTO con PDF válido.',
    );
  }

  return problemas;
}

async function detallePrivado(
  cliente: PoolClient,
  id: number,
): Promise<CursoDetalle> {
  const base = await repo.base(cliente, id);

  if (!base) {
    throw AppError.noEncontrado(
      'Curso no disponible.',
    );
  }

  const filas = await repo.temario(cliente, id);

  const modulos: ModuloPrivado[] = [];
  const pdfValidos = new Set<number>();

  for (const fila of filas) {
    let modulo = modulos.at(-1);

    if (modulo?.id !== fila.moduloId) {
      modulo = {
        id: fila.moduloId,
        titulo: fila.moduloTitulo,
        orden: fila.moduloOrden,
        lecciones: [],
      };

      modulos.push(modulo);
    }

    if (
      fila.leccionId === null ||
      fila.leccionTipo === null
    ) {
      continue;
    }

    const archivo =
      fila.archivoTipo === 'PDF' &&
      fila.archivoId !== null
        ? {
            id: fila.archivoId,
            tipo: 'PDF' as const,
            nombreOriginal: fila.archivoNombre!,
            tamanoBytes: fila.archivoTamano!,
          }
        : null;

    modulo.lecciones.push({
      id: fila.leccionId,
      titulo: fila.leccionTitulo!,
      orden: fila.leccionOrden!,
      tipo: fila.leccionTipo,
      archivo,
    });

    if (
      fila.leccionTipo === 'DOCUMENTO' &&
      archivo &&
      fila.archivoRuta &&
      await almacenLocal.existeYCoincide(
        fila.archivoRuta,
        archivo.tamanoBytes,
      )
    ) {
      pdfValidos.add(archivo.id);
    }
  }

  const c: CursoDetalle = {
    id: base.id,
    titulo: base.titulo,
    subtitulo: base.subtitulo,
    descripcion: base.descripcion,

    categoriaId: base.categoriaId,
    categoriaNombre: base.categoriaNombre,

    nivel: base.nivel,
    portadaUrl: base.portadaUrl,

    objetivos: base.objetivos ?? [],
    requisitos: base.requisitos ?? [],

    estado: base.estado,
    motivoRechazo: base.motivoRechazo,
    docente: base.docente,

    modulos,

    validacion: {
      completo: false,
      problemas: [],
    },
  };

  c.validacion.problemas =
    comprobarCompletitud(
      c,
      base.categoriaActiva,
      pdfValidos,
    );

  if (!base.docenteActivo) {
    c.validacion.problemas.push({
      campo: 'docente',
      mensaje: 'El docente no está activo.',
    });
  }

  c.validacion.completo =
    c.validacion.problemas.length === 0;

  return c;
}

export const cursosIntegracionService = {
  detallePrivado,

  async listarParaRevision(
    usuario: UsuarioSesion,
  ) {
    exigirRol(usuario, 'ADMIN');

    return {
      items: await repo.pendientes(),
    };
  },

  async detalleParaRevision(
    id: number,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    exigirRol(usuario, 'ADMIN');

    return enTransaccion(async cliente => {
      const base = await repo.base(
        cliente,
        id,
        true,
      );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      return detallePrivado(cliente, id);
    });
  },

  async verificarCarga(
    id: number,
    usuario: UsuarioSesion,
  ): Promise<void> {
    await enTransaccion(async cliente => {
      const contexto = await repo.leccion(
        cliente,
        id,
      );

      if (!contexto) {
        throw AppError.noEncontrado(
          'Lección no disponible.',
        );
      }

      exigirEdicion(contexto, usuario);
    });
  },

  async conLeccionEditable<T>(
    id: number,
    usuario: UsuarioSesion,
    trabajo: (
      contexto: ContextoLeccion,
      cliente: PoolClient,
    ) => Promise<T>,
  ): Promise<T> {
    return enTransaccion(async cliente => {
      const contexto = await repo.leccion(
        cliente,
        id,
        true,
      );

      if (!contexto) {
        throw AppError.noEncontrado(
          'Lección no disponible.',
        );
      }

      exigirEdicion(contexto, usuario);

      return trabajo(contexto, cliente);
    });
  },

  async asociarPdfPrincipal(
    cliente: PoolClient,
    contexto: ContextoLeccion,
    archivoId: number,
  ): Promise<void> {
    const asociado = await repo.asociarPdf(
      cliente,
      contexto,
      archivoId,
    );

    if (!asociado) {
      throw AppError.conflicto(
        'No se pudo asociar el PDF a esta lección.',
      );
    }
  },

  async autorizarLectura(
    idLeccion: number,
    idCursoArchivo: number,
    usuario: UsuarioSesion,
  ): Promise<void> {
    await enTransaccion(async cliente => {
      const contexto = await repo.leccion(
        cliente,
        idLeccion,
      );

      if (
        !contexto ||
        contexto.id !== idCursoArchivo
      ) {
        throw AppError.noEncontrado(
          'Archivo no disponible.',
        );
      }

      const admin =
        usuario.roles.includes('ADMIN');

      const propietario =
        usuario.roles.includes('DOCENTE') &&
        contexto.idPersonaDocente ===
          usuario.idPersona;

      if (!admin && !propietario) {
        throw AppError.sinPermiso(
          'No puedes descargar este archivo.',
        );
      }
    });
  },

  async decidirRevision(
    id: number,
    decision: DecisionRevision,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    exigirRol(usuario, 'ADMIN');

    if (
      decision.decision === 'RECHAZAR' &&
      (
        !decision.motivo.trim() ||
        decision.motivo.trim().length > 300
      )
    ) {
      throw AppError.solicitudInvalida(
        'Indica un motivo de entre 1 y 300 caracteres.',
        [
          {
            campo: 'motivo',
            mensaje:
              'Indica un motivo de entre 1 y 300 caracteres.',
          },
        ],
      );
    }

    return enTransaccion(async cliente => {
      const base = await repo.base(
        cliente,
        id,
        true,
      );

      if (!base) {
        throw AppError.noEncontrado(
          'Curso no disponible.',
        );
      }

      if (base.estado !== 'EN_REVISION') {
        throw AppError.conflicto(
          'Este curso ya no está pendiente de revisión.',
        );
      }

      const detalle = await detallePrivado(
        cliente,
        id,
      );

      if (
        decision.decision === 'APROBAR' &&
        !detalle.validacion.completo
      ) {
        throw new AppError(
          409,
          'El curso dejó de cumplir la validación. Actualiza su contenido.',
          'CURSO_INCOMPLETO',
          detalle.validacion.problemas,
        );
      }

      const estado =
        decision.decision === 'APROBAR'
          ? 'PUBLICADO'
          : 'RECHAZADO';

      const motivo =
        decision.decision === 'RECHAZAR'
          ? decision.motivo.trim()
          : null;

      const decidido = await repo.decidir(
        cliente,
        id,
        estado,
        motivo,
        usuario.idPersona,
      );

      if (!decidido) {
        throw AppError.conflicto(
          'Otro administrador ya decidió este curso.',
        );
      }

      return {
        ...detalle,
        estado,
        motivoRechazo: motivo,
      };
    });
  },
};