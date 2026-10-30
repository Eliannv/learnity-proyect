import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { almacenLocal } from '../../shared/archivos/almacen.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { aprendizajeApi } from '../aprendizaje/index.js';
import { esPortadaValida } from './cursos.esquemas.js';
import {
  MAX_RECURSOS_LECCION,
  type ContextoLeccion,
  type CursoDetalle,
  type DecisionRevision,
  type EstadoRevision,
  type ModuloPrivado,
  type ProblemaCurso,
} from './cursos.modelo.js';
import { fichaRepository } from './ficha.repository.js';
import { MENSAJES, politicaCurso } from './politica-curso.js';
import { MAX_PREGUNTAS, MIN_PREGUNTAS } from './temario/temario.esquemas.js';
import { temarioRepository } from './temario/temario.repository.js';

/** El PDF es el contenido de un DOCUMENTO o el material de apoyo de un VIDEO. */
const TIPOS_CON_PDF: ReadonlySet<string> = new Set(['DOCUMENTO', 'VIDEO']);

function exigirEdicionLeccion(contexto: ContextoLeccion, usuario: UsuarioSesion): void {
  politicaCurso.exigirRol(usuario, 'DOCENTE');
  politicaCurso.exigirEditable(contexto, usuario, MENSAJES.archivoDeLeccion);

  if (!TIPOS_CON_PDF.has(contexto.tipoLeccion)) {
    throw AppError.solicitudInvalida('Solo las lecciones DOCUMENTO o VIDEO admiten este PDF.');
  }
}

const leccionDisponible = (l: CursoDetalle['modulos'][number]['lecciones'][number]): boolean =>
  (l.tipo === 'VIDEO' && !!l.youtubeVideoId) || (l.tipo === 'DOCUMENTO' && l.archivo !== null)
  || (l.tipo === 'EVALUACION' && l.preguntas >= MIN_PREGUNTAS);

/** Lo que un curso publicado no puede perder: su ficha completa y al menos un contenido disponible. */
function problemasDePublicado(c: CursoDetalle): ProblemaCurso[] {
  // Un módulo vacío o un PDF pendiente no bloquean: el estudiante no los ve hasta que estén listos.
  const problemas = c.validacion.problemas.filter((p) => !p.campo.startsWith('modulos.'));
  if (!c.modulos.some((m) => m.lecciones.some(leccionDisponible))) {
    problemas.push({ campo: 'modulos', mensaje: 'Un curso publicado debe conservar al menos un contenido disponible.' });
  }
  return problemas;
}

/** Problemas del curso publicado ANTES del cambio; null si el curso no está publicado. */
export async function vigenciaPrevia(
  cliente: PoolClient,
  estado: CursoDetalle['estado'],
  idCurso: number,
  prevalidados?: ReadonlySet<string>,
): Promise<ProblemaCurso[] | null> {
  return estado === 'PUBLICADO' ? problemasDePublicado(await detallePrivado(cliente, idCurso, prevalidados)) : null;
}

/**
 * Editar un curso publicado no lo devuelve a revisión, pero el cambio se rechaza (y la transacción
 * se deshace) si añade un problema que lo dejaría incompleto para sus estudiantes.
 */
export function exigirVigencia(previos: ProblemaCurso[] | null, despues: CursoDetalle): CursoDetalle {
  if (previos === null) return despues;
  const clave = (p: ProblemaCurso) => `${p.campo}\n${p.mensaje}`;
  const conocidos = new Set(previos.map(clave));
  const nuevos = problemasDePublicado(despues).filter((p) => !conocidos.has(clave(p)));
  if (nuevos.length > 0) {
    throw AppError.solicitudInvalida('El curso está publicado: este cambio lo dejaría incompleto para los estudiantes.', nuevos);
  }
  return despues;
}

/**
 * Comprueba en disco los PDF del curso ANTES de abrir una sección con `FOR UPDATE` (PLANTILLA_MODULO §2, R4/A5).
 * Devuelve claves `${id}:${ruta}:${tamano}` para que `detallePrivado` no lea del disco con filas bloqueadas.
 */
export async function prevalidarPdfCurso(idCurso: number): Promise<ReadonlySet<string>> {
  const archivos = await temarioRepository.archivosPdfDelCurso(idCurso);
  const validos = new Set<string>();
  for (const a of archivos) {
    if (await almacenLocal.existeYCoincide(a.ruta, a.tamano)) {
      validos.add(`${a.id}:${a.ruta}:${a.tamano}`);
    }
  }
  return validos;
}

