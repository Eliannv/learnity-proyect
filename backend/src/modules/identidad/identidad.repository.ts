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

export type MotivoRevocacion =
  | 'CIERRE' | 'REUTILIZACION' | 'CAMBIO_CONTRASENA' | 'RESTABLECIMIENTO' | 'CUENTA_INACTIVA' | 'ADMIN';

/** Un intento de entrar a una cuenta (migración 032). REFRESH solo se registra cuando falla. */
export interface NuevoEventoAcceso {
  idUsuario: number | null;
  correo: string | null;
  paso: PasoAcceso;
  motivo: MotivoAcceso;
  agente?: string;
}

export type PasoAcceso = 'CLAVE' | 'REFRESH' | 'RECUPERACION';
export type MotivoAcceso =
  | 'OK' | 'CLAVE_INCORRECTA' | 'CUENTA_BLOQUEADA' | 'CUENTA_INACTIVA'
  | 'CORREO_DESCONOCIDO' | 'TOKEN_REUTILIZADO' | 'TOKEN_INVALIDO';

export interface EventoAcceso {
  id: number;
  fecha: Date;
  usuario: { id: number; nombre: string } | null;
  correo: string | null;
  paso: PasoAcceso;
  exito: boolean;
  motivo: MotivoAcceso;
  agente: string | null;
}

export interface FiltroAccesos {
  soloFallidos: boolean;
  q?: string;
  pagina: number;
  limite: number;
}

export interface CuentaBloqueada {
  idUsuario: number;
  nombre: string;
  correo: string;
  intentosFallidos: number;
  bloqueadoHasta: Date;
}

/** Sesión abierta de una cuenta, sin el token. `id` es la familia: identifica la sesión a lo largo de sus renovaciones. */
export interface SesionActiva {
  id: string;
  iniciadaEn: Date;
  renovadaEn: Date;
  expiraEn: Date;
  agente: string | null;
}

/** Sesión abierta de cualquier cuenta, para el panel del administrador (sin token ni IP). */
export interface SesionActivaDeCuenta extends SesionActiva {
  usuario: { id: number; nombre: string; correo: string; roles: Rol[] };
}

export interface FiltroSesiones {
  q?: string;
  pagina: number;
  limite: number;
}

