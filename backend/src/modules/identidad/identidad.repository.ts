import type pg from 'pg';
import { consultar, pool } from '../../shared/database/pool.js';
import type { Rol } from '../../shared/auth/tipos.js';

// Capa repository: SOLO consultas a PostgreSQL. Sin reglas del negocio.
// Los datos se devuelven en camelCase para el resto del backend.
// Los métodos que reciben `cliente` se usan dentro de `enTransaccion`; si no se pasa, usan el pool.

type Ejecutor = pg.Pool | pg.PoolClient;

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

export interface FilaSesion {
  idSesion: string;
  idUsuario: number;
  familia: string;
  iniciadaEn: Date;
  expiraEn: Date;
  reemplazadoEn: Date | null;
  revocadoEn: Date | null;
}

export type MotivoRevocacion = 'CIERRE' | 'REUTILIZACION' | 'CAMBIO_CONTRASENA' | 'RESTABLECIMIENTO' | 'CUENTA_INACTIVA';

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
  // ───────────────────────────────────────────────────────────── cuentas
  async buscarCuentaPorCorreo(correo: string): Promise<CuentaConRoles | null> {
    const { rows } = await consultar<CuentaConRoles>(
      `${SELECT_CUENTA} WHERE u.correo = $1 GROUP BY u.id_usuario, p.id_persona`,
      [correo],
    );
    return rows[0] ?? null;
  },

  async buscarCuentaPorId(idUsuario: number, cliente: Ejecutor = pool): Promise<CuentaConRoles | null> {
    const { rows } = await cliente.query<CuentaConRoles>(
      `${SELECT_CUENTA} WHERE u.id_usuario = $1 GROUP BY u.id_usuario, p.id_persona`,
      [idUsuario],
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

  /**
   * Suma un intento fallido y, al llegar al límite, bloquea la cuenta hasta `bloquearHasta`.
   * Si un bloqueo anterior ya venció, la cuenta empieza de nuevo desde 1.
   * Devuelve true si este intento dejó la cuenta bloqueada.
   */
  async registrarIntentoFallido(idUsuario: number, maxIntentos: number, bloquearHasta: Date): Promise<boolean> {
    const { rows } = await consultar<{ bloqueada: boolean }>(
      `WITH previo AS (
         SELECT CASE WHEN bloqueado_hasta IS NOT NULL AND bloqueado_hasta <= now() THEN 0
                     ELSE intentos_fallidos END + 1 AS intentos
           FROM usuario WHERE id_usuario = $1
       )
       UPDATE usuario u
          SET intentos_fallidos = LEAST(previo.intentos, 32767),
              bloqueado_hasta   = CASE WHEN previo.intentos >= $2 THEN $3::timestamptz ELSE NULL END
         FROM previo
        WHERE u.id_usuario = $1
       RETURNING previo.intentos >= $2 AS bloqueada`,
      [idUsuario, maxIntentos, bloquearHasta],
    );
    return rows[0]?.bloqueada ?? false;
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
    cliente: Ejecutor = pool,
  ): Promise<void> {
    await cliente.query(
      'UPDATE persona SET nombres = $2, apellidos = $3, ciudad = $4, biografia = $5 WHERE id_persona = $1',
      [idPersona, datos.nombres, datos.apellidos, datos.ciudad ?? null, datos.biografia ?? null],
    );
  },

  /** Cambia la foto y devuelve la anterior, para borrar su archivo después del commit. */
  async cambiarFoto(idPersona: number, fotoUrl: string | null, cliente: Ejecutor = pool): Promise<string | null> {
    const { rows } = await cliente.query<{ anterior: string | null }>(
      `UPDATE persona p SET foto_url = $2
         FROM (SELECT foto_url AS anterior FROM persona WHERE id_persona = $1 FOR UPDATE) a
        WHERE p.id_persona = $1
       RETURNING a.anterior`,
      [idPersona, fotoUrl],
    );
    return rows[0]?.anterior ?? null;
  },

  /** Guarda el nuevo hash y limpia los intentos fallidos y el bloqueo. */
  async actualizarContrasena(idUsuario: number, contrasenaHash: string, cliente: Ejecutor = pool): Promise<void> {
    await cliente.query(
      'UPDATE usuario SET contrasena_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = $1',
      [idUsuario, contrasenaHash],
    );
  },

  // ───────────────────────────────────────────────────────────── sesiones (refresh tokens)
  async crearSesion(
    datos: {
      idUsuario: number;
      familia: string;
      tokenHash: string;
      iniciadaEn: Date;
      expiraEn: Date;
      ip?: string;
      agente?: string;
    },
    cliente: Ejecutor = pool,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sesion (id_usuario, familia, token_hash, iniciada_en, expira_en, ip, agente)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [datos.idUsuario, datos.familia, datos.tokenHash, datos.iniciadaEn, datos.expiraEn, datos.ip ?? null, datos.agente ?? null],
    );
  },

  async buscarSesionPorHash(tokenHash: string): Promise<FilaSesion | null> {
    const { rows } = await consultar<FilaSesion>(
      `SELECT id_sesion AS "idSesion", id_usuario AS "idUsuario", familia,
              iniciada_en AS "iniciadaEn", expira_en AS "expiraEn",
              reemplazado_en AS "reemplazadoEn", revocado_en AS "revocadoEn"
         FROM sesion WHERE token_hash = $1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  /** Marca el token como rotado. Devuelve false si otra petición lo rotó o revocó primero. */
  async marcarReemplazada(idSesion: string, cliente: Ejecutor = pool): Promise<boolean> {
    const { rowCount } = await cliente.query(
      `UPDATE sesion SET reemplazado_en = now()
        WHERE id_sesion = $1 AND reemplazado_en IS NULL AND revocado_en IS NULL`,
      [idSesion],
    );
    return (rowCount ?? 0) > 0;
  },

  async revocarFamilia(familia: string, motivo: MotivoRevocacion): Promise<number> {
    const { rowCount } = await consultar(
      `UPDATE sesion SET revocado_en = now(), motivo_revocacion = $2
        WHERE familia = $1 AND revocado_en IS NULL`,
      [familia, motivo],
    );
    return rowCount ?? 0;
  },

  /** Revoca todas las sesiones de la cuenta, salvo (opcionalmente) la familia indicada. */
  async revocarSesionesUsuario(
    idUsuario: number,
    motivo: MotivoRevocacion,
    exceptoFamilia: string | null = null,
    cliente: Ejecutor = pool,
  ): Promise<number> {
    const { rowCount } = await cliente.query(
      `UPDATE sesion SET revocado_en = now(), motivo_revocacion = $2
        WHERE id_usuario = $1 AND revocado_en IS NULL AND ($3::uuid IS NULL OR familia <> $3::uuid)`,
      [idUsuario, motivo, exceptoFamilia],
    );
    return rowCount ?? 0;
  },

  /**
   * Si la familia tiene un token vigente y la cuenta sigue activa, devuelve los roles ACTUALES de la cuenta
   * (se leen de la base, no del token); si no, `null`. Lo consulta `autenticar` en cada petición (ADR-011, 11.10).
   */
  async rolesDeSesionVigente(familia: string, idUsuario: number): Promise<Rol[] | null> {
    const { rows } = await consultar<{ roles: Rol[] }>(
      `SELECT ARRAY(SELECT r.nombre FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
                     WHERE ur.id_usuario = u.id_usuario ORDER BY r.id_rol) AS roles
         FROM sesion s JOIN usuario u ON u.id_usuario = s.id_usuario
        WHERE s.familia = $1 AND s.id_usuario = $2 AND u.estado = 'ACTIVO'
          AND s.revocado_en IS NULL AND s.reemplazado_en IS NULL AND s.expira_en > now()`,
      [familia, idUsuario],
    );
    return rows[0]?.roles ?? null;
  },

  /** Borra filas vencidas hace más de 30 días (las recientes se conservan para auditoría). */
  async limpiarVencidos(): Promise<void> {
    await consultar(`DELETE FROM sesion WHERE expira_en < now() - INTERVAL '30 days'`);
    await consultar(`DELETE FROM token_recuperacion WHERE expira_en < now() - INTERVAL '30 days'`);
  },

  // ───────────────────────────────────────────────────────────── recuperación de contraseña
  /**
   * Bloquea la fila del usuario hasta el fin de la transacción y cuenta sus enlaces recientes.
   * Así dos solicitudes simultáneas no pueden saltarse el límite por hora.
   */
  async contarTokensRecuperacionDesde(cliente: pg.PoolClient, idUsuario: number, desde: Date): Promise<number> {
    await cliente.query('SELECT 1 FROM usuario WHERE id_usuario = $1 FOR UPDATE', [idUsuario]);
    const { rows } = await cliente.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM token_recuperacion WHERE id_usuario = $1 AND creado_en >= $2',
      [idUsuario, desde],
    );
    return rows[0]?.total ?? 0;
  },

  /** Invalida los enlaces anteriores sin usar y guarda el nuevo (solo su hash). */
  async reemplazarTokenRecuperacion(
    cliente: pg.PoolClient,
    datos: { idUsuario: number; tokenHash: string; expiraEn: Date; ip?: string },
  ): Promise<void> {
    await cliente.query(
      'UPDATE token_recuperacion SET usado_en = now() WHERE id_usuario = $1 AND usado_en IS NULL',
      [datos.idUsuario],
    );
    await cliente.query(
      'INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en, ip) VALUES ($1, $2, $3, $4)',
      [datos.idUsuario, datos.tokenHash, datos.expiraEn, datos.ip ?? null],
    );
  },

  /** Enlace sin usar y sin vencer (no lo consume). */
  async buscarTokenRecuperacionVigente(tokenHash: string): Promise<{ idToken: string; idUsuario: number } | null> {
    const { rows } = await consultar<{ idToken: string; idUsuario: number }>(
      `SELECT id_token AS "idToken", id_usuario AS "idUsuario" FROM token_recuperacion
        WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > now()`,
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  /** Consume el enlace de forma atómica: solo una petición puede usarlo. */
  async consumirTokenRecuperacion(cliente: pg.PoolClient, idToken: string): Promise<boolean> {
    const { rowCount } = await cliente.query(
      'UPDATE token_recuperacion SET usado_en = now() WHERE id_token = $1 AND usado_en IS NULL AND expira_en > now()',
      [idToken],
    );
    return (rowCount ?? 0) > 0;
  },

  async invalidarTokensRecuperacion(idUsuario: number, cliente: Ejecutor = pool): Promise<void> {
    await cliente.query('UPDATE token_recuperacion SET usado_en = now() WHERE id_usuario = $1 AND usado_en IS NULL', [
      idUsuario,
    ]);
  },
};