export function comprobarCompletitud(
  c: CursoDetalle,
  categoriaActiva: boolean,
  pdfValidos: Set<number>,
): ProblemaCurso[] {
  const problemas: ProblemaCurso[] = [];

  const agregar = (campo: string, mensaje: string) => problemas.push({ campo, mensaje });
  const texto = (valor: string, maximo: number) => !!valor.trim() && valor.length <= maximo;

  if (!texto(c.titulo, 150)) {
    agregar('titulo', 'Completa un título de hasta 150 caracteres.');
  }
  if (!texto(c.subtitulo, 200)) {
    agregar('subtitulo', 'Completa un subtítulo de hasta 200 caracteres.');
  }
  if (!texto(c.descripcion, 10000)) {
    agregar('descripcion', 'Completa la descripción de hasta 10 000 caracteres.');
  }
  if (!categoriaActiva) {
    agregar('categoriaId', 'Selecciona una categoría activa.');
  }
  if (!['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'].includes(c.nivel)) {
    agregar('nivel', 'Selecciona un nivel válido.');
  }
  if (!esPortadaValida(c.portadaUrl)) {
    agregar('portadaUrl', 'Indica una portada válida.');
  }
  if (
    c.objetivos.length < 3 ||
    c.objetivos.length > 10 ||
    c.objetivos.some((v) => !texto(v, 200))
  ) {
    agregar('objetivos', 'Indica entre 3 y 10 objetivos de hasta 200 caracteres.');
  }
  if (c.requisitos.length > 10 || c.requisitos.some((v) => !texto(v, 200))) {
    agregar('requisitos', 'Usa como máximo 10 requisitos de hasta 200 caracteres.');
  }
  if (c.modulos.length < 1 || c.modulos.length > 10) {
    agregar('modulos', 'El curso requiere entre 1 y 10 módulos.');
  }

  const ordenesModulos = new Set<number>();

  for (const [i, m] of c.modulos.entries()) {
    const campo = 'modulos.' + i;

    if (!texto(m.titulo, 150)) {
      agregar(campo + '.titulo', 'Completa el título del módulo.');
    }
    if (!Number.isInteger(m.orden) || m.orden < 1 || m.orden > 10 || ordenesModulos.has(m.orden)) {
      agregar(campo + '.orden', 'Revisa el orden del módulo.');
    }
    ordenesModulos.add(m.orden);

    if (m.lecciones.length < 1 || m.lecciones.length > 12) {
      agregar(campo + '.lecciones', 'Cada módulo requiere entre 1 y 12 lecciones.');
    }

    const ordenes = new Set<number>();
    for (const [j, l] of m.lecciones.entries()) {
      const prefijo = campo + '.lecciones.' + j;

      if (!texto(l.titulo, 150)) {
        agregar(prefijo + '.titulo', 'Completa el título de la lección.');
      }
      if (!Number.isInteger(l.orden) || l.orden < 1 || l.orden > 12 || ordenes.has(l.orden)) {
        agregar(prefijo + '.orden', 'Revisa el orden de la lección.');
      }
      ordenes.add(l.orden);

      if (l.tipo === 'DOCUMENTO') {
        if (!l.archivo || !pdfValidos.has(l.archivo.id)) {
          agregar(prefijo + '.archivo', 'Sube un PDF válido para ' + l.titulo + '.');
        }
      } else if (l.tipo === 'VIDEO' && !l.youtubeVideoId) {
        agregar(prefijo + '.youtubeUrl', 'Añade un enlace válido de YouTube para ' + l.titulo + '.');
      } else if (l.tipo === 'EVALUACION' && l.preguntas < MIN_PREGUNTAS) {
        agregar(prefijo + '.preguntas', `Añade entre ${MIN_PREGUNTAS} y ${MAX_PREGUNTAS} preguntas a ${l.titulo}.`);
      }
    }
  }

  return problemas;
}

