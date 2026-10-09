import type pg from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { Rol } from '../../shared/auth/tipos.js';

// Capa repository: SOLO consultas a PostgreSQL. Sin reglas del negocio.
// Los datos se devuelven en camelCase para el resto del backend.

export interface CuentaConRoles {
  idUsuario: number;
  idPersona: number;
  correo: string;
  contrasenaHash: string;
  estado: 'ACTIVO' | 'INACTIVO';
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  nombres: string;
  apellidos: string;
  fotoUrl: string | null;
  roles: Rol[];
}

export interface Perfil {
  idUsuario: number;
  idPersona: number;
  correo: string;
  nombres: string;
  apellidos: string;
  ciudad: string | null;
  biografia: string | null;
  fotoUrl: string | null;
  roles: Rol[];
  creadoEn: Date;
}

const SELECT_CUENTA = `
  SELECT u.id_usuario        AS "idUsuario",
         u.id_persona        AS "idPersona",
         u.correo,
         u.contrasena_hash   AS "contrasenaHash",
         u.estado,
         u.intentos_fallidos AS "intentosFallidos",
         u.bloqueado_hasta   AS "bloqueadoHasta",
         p.nombres, p.apellidos,
         p.foto_url          AS "fotoUrl",
         COALESCE(array_agg(r.nombre ORDER BY r.id_rol) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
    FROM usuario u
    JOIN persona p          ON p.id_persona = u.id_persona
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN rol r          ON r.id_rol = ur.id_rol`;

export const identidadRepository = {
  async buscarCuentaPorCorreo(correo: string): Promise<CuentaConRoles | null> {
    const { rows } = await consultar<CuentaConRoles>(
      `${SELECT_CUENTA} WHERE u.correo = $1 GROUP BY u.id_usuario, p.id_persona`,
      [correo],
    );
    return rows[0] ?? null;
  },

  async existeCorreo(correo: string): Promise<boolean> {
    const { rowCount } = await consultar('SELECT 1 FROM usuario WHERE correo = $1', [correo]);
    return (rowCount ?? 0) > 0;
  },

  /** Crea persona + usuario + rol ESTUDIANTE. Debe llamarse dentro de `enTransaccion`. */
  async crearCuentaEstudiante(
    cliente: pg.PoolClient,
    datos: { nombres: string; apellidos: string; correo: string; contrasenaHash: string },
  ): Promise<{ idPersona: number; idUsuario: number }> {
    const persona = await cliente.query<{ id_persona: number }>(
      'INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona',
      [datos.nombres, datos.apellidos],
    );
    const idPersona = persona.rows[0]!.id_persona;
    const usuario = await cliente.query<{ id_usuario: number }>(
      'INSERT INTO usuario (id_persona, correo, contrasena_hash) VALUES ($1, $2, $3) RETURNING id_usuario',
      [idPersona, datos.correo, datos.contrasenaHash],
    );
    const idUsuario = usuario.rows[0]!.id_usuario;
    await cliente.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol)
       SELECT $1, id_rol FROM rol WHERE nombre = 'ESTUDIANTE'`,
      [idUsuario],
    );
    return { idPersona, idUsuario };
  },

  /** Suma un intento fallido y, si se pasa del límite, bloquea la cuenta hasta `bloquearHasta`. */
  async registrarIntentoFallido(idUsuario: number, maxIntentos: number, bloquearHasta: Date): Promise<void> {
    await consultar(
      `UPDATE usuario
          SET intentos_fallidos = intentos_fallidos + 1,
              bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2 THEN $3::timestamptz ELSE bloqueado_hasta END
        WHERE id_usuario = $1`,
      [idUsuario, maxIntentos, bloquearHasta],
    );
  },

  async registrarAccesoCorrecto(idUsuario: number): Promise<void> {
    await consultar(
      'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now() WHERE id_usuario = $1',
      [idUsuario],
    );
  },

  async obtenerPerfil(idUsuario: number): Promise<Perfil | null> {
    const { rows } = await consultar<Perfil>(
      `SELECT u.id_usuario AS "idUsuario", p.id_persona AS "idPersona", u.correo,
              p.nombres, p.apellidos, p.ciudad, p.biografia, p.foto_url AS "fotoUrl", p.creado_en AS "creadoEn",
              COALESCE(array_agg(r.nombre ORDER BY r.id_rol) FILTER (WHERE r.nombre IS NOT NULL), '{}') AS roles
         FROM usuario u
         JOIN persona p ON p.id_persona = u.id_persona
         LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         LEFT JOIN rol r ON r.id_rol = ur.id_rol
        WHERE u.id_usuario = $1
        GROUP BY u.id_usuario, p.id_persona`,
      [idUsuario],
    );
    return rows[0] ?? null;
  },

  async actualizarPersona(
    idPersona: number,
    datos: { nombres: string; apellidos: string; ciudad?: string | null; biografia?: string | null },
  ): Promise<void> {
    await consultar(
      'UPDATE persona SET nombres = $2, apellidos = $3, ciudad = $4, biografia = $5 WHERE id_persona = $1',
      [idPersona, datos.nombres, datos.apellidos, datos.ciudad ?? null, datos.biografia ?? null],
    );
  },

  async actualizarContrasena(idUsuario: number, contrasenaHash: string): Promise<void> {
    await consultar('UPDATE usuario SET contrasena_hash = $2 WHERE id_usuario = $1', [idUsuario, contrasenaHash]);
  },
};