/** `%`, `_` y `\` del texto buscado se toman literalmente (`LIKE … ESCAPE '\'`). */
const patronLike = (texto: string) => `%${texto.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

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

  /**
   * Invalida los enlaces anteriores sin usar y guarda el nuevo (solo su hash). El vencimiento se calcula con el mismo
   * now() que `creado_en`: calculado en Node, con 30 minutos quedaría unos milisegundos por encima del CHECK de vigencia.
   */
  async reemplazarTokenRecuperacion(
    cliente: pg.PoolClient,
    datos: { idUsuario: number; tokenHash: string; minutos: number; ip?: string },
  ): Promise<void> {
    await cliente.query(
      'UPDATE token_recuperacion SET usado_en = now() WHERE id_usuario = $1 AND usado_en IS NULL',
      [datos.idUsuario],
    );
    await cliente.query(
      `INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en, ip)
       VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [datos.idUsuario, datos.tokenHash, datos.minutos, datos.ip ?? null],
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

  // ───────────────────────────────────────────────────────────── registro de accesos (032)
  async registrarEventoAcceso(evento: NuevoEventoAcceso): Promise<void> {
    await consultar(
      `INSERT INTO evento_acceso (id_usuario, correo, paso, exito, motivo, agente)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [evento.idUsuario, evento.correo?.slice(0, 120) ?? null, evento.paso, evento.motivo === 'OK', evento.motivo,
        evento.agente ?? null],
    );
  },

  /** Más recientes primero. `q` busca en el correo escrito y en el nombre de la cuenta. */
  async listarAccesos(filtro: FiltroAccesos): Promise<{ items: EventoAcceso[]; total: number }> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.soloFallidos) condiciones.push('NOT e.exito');
    if (filtro.q) {
      params.push(patronLike(filtro.q));
      condiciones.push(`(lower(e.correo) LIKE $${params.length} ESCAPE '\\'
        OR lower(concat_ws(' ', p.nombres, p.apellidos)) LIKE $${params.length} ESCAPE '\\')`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const desde = `FROM evento_acceso e
      LEFT JOIN usuario u ON u.id_usuario = e.id_usuario
      LEFT JOIN persona p ON p.id_persona = u.id_persona`;

    const { rows: [conteo] } = await consultar<{ total: number }>(`SELECT count(*)::int AS total ${desde} ${where}`, params);
    const { rows } = await consultar<{
      id: string; fecha: Date; idUsuario: number | null; nombre: string | null; correo: string | null;
      paso: PasoAcceso; exito: boolean; motivo: MotivoAcceso; agente: string | null;
    }>(
      `SELECT e.id_evento AS id, e.ocurrido_en AS fecha, u.id_usuario AS "idUsuario",
              concat_ws(' ', p.nombres, p.apellidos) AS nombre, COALESCE(e.correo, u.correo) AS correo,
              e.paso, e.exito, e.motivo, e.agente
         ${desde} ${where}
        ORDER BY e.ocurrido_en DESC, e.id_evento DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limite, (filtro.pagina - 1) * filtro.limite],
    );
    return {
      total: conteo?.total ?? 0,
      items: rows.map((f) => ({
        id: Number(f.id), fecha: f.fecha, correo: f.correo, paso: f.paso, exito: f.exito, motivo: f.motivo, agente: f.agente,
        usuario: f.idUsuario === null ? null : { id: f.idUsuario, nombre: f.nombre ?? '' },
      })),
    };
  },

  /** Cuentas con un bloqueo temporal vigente, la que vence antes primero. */
  async cuentasBloqueadas(): Promise<CuentaBloqueada[]> {
    const { rows } = await consultar<CuentaBloqueada>(
      `SELECT u.id_usuario AS "idUsuario", concat_ws(' ', p.nombres, p.apellidos) AS nombre, u.correo,
              u.intentos_fallidos AS "intentosFallidos", u.bloqueado_hasta AS "bloqueadoHasta"
         FROM usuario u JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.bloqueado_hasta > now()
        ORDER BY u.bloqueado_hasta, u.id_usuario
        LIMIT 200`,
    );
    return rows;
  },

  // ───────────────────────────────────────────────────────────── administración de una cuenta
  /**
   * Enlace de invitación (032): como uno de recuperación, pero vale hasta 72 horas. El vencimiento se calcula con el
   * mismo now() que `creado_en`: calcularlo en Node lo dejaría unos milisegundos por encima del CHECK de vigencia.
   */
  async crearInvitacion(cliente: pg.PoolClient, idUsuario: number, tokenHash: string, horas: number): Promise<Date> {
    const { rows } = await cliente.query<{ expiraEn: Date }>(
      `INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en, proposito)
       VALUES ($1, $2, now() + make_interval(hours => $3), 'INVITACION')
       RETURNING expira_en AS "expiraEn"`,
      [idUsuario, tokenHash, horas],
    );
    return rows[0]!.expiraEn;
  },

  /** Sesiones vigentes de la cuenta: una fila por familia (su token actual). */
  async sesionesActivas(idUsuario: number): Promise<SesionActiva[]> {
    const { rows } = await consultar<SesionActiva>(
      `SELECT familia AS id, iniciada_en AS "iniciadaEn", creado_en AS "renovadaEn", expira_en AS "expiraEn", agente
         FROM sesion
        WHERE id_usuario = $1 AND revocado_en IS NULL AND reemplazado_en IS NULL AND expira_en > now()
        ORDER BY creado_en DESC`,
      [idUsuario],
    );
    return rows;
  },

  /**
   * Sesiones abiertas de todas las cuentas, la renovada más recientemente primero. Una sesión es una familia con
   * su token vigente (ni revocado ni reemplazado ni vencido).
   */
  async listarSesionesActivas(filtro: FiltroSesiones): Promise<{ items: SesionActivaDeCuenta[]; total: number }> {
    const params: unknown[] = [];
    let buscar = '';
    if (filtro.q) {
      params.push(patronLike(filtro.q));
      buscar = `AND (lower(u.correo) LIKE $1 ESCAPE '\\' OR lower(concat_ws(' ', p.nombres, p.apellidos)) LIKE $1 ESCAPE '\\')`;
    }
    const desde = `FROM sesion s
      JOIN usuario u ON u.id_usuario = s.id_usuario
      JOIN persona p ON p.id_persona = u.id_persona
     WHERE s.revocado_en IS NULL AND s.reemplazado_en IS NULL AND s.expira_en > now() ${buscar}`;
    const { rows: [conteo] } = await consultar<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, params);
    const { rows } = await consultar<SesionActiva & {
      idUsuario: number; nombre: string; correo: string; roles: Rol[];
    }>(
      `SELECT s.familia AS id, s.iniciada_en AS "iniciadaEn", s.creado_en AS "renovadaEn", s.expira_en AS "expiraEn",
              s.agente, u.id_usuario AS "idUsuario", concat_ws(' ', p.nombres, p.apellidos) AS nombre, u.correo,
              ARRAY(SELECT r.nombre FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol
                     WHERE ur.id_usuario = u.id_usuario ORDER BY r.nombre) AS roles
         ${desde}
        ORDER BY s.creado_en DESC, s.id_sesion DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filtro.limite, (filtro.pagina - 1) * filtro.limite],
    );
    return {
      total: conteo?.total ?? 0,
      items: rows.map(({ idUsuario, nombre, correo, roles, ...s }) => ({
        ...s, usuario: { id: idUsuario, nombre, correo, roles },
      })),
    };
  },

  /** Revoca una sesión abierta (su familia) con el motivo ADMIN. Devuelve la cuenta, o null si no estaba abierta. */
  async revocarSesionAbierta(familia: string): Promise<number | null> {
    const { rows } = await consultar<{ idUsuario: number }>(
      `UPDATE sesion SET revocado_en = now(), motivo_revocacion = 'ADMIN'
        WHERE familia = $1 AND revocado_en IS NULL
          AND EXISTS (SELECT 1 FROM sesion v WHERE v.familia = $1 AND v.revocado_en IS NULL
                         AND v.reemplazado_en IS NULL AND v.expira_en > now())
        RETURNING id_usuario AS "idUsuario"`,
      [familia],
    );
    return rows[0]?.idUsuario ?? null;
  },

  /** Vencimiento de la invitación sin usar más reciente, o null si no hay ninguna vigente. */
  async invitacionPendiente(idUsuario: number): Promise<Date | null> {
    const { rows } = await consultar<{ expiraEn: Date }>(
      `SELECT max(expira_en) AS "expiraEn" FROM token_recuperacion
        WHERE id_usuario = $1 AND proposito = 'INVITACION' AND usado_en IS NULL AND expira_en > now()`,
      [idUsuario],
    );
    return rows[0]?.expiraEn ?? null;
  },

  /** Quita el bloqueo y reinicia los intentos. Devuelve false si la cuenta no existe. */
  async desbloquearCuenta(cliente: pg.PoolClient, idUsuario: number): Promise<boolean> {
    const { rowCount } = await cliente.query(
      'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = $1',
      [idUsuario],
    );
    return (rowCount ?? 0) > 0;
  },
};
