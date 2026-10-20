// Política de estados del curso (ADR-003). Sin E/S: se prueba con node:test sin base de datos.
// Los textos de MENSAJES son contrato (403 y 409 CURSO_BLOQUEADO por operación): no se unifican sin un ADR.
import type { Rol, UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import type { ContextoCurso, EstadoCurso } from './cursos.modelo.js';

export const ESTADOS_EDITABLES: ReadonlySet<EstadoCurso> = new Set<EstadoCurso>(['BORRADOR', 'RECHAZADO']);

export const TRANSICIONES: Readonly<Record<EstadoCurso, readonly EstadoCurso[]>> = {
  BORRADOR: ['EN_REVISION'],
  RECHAZADO: ['EN_REVISION'],
  EN_REVISION: ['PUBLICADO', 'RECHAZADO'],
  PUBLICADO: [], // archivar no existe hoy: no se añade (sería funcionalidad nueva)
  ARCHIVADO: [],
};

export interface MensajesGuarda {
  sinPermiso: string;
  bloqueado: string;
}

/** Mensajes de cada operación, tal como los ve el cliente. */
export const MENSAJES = {
  actualizarCurso: { sinPermiso: 'No puedes editar este curso.', bloqueado: 'El curso no permite modificaciones.' },
  crearModulo: { sinPermiso: 'No puedes modificar este curso.', bloqueado: 'Este curso no permite modificaciones.' },
  actualizarModulo: { sinPermiso: 'No puedes modificar este módulo.', bloqueado: 'El curso está bloqueado.' },
  crearLeccion: { sinPermiso: 'No puedes modificar este curso.', bloqueado: 'El curso no permite modificaciones.' },
  actualizarLeccion: { sinPermiso: 'No puedes modificar esta lección.', bloqueado: 'El curso no permite modificaciones.' },
  eliminarLeccion: { sinPermiso: 'No puedes eliminar esta lección.', bloqueado: 'El curso no permite modificaciones.' },
  eliminarModulo: { sinPermiso: 'No puedes eliminar este módulo.', bloqueado: 'El curso está bloqueado.' },
  enviarARevision: {
    sinPermiso: 'No puedes enviar este curso a revisión.',
    bloqueado: 'Este curso ya no puede enviarse a revisión.',
  },
  archivoDeLeccion: {
    sinPermiso: 'No puedes modificar esta lección.',
    bloqueado: 'El curso ya no permite cambios. Actualiza su estado.',
  },
} as const satisfies Record<string, MensajesGuarda>;

export const MENSAJE_CONSULTAR_CURSO = 'No tienes permiso para consultar este curso.';

type Propietario = Pick<ContextoCurso, 'idPersonaDocente' | 'docenteActivo'>;

export const politicaCurso = {
  esEditable: (estado: EstadoCurso): boolean => ESTADOS_EDITABLES.has(estado),

  puedePasar: (de: EstadoCurso, a: EstadoCurso): boolean => TRANSICIONES[de].includes(a),

  /** El rol sale del servicio, además de `autorizar(...)` en la ruta (defensa en profundidad). */
  exigirRol(usuario: UsuarioSesion, rol: Rol): void {
    if (!usuario.roles.includes(rol)) throw AppError.sinPermiso();
  },

  /** Propiedad: solo el docente activo dueño del curso. */
  exigirPropietario(ctx: Propietario, usuario: UsuarioSesion, mensaje: string): void {
    if (ctx.idPersonaDocente !== usuario.idPersona || !ctx.docenteActivo) {
      throw AppError.sinPermiso(mensaje);
    }
  },

  /** Propiedad y después estado editable; lanza exactamente los AppError de cada operación. */
  exigirEditable(ctx: ContextoCurso, usuario: UsuarioSesion, m: MensajesGuarda): void {
    politicaCurso.exigirPropietario(ctx, usuario, m.sinPermiso);
    if (!politicaCurso.esEditable(ctx.estado)) {
      throw AppError.conflicto(m.bloqueado, 'CURSO_BLOQUEADO');
    }
  },

  /** Propiedad y después una transición permitida (el envío a revisión). */
  exigirTransicion(ctx: ContextoCurso, usuario: UsuarioSesion, a: EstadoCurso, m: MensajesGuarda): void {
    politicaCurso.exigirPropietario(ctx, usuario, m.sinPermiso);
    if (!politicaCurso.puedePasar(ctx.estado, a)) {
      throw AppError.conflicto(m.bloqueado, 'CURSO_BLOQUEADO');
    }
  },

  /** Quién puede leer los archivos de un curso: un administrador o el docente dueño. */
  puedeLeerArchivos(ctx: Pick<ContextoCurso, 'idPersonaDocente'>, usuario: UsuarioSesion): boolean {
    const admin = usuario.roles.includes('ADMIN');
    const propietario = usuario.roles.includes('DOCENTE') && ctx.idPersonaDocente === usuario.idPersona;
    return admin || propietario;
  },
};
