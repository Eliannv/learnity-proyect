import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type { DecisionSolicitud, NuevaSolicitudDocente } from './usuarios.esquemas.js';
import type { EstadoSolicitud, SolicitudDocente } from './usuarios.modelo.js';
import { usuariosRepository as repo } from './usuarios.repository.js';

// Capa service: reglas del negocio de las solicitudes para ser docente.

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
    });
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
    });
    registrarEvento('solicitud_docente_decidida', { idSolicitud: id, decision: datos.decision, idAdmin: admin.idUsuario });
    return (await repo.buscarSolicitud(id))!;
  },
};
