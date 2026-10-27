import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { FiltroUsuariosAdmin } from './usuarios.esquemas.js';
import type {
  EstadoSolicitud,
  EstadoUsuario,
  RespuestaUsuariosAdmin,
  RolUsuario,
  SolicitudDocente,
  UsuarioAdmin,
} from './usuarios.modelo.js';

interface FilaUsuarioAdmin {
  id: number;
  id_persona: number;
  nombres: string;
  apellidos: string;
  correo: string;
  ciudad: string | null;
  foto_url: string | null;
  roles: string[];
  estado: EstadoUsuario;
  creado_en: Date;
  ultimo_acceso: Date | null;
}

function aUsuarioAdmin(f: FilaUsuarioAdmin): UsuarioAdmin {
  const roles = (f.roles ?? []).filter((r): r is RolUsuario =>
    ['ESTUDIANTE', 'DOCENTE', 'ADMIN'].includes(r),
  );
  return {
    id: f.id,
    idPersona: f.id_persona,
    nombre: `${f.nombres} ${f.apellidos}`.trim(),
    nombres: f.nombres,
    apellidos: f.apellidos,
    correo: f.correo,
    ciudad: f.ciudad,
    fotoUrl: f.foto_url,
    roles,
    activo: f.estado === 'ACTIVO',
    estado: f.estado,
    creadoEn: f.creado_en.toISOString(),
    ultimoAcceso: f.ultimo_acceso ? f.ultimo_acceso.toISOString() : null,
  };
}

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

  /** RF-21 · Listar usuarios con filtros y conteos reales para el administrador. */
  async listarUsuariosAdmin(filtro: FiltroUsuariosAdmin): Promise<RespuestaUsuariosAdmin> {
    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (filtro.q) {
      params.push(`%${filtro.q.toLowerCase()}%`);
      condiciones.push(
        `(lower(concat_ws(' ', p.nombres, p.apellidos)) LIKE $${params.length} OR lower(u.correo) LIKE $${params.length})`,
      );
    }

    if (filtro.estado) {
      params.push(filtro.estado);
      condiciones.push(`u.estado = $${params.length}`);
    }

    if (filtro.rol) {
      params.push(filtro.rol);
      condiciones.push(
        `EXISTS (SELECT 1 FROM usuario_rol ur2 JOIN rol r2 ON r2.id_rol = ur2.id_rol WHERE ur2.id_usuario = u.id_usuario AND r2.nombre = $${params.length})`,
      );
    }

    const whereSql = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Conteos globales por rol
    const conteosResult = await consultar<{
      total: number;
      estudiantes: number;
      docentes: number;
      administradores: number;
    }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
                 WHERE ur.id_usuario = u.id_usuario AND r.nombre = 'ESTUDIANTE'
              ))::int AS estudiantes,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
                 WHERE ur.id_usuario = u.id_usuario AND r.nombre = 'DOCENTE'
              ))::int AS docentes,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
                 WHERE ur.id_usuario = u.id_usuario AND r.nombre = 'ADMIN'
              ))::int AS administradores
         FROM usuario u`,
    );

    // Total con filtro aplicado
    const totalFiltradoResult = await consultar<{ total: number }>(
      `SELECT count(*)::int AS total FROM usuario u JOIN persona p ON p.id_persona = u.id_persona ${whereSql}`,
      params,
    );
    const totalFiltrado = totalFiltradoResult.rows[0]?.total ?? 0;

    // Paginación
    const pagina = filtro.pagina;
    const limite = filtro.limite;
    const offset = (pagina - 1) * limite;

    const queryParams = [...params, limite, offset];
    const itemsResult = await consultar<FilaUsuarioAdmin>(
      `SELECT u.id_usuario AS id, p.id_persona, p.nombres, p.apellidos, u.correo, p.ciudad, p.foto_url,
              u.estado, p.creado_en, u.ultimo_acceso,
              COALESCE(array_agg(r.nombre ORDER BY r.id_rol) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
         FROM usuario u
         JOIN persona p ON p.id_persona = u.id_persona
         LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         LEFT JOIN rol r ON r.id_rol = ur.id_rol
         ${whereSql}
        GROUP BY u.id_usuario, p.id_persona
        ORDER BY p.creado_en DESC, u.id_usuario DESC
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams,
    );

    const conteos = conteosResult.rows[0] ?? { total: 0, estudiantes: 0, docentes: 0, administradores: 0 };

    return {
      items: itemsResult.rows.map(aUsuarioAdmin),
      paginacion: {
        total: totalFiltrado,
        pagina,
        limite,
        totalPaginas: Math.ceil(totalFiltrado / limite) || (totalFiltrado === 0 ? 0 : 1),
      },
      conteos,
    };
  },

  async buscarUsuarioAdmin(idUsuario: number, cliente?: PoolClient): Promise<UsuarioAdmin | null> {
    const sql = `
      SELECT u.id_usuario AS id, p.id_persona, p.nombres, p.apellidos, u.correo, p.ciudad, p.foto_url,
             u.estado, p.creado_en, u.ultimo_acceso,
             COALESCE(array_agg(r.nombre ORDER BY r.id_rol) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
        FROM usuario u
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        LEFT JOIN rol r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1
       GROUP BY u.id_usuario, p.id_persona`;
    const r = cliente
      ? await cliente.query<FilaUsuarioAdmin>(sql, [idUsuario])
      : await consultar<FilaUsuarioAdmin>(sql, [idUsuario]);
    return r.rows[0] ? aUsuarioAdmin(r.rows[0]) : null;
  },

  async buscarUsuarioPorId(
    cliente: PoolClient,
    idUsuario: number,
  ): Promise<{ idUsuario: number; idPersona: number; estado: EstadoUsuario; roles: RolUsuario[] } | null> {
    const r = await cliente.query<{
      id_usuario: number;
      id_persona: number;
      estado: EstadoUsuario;
      roles: RolUsuario[];
    }>(
      `SELECT u.id_usuario, u.id_persona, u.estado,
              COALESCE(array_agg(r.nombre ORDER BY r.id_rol) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
         FROM usuario u
         LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         LEFT JOIN rol r ON r.id_rol = ur.id_rol
        WHERE u.id_usuario = $1
        GROUP BY u.id_usuario`,
      [idUsuario],
    );
    const f = r.rows[0];
    return f ? { idUsuario: f.id_usuario, idPersona: f.id_persona, estado: f.estado, roles: f.roles } : null;
  },

  async contarAdminsActivos(cliente: PoolClient): Promise<number> {
    const r = await cliente.query<{ total: number }>(
      `SELECT count(DISTINCT u.id_usuario)::int AS total
         FROM usuario u
         JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         JOIN rol r ON r.id_rol = ur.id_rol
        WHERE r.nombre = 'ADMIN' AND u.estado = 'ACTIVO'`,
    );
    return r.rows[0]?.total ?? 0;
  },

  async actualizarEstadoUsuario(cliente: PoolClient, idUsuario: number, estado: EstadoUsuario): Promise<void> {
    await cliente.query('UPDATE usuario SET estado = $2 WHERE id_usuario = $1', [idUsuario, estado]);
  },

  async actualizarRolesUsuario(
    cliente: PoolClient,
    idUsuario: number,
    roles: RolUsuario[],
    asignadoPor: number,
  ): Promise<void> {
    // Elimina roles anteriores
    await cliente.query('DELETE FROM usuario_rol WHERE id_usuario = $1', [idUsuario]);

    // Inserta los nuevos roles
    await cliente.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol, asignado_por)
       SELECT $1, id_rol, $3 FROM rol WHERE nombre = ANY($2::text[])`,
      [idUsuario, roles, asignadoPor],
    );

    // Si tiene DOCENTE, asegurar perfil activo
    if (roles.includes('DOCENTE')) {
      await cliente.query(
        `INSERT INTO docente (id_persona, especialidad)
         SELECT id_persona, 'Docente' FROM usuario WHERE id_usuario = $1
         ON CONFLICT (id_persona) DO UPDATE SET estado = 'ACTIVO'`,
        [idUsuario],
      );
    } else {
      // Si se retiró el rol docente, inactivar registro docente
      await cliente.query(
        `UPDATE docente SET estado = 'INACTIVO'
          WHERE id_persona = (SELECT id_persona FROM usuario WHERE id_usuario = $1)`,
        [idUsuario],
      );
    }
  },
};
