import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { EstadoSolicitud, SolicitudDocente } from './usuarios.modelo.js';

// Capa repository del módulo Usuarios (solicitudes de docente): solo consultas SQL parametrizadas ($1, $2…).

interface FilaSolicitud {
  id: number;
  estado: EstadoSolicitud;
  especialidad: string;
  motivo: string;
  observacion: string | null;
  enviada_en: Date;
  revisada_en: Date | null;
  nombres: string;
  apellidos: string;
  correo: string;
  estudiante_desde: Date;
  cursos_completados: number;
}

const SELECT_SOLICITUD = `
  SELECT s.id_solicitud AS id, s.estado, s.especialidad, s.motivo, s.observacion,
         s.enviada_en, s.revisada_en, p.nombres, p.apellidos, u.correo,
         p.creado_en AS estudiante_desde,
         (SELECT count(*)::int FROM inscripcion i
           WHERE i.id_persona = p.id_persona AND i.estado = 'COMPLETADA') AS cursos_completados
    FROM solicitud_docente s
    JOIN persona p ON p.id_persona = s.id_persona
    JOIN usuario u ON u.id_persona = s.id_persona`;

function aSolicitud(f: FilaSolicitud): SolicitudDocente {
  return {
    id: f.id,
    estado: f.estado,
    especialidad: f.especialidad,
    motivo: f.motivo,
    observacion: f.observacion,
    enviadaEn: f.enviada_en.toISOString(),
    revisadaEn: f.revisada_en?.toISOString() ?? null,
    solicitante: {
      nombres: f.nombres,
      apellidos: f.apellidos,
      correo: f.correo,
      estudianteDesde: f.estudiante_desde.toISOString(),
      cursosCompletados: f.cursos_completados,
    },
  };
}

export const usuariosRepository = {
  /** Serializa las solicitudes de una misma cuenta (evita dos PENDIENTE por doble clic). */
  async bloquearUsuario(cliente: PoolClient, idUsuario: number): Promise<void> {
    await cliente.query('SELECT 1 FROM usuario WHERE id_usuario = $1 FOR UPDATE', [idUsuario]);
  },

  async tieneRol(cliente: PoolClient, idUsuario: number, rol: string): Promise<boolean> {
    const r = await cliente.query(
      `SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
        WHERE ur.id_usuario = $1 AND r.nombre = $2`,
      [idUsuario, rol],
    );
    return r.rowCount === 1;
  },

  async existePendiente(cliente: PoolClient, idPersona: number): Promise<boolean> {
    const r = await cliente.query(
      "SELECT 1 FROM solicitud_docente WHERE id_persona = $1 AND estado = 'PENDIENTE'",
      [idPersona],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async crearSolicitud(cliente: PoolClient, idPersona: number, especialidad: string, motivo: string): Promise<number> {
    const r = await cliente.query<{ id_solicitud: number }>(
      'INSERT INTO solicitud_docente (id_persona, especialidad, motivo) VALUES ($1, $2, $3) RETURNING id_solicitud',
      [idPersona, especialidad, motivo],
    );
    return r.rows[0]!.id_solicitud;
  },

  async buscarSolicitud(id: number, cliente?: PoolClient): Promise<SolicitudDocente | null> {
    const sql = `${SELECT_SOLICITUD} WHERE s.id_solicitud = $1`;
    const r = cliente ? await cliente.query<FilaSolicitud>(sql, [id]) : await consultar<FilaSolicitud>(sql, [id]);
    return r.rows[0] ? aSolicitud(r.rows[0]) : null;
  },

  /** La solicitud más reciente de la persona (la que ve en su perfil). */
  async ultimaSolicitud(idPersona: number): Promise<SolicitudDocente | null> {
    const r = await consultar<FilaSolicitud>(
      `${SELECT_SOLICITUD} WHERE s.id_persona = $1 ORDER BY s.enviada_en DESC, s.id_solicitud DESC LIMIT 1`,
      [idPersona],
    );
    return r.rows[0] ? aSolicitud(r.rows[0]) : null;
  },

  /** Pendientes: la más antigua primero (orden de llegada). Revisadas: la más reciente primero. */
  async listarSolicitudes(estado: EstadoSolicitud): Promise<SolicitudDocente[]> {
    const orden = estado === 'PENDIENTE' ? 's.enviada_en ASC' : 's.revisada_en DESC NULLS LAST';
    const r = await consultar<FilaSolicitud>(
      `${SELECT_SOLICITUD} WHERE s.estado = $1 ORDER BY ${orden}, s.id_solicitud LIMIT 200`,
      [estado],
    );
    return r.rows.map(aSolicitud);
  },

  /** Bloquea la solicitud hasta el fin de la transacción: dos administradores no la deciden a la vez. */
  async bloquearSolicitud(
    cliente: PoolClient,
    id: number,
  ): Promise<{ idPersona: number; idUsuario: number; estado: EstadoSolicitud; especialidad: string } | null> {
    const r = await cliente.query<{ id_persona: number; id_usuario: number; estado: EstadoSolicitud; especialidad: string }>(
      `SELECT s.id_persona, u.id_usuario, s.estado, s.especialidad
         FROM solicitud_docente s JOIN usuario u ON u.id_persona = s.id_persona
        WHERE s.id_solicitud = $1
        FOR UPDATE OF s`,
      [id],
    );
    const f = r.rows[0];
    return f ? { idPersona: f.id_persona, idUsuario: f.id_usuario, estado: f.estado, especialidad: f.especialidad } : null;
  },

  async marcarRevisada(
    cliente: PoolClient,
    id: number,
    estado: 'APROBADA' | 'RECHAZADA',
    observacion: string | null,
    revisadaPor: number,
  ): Promise<void> {
    await cliente.query(
      `UPDATE solicitud_docente
          SET estado = $2, observacion = $3, revisada_por = $4, revisada_en = now()
        WHERE id_solicitud = $1`,
      [id, estado, observacion, revisadaPor],
    );
  },

  /** Agrega el rol DOCENTE; los roles son acumulativos (conserva ESTUDIANTE). */
  async asignarRolDocente(cliente: PoolClient, idUsuario: number, asignadoPor: number): Promise<void> {
    await cliente.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol, asignado_por)
       SELECT $1, id_rol, $2 FROM rol WHERE nombre = 'DOCENTE'
       ON CONFLICT (id_usuario, id_rol) DO NOTHING`,
      [idUsuario, asignadoPor],
    );
  },

  /** Crea el perfil docente o lo reactiva si ya existía. */
  async activarDocente(cliente: PoolClient, idPersona: number, especialidad: string): Promise<void> {
    await cliente.query(
      `INSERT INTO docente (id_persona, especialidad) VALUES ($1, $2)
       ON CONFLICT (id_persona) DO UPDATE
         SET especialidad = EXCLUDED.especialidad, estado = 'ACTIVO', aprobado_en = now()`,
      [idPersona, especialidad],
    );
  },
};