export async function detallePrivado(
  cliente: PoolClient,
  id: number,
  prevalidados?: ReadonlySet<string>,
): Promise<CursoDetalle> {
  const base = await fichaRepository.base(cliente, id);
  if (!base) {
    throw AppError.noEncontrado('Curso no disponible.');
  }

  const filas = await temarioRepository.temario(cliente, id);
  const recursos = await temarioRepository.recursosDelCurso(cliente, id);
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

    if (fila.leccionId === null || fila.leccionTipo === null) {
      continue;
    }

    const archivo =
      fila.archivoTipo === 'PDF' && fila.archivoId !== null
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
      youtubeVideoId: fila.leccionTipo === 'VIDEO' ? fila.youtubeVideoId : null,
      preguntas: fila.leccionTipo === 'EVALUACION' ? fila.preguntas : 0,
      recursos: recursos.filter((r) => r.leccionId === fila.leccionId).map(({ leccionId: _, ...r }) => r),
    });

    if (fila.leccionTipo === 'DOCUMENTO' && archivo && fila.archivoRuta) {
      const clave = `${archivo.id}:${fila.archivoRuta}:${archivo.tamanoBytes}`;
      const valido = prevalidados
        ? prevalidados.has(clave)
        : await almacenLocal.existeYCoincide(fila.archivoRuta, archivo.tamanoBytes);
      if (valido) {
        pdfValidos.add(archivo.id);
      }
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
    suspension: base.suspendidoEn && base.motivoSuspension
      ? { suspendidoEn: base.suspendidoEn.toISOString(), motivo: base.motivoSuspension }
      : null,
    docente: base.docente,
    modulos,
    validacion: {
      completo: false,
      problemas: [],
    },
  };

  c.validacion.problemas = comprobarCompletitud(c, base.categoriaActiva, pdfValidos);
  if (!base.docenteActivo) {
    c.validacion.problemas.push({
      campo: 'docente',
      mensaje: 'El docente no está activo.',
    });
  }
  c.validacion.completo = c.validacion.problemas.length === 0;

  return c;
}

