import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { env } from '../../shared/config/env.js';
import { notificar } from '../../shared/correo/plantilla.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import { identidadApi } from '../identidad/index.js';
import type {
  CambioEstadoUsuario,
  CambioRolesUsuario,
  DecisionSolicitud,
  FiltroUsuariosAdmin,
  NuevaSolicitudDocente,
} from './usuarios.esquemas.js';
import type { EstadoSolicitud, RespuestaUsuariosAdmin, RolUsuario, SolicitudDocente, UsuarioAdmin } from './usuarios.modelo.js';
import { correoSolicitudAprobada, correoSolicitudRechazada } from './usuarios.correos.js';
import { usuariosRepository as repo } from './usuarios.repository.js';

// Capa service: reglas del negocio de las solicitudes para ser docente y gestión de usuarios por administrador.
// Auditoría: toda transacción de escritura pasa `{ actor: idPersona }` del usuario autenticado.

export const usuariosService = {
  /** RF-05 · Un estudiante pide el rol Docente. Solo una solicitud pendiente a la vez. */
  async solicitarDocencia(usuario: UsuarioSesion, datos: NuevaSolicitudDocente): Promise<SolicitudDocente> {
    const id = await enTransaccion(async (cliente) => {
      await repo.bloquearUsuario(cliente, usuario.idUsuario);
      if (await repo.tieneRol(cliente, usuario.idUsuario, 'DOCENTE')) {
        throw AppError.conflicto('Tu cuenta ya tiene el rol Docente.', 'YA_ES_DOCENTE');
      }
      if (await repo.existePendiente(cliente, usuario.idPersona)) {
        throw AppError.conflicto('Ya tienes una solicitud pendiente de revisión.', 'SOLICITUD_PENDIENTE');
      }
      return repo.crearSolicitud(cliente, usuario.idPersona, datos.especialidad, datos.motivo);
   }, { actor: usuario.idPersona });
    registrarEvento('solicitud_docente_enviada', { idSolicitud: id, idUsuario: usuario.idUsuario });
    return (await repo.buscarSolicitud(id))!;
  },

  /** La última solicitud de la cuenta, para mostrar su estado en el perfil (o null si nunca envió una). */
  miSolicitud: (usuario: UsuarioSesion) => repo.ultimaSolicitud(usuario.idPersona),

  listarSolicitudes: (estado: EstadoSolicitud) => repo.listarSolicitudes(estado),

  /**
   * RF-22 · Aprobar agrega el rol DOCENTE (conserva ESTUDIANTE) y crea el perfil docente;
   * rechazar exige una observación. El rol nuevo vale desde la siguiente petición del estudiante (los roles se leen de la base, ADR-011 11.10).
   */
  async decidirSolicitud(id: number, datos: DecisionSolicitud, admin: UsuarioSesion): Promise<SolicitudDocente> {
    await enTransaccion(async (cliente) => {
      const solicitud = await repo.bloquearSolicitud(cliente, id);
      if (!solicitud) throw AppError.noEncontrado('La solicitud no existe.');
      if (solicitud.idPersona === admin.idPersona) {
        throw AppError.sinPermiso('No puedes decidir tu propia solicitud.');
      }
      if (solicitud.estado !== 'PENDIENTE') {
        throw AppError.conflicto('Esta solicitud ya fue revisada. Actualiza la lista.', 'SOLICITUD_YA_REVISADA');
      }
      if (datos.decision === 'APROBAR') {
        await repo.marcarRevisada(cliente, id, 'APROBADA', null, admin.idPersona);
        await repo.asignarRolDocente(cliente, solicitud.idUsuario, admin.idPersona);
        await repo.activarDocente(cliente, solicitud.idPersona, solicitud.especialidad);
      } else {
        await repo.marcarRevisada(cliente, id, 'RECHAZADA', datos.observacion, admin.idPersona);
      }
   }, { actor: admin.idPersona });
    registrarEvento('solicitud_docente_decidida', { idSolicitud: id, decision: datos.decision, idAdmin: admin.idUsuario });
    const decidida = (await repo.buscarSolicitud(id))!;
    const { correo, nombres } = decidida.solicitante;
    notificar('solicitud_docente', datos.decision === 'APROBAR'
      ? correoSolicitudAprobada({ para: correo, nombres, enlace: `${env.FRONTEND_URL}/docente/cursos` })
      : correoSolicitudRechazada({ para: correo, nombres, observacion: datos.observacion, enlace: `${env.FRONTEND_URL}/perfil` }));
    return decidida;
  },

  /** RF-21 · Listar usuarios con paginación, búsqueda y filtros por rol/estado. */
  listarUsuarios: (filtro: FiltroUsuariosAdmin): Promise<RespuestaUsuariosAdmin> => repo.listarUsuariosAdmin(filtro),

  /**
   * RF-21 · Activar o desactivar usuario.
   * Al desactivar, revoca de inmediato todas las sesiones activas de la cuenta.
   * No permite auto-desactivación ni desactivar al único administrador activo.
   */
  async cambiarEstado(idUsuario: number, datos: CambioEstadoUsuario, admin: UsuarioSesion): Promise<UsuarioAdmin> {
    if (admin.idUsuario === idUsuario) {
      throw AppError.solicitudInvalida('No puedes cambiar el estado de tu propia cuenta.');
    }
    const nuevoEstado = datos.estado ?? (datos.activo ? 'ACTIVO' : 'INACTIVO');

    await enTransaccion(async (cliente) => {
      const usuario = await repo.buscarUsuarioPorId(cliente, idUsuario);
      if (!usuario) throw AppError.noEncontrado('El usuario no existe.');

      if (nuevoEstado === 'INACTIVO') {
        if (usuario.roles.includes('ADMIN')) {
          const adminsActivos = await repo.contarAdminsActivos(cliente);
          if (adminsActivos <= 1) {
            throw AppError.solicitudInvalida('No se puede desactivar al único administrador activo del sistema.');
          }
        }
        await repo.actualizarEstadoUsuario(cliente, idUsuario, 'INACTIVO');
        await identidadApi.revocarSesionesDeCuentaInactiva(idUsuario, cliente);
      } else {
        await repo.actualizarEstadoUsuario(cliente, idUsuario, 'ACTIVO');
      }
    }, { actor: admin.idPersona });

    registrarEvento('usuario_estado_actualizado', { idUsuario, estado: nuevoEstado, idAdmin: admin.idUsuario });
    return (await repo.buscarUsuarioAdmin(idUsuario))!;
  },

  /**
   * Quita el bloqueo temporal por intentos fallidos y reinicia el contador. Si la cuenta no estaba bloqueada,
   * no cambia nada (la auditoría no registra un UPDATE sin cambios).
   */
  async desbloquear(idUsuario: number, admin: UsuarioSesion): Promise<void> {
    const existe = await enTransaccion((cliente) => identidadApi.desbloquearCuenta(idUsuario, cliente), { actor: admin.idPersona });
    if (!existe) throw AppError.noEncontrado('El usuario no existe.');
    registrarEvento('cuenta_desbloqueada', { idUsuario, idAdmin: admin.idUsuario });
  },

  /**
   * RF-21 · Editar roles de un usuario.
   * Toda cuenta debe conservar al menos el rol ESTUDIANTE.
   * No permite quitarse el rol ADMIN a uno mismo ni dejar el sistema sin administradores.
   */
  async cambiarRoles(idUsuario: number, datos: CambioRolesUsuario, admin: UsuarioSesion): Promise<UsuarioAdmin> {
    const roles: RolUsuario[] = Array.from(new Set([...datos.roles, 'ESTUDIANTE' as const]));

    await enTransaccion(async (cliente) => {
      const usuario = await repo.buscarUsuarioPorId(cliente, idUsuario);
      if (!usuario) throw AppError.noEncontrado('El usuario no existe.');

      if (admin.idUsuario === idUsuario && !roles.includes('ADMIN')) {
        throw AppError.solicitudInvalida('No puedes quitarte el rol Administrador a ti mismo.');
      }

      if (usuario.roles.includes('ADMIN') && !roles.includes('ADMIN')) {
        const adminsActivos = await repo.contarAdminsActivos(cliente);
        if (adminsActivos <= 1) {
          throw AppError.solicitudInvalida('No se puede quitar el rol al único administrador del sistema.');
        }
      }

      await repo.actualizarRolesUsuario(cliente, idUsuario, roles, admin.idPersona);
    }, { actor: admin.idPersona });

    registrarEvento('usuario_roles_actualizados', { idUsuario, roles, idAdmin: admin.idUsuario });
    return (await repo.buscarUsuarioAdmin(idUsuario))!;
  },
};