export const detallePrivadoService = {
  detallePrivado,

  async listarParaRevision(usuario: UsuarioSesion, estado: EstadoRevision = 'EN_REVISION') {
    politicaCurso.exigirRol(usuario, 'ADMIN');
    const [items, conteos] = await Promise.all([fichaRepository.listarParaRevision(estado), fichaRepository.conteosRevision()]);
    return { items, conteos };
  },

  /**
   * PUBLICADO → SUSPENDIDO (solo administradores). Sale del catálogo y sus inscritos no pueden abrirlo, pero conservan
   * su progreso (D2). El docente no puede editarlo mientras dure (SUSPENDIDO no es editable).
   */
  async suspender(id: number, motivo: string, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'ADMIN');
    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, id, true);
      if (!base) throw AppError.noEncontrado('Curso no disponible.');
      if (!politicaCurso.puedePasar(base.estado, 'SUSPENDIDO')) {
        throw AppError.conflicto('Solo se puede suspender un curso publicado. Actualiza la lista.', 'CURSO_NO_PUBLICADO');
      }
      if (!(await fichaRepository.suspender(cliente, id, motivo, usuario.idPersona))) {
        throw AppError.conflicto('Otro administrador cambió el estado de este curso. Actualiza la lista.');
      }
      return detallePrivado(cliente, id);
    }, { actor: usuario.idPersona });
  },

  /** SUSPENDIDO → PUBLICADO (solo administradores): vuelve al catálogo y sus inscritos recuperan el acceso. */
  async reactivar(id: number, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'ADMIN');
    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, id, true);
      if (!base) throw AppError.noEncontrado('Curso no disponible.');
      if (!politicaCurso.puedePasar(base.estado, 'PUBLICADO') || base.estado !== 'SUSPENDIDO') {
        throw AppError.conflicto('Este curso no está suspendido. Actualiza la lista.', 'CURSO_NO_SUSPENDIDO');
      }
      if (!(await fichaRepository.reactivar(cliente, id))) {
        throw AppError.conflicto('Otro administrador cambió el estado de este curso. Actualiza la lista.');
      }
      return detallePrivado(cliente, id);
    }, { actor: usuario.idPersona });
  },

  async detalleParaRevision(id: number, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'ADMIN');
    const prevalidados = await prevalidarPdfCurso(id);
    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, id);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      return detallePrivado(cliente, id, prevalidados);
    });
  },

  /** PDF del curso de una lección, comprobados en disco; se llama antes de `conLeccionEditable` (D-01). */
  async prevalidarPdfDeLeccion(idLeccion: number): Promise<ReadonlySet<string>> {
    const idCurso = await temarioRepository.idCursoDeLeccion(idLeccion);
    return idCurso === null ? new Set<string>() : prevalidarPdfCurso(idCurso);
  },

  async verificarCarga(id: number, usuario: UsuarioSesion): Promise<void> {
    await enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, id);
      if (!contexto) {
        throw AppError.noEncontrado('Lección no disponible.');
      }
      exigirEdicionLeccion(contexto, usuario);
    });
  },

  async conLeccionEditable<T>(
    id: number,
    usuario: UsuarioSesion,
    trabajo: (contexto: ContextoLeccion, cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    return enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, id, true);
      if (!contexto) {
        throw AppError.noEncontrado('Lección no disponible.');
      }
      exigirEdicionLeccion(contexto, usuario);
      return trabajo(contexto, cliente);
    }, { actor: usuario.idPersona });
  },

  /** Dentro de `conLeccionEditable`: añade el archivo ya guardado como recurso de la lección. */
  async asociarRecurso(
    cliente: PoolClient,
    contexto: ContextoLeccion,
    archivoId: number,
    titulo: string,
  ): Promise<void> {
    if (await temarioRepository.contarRecursos(cliente, contexto.leccionId) >= MAX_RECURSOS_LECCION) {
      throw AppError.solicitudInvalida(`Una lección admite como máximo ${MAX_RECURSOS_LECCION} recursos.`, [
        { campo: 'archivo', mensaje: 'Quita un recurso antes de subir otro.' },
      ]);
    }
    if (!(await temarioRepository.asociarRecurso(cliente, contexto, archivoId, titulo))) {
      throw AppError.conflicto('No se pudo asociar el recurso a esta lección.');
    }
  },

  async asociarPdfPrincipal(
    cliente: PoolClient,
    contexto: ContextoLeccion,
    archivoId: number,
  ): Promise<void> {
    const asociado = await temarioRepository.asociarPdf(cliente, contexto, archivoId);
    if (!asociado) {
      throw AppError.conflicto('No se pudo asociar el PDF a esta lección.');
    }
  },

  async autorizarLectura(
    idLeccion: number,
    idCursoArchivo: number,
    idArchivo: number,
    usuario: UsuarioSesion,
  ): Promise<void> {
    await enTransaccion(async (cliente) => {
      const contexto = await temarioRepository.leccion(cliente, idLeccion);
      // El archivo es el PDF principal de la lección o uno de sus recursos adjuntos.
      const deLaLeccion = !!contexto && contexto.id === idCursoArchivo && (
        contexto.archivoId === idArchivo || await temarioRepository.esRecursoDe(cliente, idLeccion, idArchivo)
      );
      if (!contexto || !deLaLeccion) {
        throw AppError.noEncontrado('Archivo no disponible.');
      }
      if (politicaCurso.puedeLeerArchivos(contexto, usuario)) return;
      const inscrito = usuario.roles.includes('ESTUDIANTE')
        && contexto.estado === 'PUBLICADO'
        && TIPOS_CON_PDF.has(contexto.tipoLeccion)
        && await aprendizajeApi.estaInscritoEnCurso(usuario.idPersona, contexto.id);
      if (!inscrito) throw AppError.sinPermiso('No puedes descargar este archivo.');
    });
  },

  async decidirRevision(
    id: number,
    decision: DecisionRevision,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'ADMIN');

    if (
      decision.decision === 'RECHAZAR' &&
      (!decision.motivo.trim() || decision.motivo.trim().length > 300)
    ) {
      throw AppError.solicitudInvalida('Indica un motivo de entre 1 y 300 caracteres.', [
        {
          campo: 'motivo',
          mensaje: 'Indica un motivo de entre 1 y 300 caracteres.',
        },
      ]);
    }

    // Lectura de disco fuera del bloqueo FOR UPDATE (R4/A5).
    const prevalidados = await prevalidarPdfCurso(id);

    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, id, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      if (base.estado !== 'EN_REVISION') {
        throw AppError.conflicto('Este curso ya no está pendiente de revisión.');
      }

      const detalle = await detallePrivado(cliente, id, prevalidados);

      if (decision.decision === 'APROBAR' && !detalle.validacion.completo) {
        throw new AppError(
          409,
          'El curso dejó de cumplir la validación. Actualiza su contenido.',
          'CURSO_INCOMPLETO',
          detalle.validacion.problemas,
        );
      }

      const estado = decision.decision === 'APROBAR' ? 'PUBLICADO' : 'RECHAZADO';
      const motivo = decision.decision === 'RECHAZAR' ? decision.motivo.trim() : null;

      const decidido = await fichaRepository.decidir(
        cliente,
        id,
        estado,
        motivo,
        usuario.idPersona,
      );

      if (!decidido) {
        throw AppError.conflicto('Otro administrador ya decidió este curso.');
      }

      return {
        ...detalle,
        estado,
        motivoRechazo: motivo,
      };
    }, { actor: usuario.idPersona });
  },
};
