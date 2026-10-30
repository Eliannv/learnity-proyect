import { randomUUID } from 'node:crypto';
import { env } from '../../shared/config/env.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { enviarCorreo } from '../../shared/correo/correo.js';
import { cifrarContrasena, compararContrasena, hashSenuelo, requiereRecifrar } from '../../shared/auth/contrasena.js';
import { firmarAccessToken } from '../../shared/auth/jwt.js';
import { esTokenOpaco, generarTokenOpaco, hashToken } from '../../shared/auth/tokens.js';
import type { Rol, UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { ocultarCorreo, registrarEvento } from '../../shared/log/registro.js';
import { correoContrasenaCambiada, correoRecuperacion } from './identidad.correos.js';
import type {
  ActualizarPerfilDto,
  CambiarContrasenaDto,
  LoginDto,
  RecuperarDto,
  RegistroDto,
  RestablecerDto,
} from './identidad.esquemas.js';
import {
  type CuentaBloqueada,
  type CuentaConRoles,
  type EventoAcceso,
  type FiltroAccesos,
  type NuevoEventoAcceso,
  type Perfil,
  type SesionActiva,
  identidadRepository as repo,
} from './identidad.repository.js';
import { exigirContrasenaSegura } from './politica-contrasena.js';
import { almacenFotos } from '../../shared/archivos/fotos.js';
import type { PoolClient } from 'pg';

// Capa service: reglas del negocio del módulo Identidad (RF-01, RF-02, RF-04, RF-06).

/** Inicios de sesión fallidos seguidos antes del bloqueo temporal. */
export const MAX_INTENTOS = 5;
/** Minutos de bloqueo temporal. */
export const MINUTOS_BLOQUEO = 15;
/** Correos de recuperación por cuenta y hora (evita llenar el buzón de alguien). */
const MAX_RECUPERACIONES_HORA = 3;
/** Si dos pestañas refrescan a la vez, la segunda recibe 409 y reintenta en vez de cerrar la sesión. */
const GRACIA_ROTACION_MS = 20_000;

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MENSAJE_RECUPERACION = 'Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.';
const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IP y navegador de la petición: solo para auditoría. */
export interface Contexto {
  ip?: string;
  agente?: string;
}

export interface UsuarioPublico {
  idUsuario: number;
  idPersona: number;
  nombres: string;
  apellidos: string;
  correo: string;
  fotoUrl: string | null;
  roles: Rol[];
}

/** Lo que produce un inicio de sesión. El controller pone el refresh token en la cookie, nunca en el cuerpo. */
export interface SesionEmitida {
  accessToken: string;
  accessExpiraEn: Date;
  refreshToken: string;
  refreshExpiraEn: Date;
  usuario: UsuarioPublico;
}

const diasEnMs = (dias: number) => dias * 86_400_000;

function usuarioPublico(c: CuentaConRoles): UsuarioPublico {
  return {
    idUsuario: c.idUsuario,
    idPersona: c.idPersona,
    nombres: c.nombres,
    apellidos: c.apellidos,
    correo: c.correo,
    fotoUrl: c.fotoUrl,
    roles: c.roles,
  };
}

function emitirAccess(cuenta: CuentaConRoles, familia: string) {
  return firmarAccessToken({
    idUsuario: cuenta.idUsuario,
    idPersona: cuenta.idPersona,
    correo: cuenta.correo,
    roles: cuenta.roles,
    sid: familia,
  });
}

/** Abre una sesión nueva (familia nueva) y devuelve sus tokens. */
async function abrirSesion(cuenta: CuentaConRoles, ctx: Contexto): Promise<SesionEmitida> {
  const familia = randomUUID();
  const ahora = new Date();
  const refreshToken = generarTokenOpaco();
  const refreshExpiraEn = new Date(ahora.getTime() + diasEnMs(env.REFRESH_DIAS));
  await repo.crearSesion({
    idUsuario: cuenta.idUsuario,
    familia,
    tokenHash: hashToken(refreshToken),
    iniciadaEn: ahora,
    expiraEn: refreshExpiraEn,
    ip: ctx.ip,
    agente: ctx.agente,
  });
  const access = emitirAccess(cuenta, familia);
  return { accessToken: access.token, accessExpiraEn: access.expiraEn, refreshToken, refreshExpiraEn, usuario: usuarioPublico(cuenta) };
}

/** Tareas en segundo plano (envío de correos): la respuesta HTTP no las espera. */
const tareas = new Set<Promise<void>>();
function enSegundoPlano(nombre: string, trabajo: () => Promise<void>): void {
  const tarea = trabajo()
    .catch((error: unknown) => registrarEvento(`${nombre}_fallo`, { motivo: (error as Error).message }, 'error'))
    .finally(() => tareas.delete(tarea));
  tareas.add(tarea);
}

/**
 * Registro de accesos para el administrador (migración 032). Se espera en todos los caminos del login, así
 * no cambia la diferencia de tiempos entre ellos. Si la escritura falla, la operación sigue: queda en el log.
 */
async function anotarAcceso(evento: NuevoEventoAcceso): Promise<void> {
  try {
    await repo.registrarEventoAcceso(evento);
  } catch (error) {
    registrarEvento('acceso_no_registrado', { paso: evento.paso, motivo: (error as Error).message }, 'error');
  }
}

function avisarCambioContrasena(cuenta: CuentaConRoles): void {
  enSegundoPlano('aviso_contrasena', () =>
    enviarCorreo(
      correoContrasenaCambiada({
        para: cuenta.correo,
        nombres: cuenta.nombres,
        enlaceRecuperar: `${env.FRONTEND_URL}/recuperar-contrasena`,
      }),
    ),
  );
}

// Actor de la auditoría (`enTransaccion(..., { actor })`): las operaciones autenticadas y el restablecimiento
// de contraseña (el titular del token actúa sobre su propia cuenta) pasan el `idPersona`. El registro no lo
// pasa: la persona aún no existe cuando empieza la transacción. Rotar sesión y pedir recuperación solo
// tocan tablas sin auditoría.
export const identidadService = {
  /** RF-01 · Registro: toda cuenta nueva es Estudiante (RN-01) y entra con sesión abierta. */
  async registrar(datos: RegistroDto, ctx: Contexto): Promise<SesionEmitida> {
    await exigirContrasenaSegura(datos.contrasena, datos);
    if (await repo.existeCorreo(datos.correo)) {
      throw AppError.conflicto('Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.');
    }
    const contrasenaHash = await cifrarContrasena(datos.contrasena);
    let idUsuario: number;
    try {
      ({ idUsuario } = await enTransaccion((cliente) =>
        repo.crearCuentaEstudiante(cliente, {
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          correo: datos.correo,
          contrasenaHash,
        }),
      ));
    } catch (error) {
      // Dos registros simultáneos con el mismo correo: lo resuelve la restricción UNIQUE.
      if ((error as { code?: string }).code === '23505') throw AppError.conflicto('Ese correo ya está registrado.');
      throw error;
    }
    const cuenta = (await repo.buscarCuentaPorId(idUsuario))!;
    registrarEvento('registro', { idUsuario, ip: ctx.ip });
    return abrirSesion(cuenta, ctx);
  },

  /**
   * RF-02 · Inicio de sesión. Mensaje genérico para correo inexistente, contraseña errónea o cuenta bloqueada;
   * tras MAX_INTENTOS fallos seguidos, la cuenta se bloquea MINUTOS_BLOQUEO minutos (el límite por IP va en routes).
   */
  async iniciarSesion(datos: LoginDto, ctx: Contexto): Promise<SesionEmitida> {
    const cuenta = await repo.buscarCuentaPorCorreo(datos.correo);
    const acceso = (motivo: NuevoEventoAcceso['motivo']) =>
      anotarAcceso({ idUsuario: cuenta?.idUsuario ?? null, correo: datos.correo, paso: 'CLAVE', motivo, agente: ctx.agente });
    if (!cuenta) {
      await compararContrasena(datos.contrasena, await hashSenuelo); // mismo tiempo de respuesta
      registrarEvento('login_fallido', { motivo: 'correo_desconocido', correo: ocultarCorreo(datos.correo), ip: ctx.ip }, 'aviso');
      await acceso('CORREO_DESCONOCIDO');
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES, 'CREDENCIALES_INVALIDAS');
    }

    if (cuenta.bloqueadoHasta && cuenta.bloqueadoHasta > new Date()) {
      await compararContrasena(datos.contrasena, await hashSenuelo);
      registrarEvento('login_fallido', { motivo: 'cuenta_bloqueada', idUsuario: cuenta.idUsuario, ip: ctx.ip }, 'aviso');
      await acceso('CUENTA_BLOQUEADA');
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES, 'CREDENCIALES_INVALIDAS');
    }

    if (!(await compararContrasena(datos.contrasena, cuenta.contrasenaHash))) {
      const hasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60_000);
      const bloqueada = await repo.registrarIntentoFallido(cuenta.idUsuario, MAX_INTENTOS, hasta);
      registrarEvento('login_fallido', { motivo: 'contrasena', idUsuario: cuenta.idUsuario, ip: ctx.ip }, 'aviso');
      if (bloqueada) registrarEvento('cuenta_bloqueada', { idUsuario: cuenta.idUsuario, minutos: MINUTOS_BLOQUEO, ip: ctx.ip }, 'aviso');
      await acceso('CLAVE_INCORRECTA');
      throw AppError.noAutenticado(MENSAJE_CREDENCIALES, 'CREDENCIALES_INVALIDAS');
    }

    // Solo quien conoce la contraseña llega a saber que la cuenta está desactivada.
    if (cuenta.estado === 'INACTIVO') {
      registrarEvento('login_fallido', { motivo: 'cuenta_inactiva', idUsuario: cuenta.idUsuario, ip: ctx.ip }, 'aviso');
      await acceso('CUENTA_INACTIVA');
      throw AppError.sinPermiso('Tu cuenta está desactivada. Comunícate con la administración de Learnity.', 'CUENTA_INACTIVA');
    }

    await repo.registrarAccesoCorrecto(cuenta.idUsuario);
    await acceso('OK');
    if (requiereRecifrar(cuenta.contrasenaHash)) {
      await repo.actualizarContrasena(cuenta.idUsuario, await cifrarContrasena(datos.contrasena));
    }
    if (Math.random() < 0.02) enSegundoPlano('limpieza_sesiones', () => repo.limpiarVencidos());
    registrarEvento('login', { idUsuario: cuenta.idUsuario, ip: ctx.ip });
    return abrirSesion(cuenta, ctx);
  },

  /**
   * Rotación del refresh token: el token presentado se marca como reemplazado y se emite otro en la misma familia.
   * Presentar un token ya reemplazado (fuera del margen de pestañas simultáneas) indica robo: se revoca la familia.
   */
  async refrescarSesion(refreshToken: string | undefined, ctx: Contexto): Promise<SesionEmitida> {
    const sinSesion = () => AppError.noAutenticado('No hay una sesión activa.', 'SESION_INVALIDA');
    // Sin cookie (o con basura) no es un intento de entrar: es cualquier visitante que abre la web.
    if (!esTokenOpaco(refreshToken)) throw sinSesion();

    // De REFRESH solo se registran los fallos (D4): las renovaciones correctas ya quedan en `sesion`.
    const fallo = (idUsuario: number | null, motivo: NuevoEventoAcceso['motivo']) =>
      anotarAcceso({ idUsuario, correo: null, paso: 'REFRESH', motivo, agente: ctx.agente });

    const fila = await repo.buscarSesionPorHash(hashToken(refreshToken));
    if (!fila || fila.revocadoEn) {
      await fallo(fila?.idUsuario ?? null, 'TOKEN_INVALIDO');
      throw sinSesion();
    }

    if (fila.reemplazadoEn) {
      if (Date.now() - fila.reemplazadoEn.getTime() < GRACIA_ROTACION_MS) {
        throw AppError.conflicto('La sesión se está renovando en otra pestaña. Reintenta.', 'REFRESCO_CONCURRENTE');
      }
      await repo.revocarFamilia(fila.familia, 'REUTILIZACION');
      registrarEvento('refresh_reutilizado', { idUsuario: fila.idUsuario, ip: ctx.ip }, 'aviso');
      await fallo(fila.idUsuario, 'TOKEN_REUTILIZADO');
      throw sinSesion();
    }

    const ahora = Date.now();
    const limite = Math.min(ahora + diasEnMs(env.REFRESH_DIAS), fila.iniciadaEn.getTime() + diasEnMs(env.SESION_MAX_DIAS));
    if (fila.expiraEn.getTime() <= ahora || limite <= ahora) {
      await fallo(fila.idUsuario, 'TOKEN_INVALIDO');
      throw sinSesion();
    }

    const cuenta = await repo.buscarCuentaPorId(fila.idUsuario);
    if (!cuenta || cuenta.estado !== 'ACTIVO') {
      await repo.revocarFamilia(fila.familia, 'CUENTA_INACTIVA');
      await fallo(cuenta ? fila.idUsuario : null, 'CUENTA_INACTIVA');
      throw sinSesion();
    }

    const nuevo = generarTokenOpaco();
    const refreshExpiraEn = new Date(limite);
    const rotado = await enTransaccion(async (cliente) => {
      if (!(await repo.marcarReemplazada(fila.idSesion, cliente))) return false;
      await repo.crearSesion(
        {
          idUsuario: cuenta.idUsuario,
          familia: fila.familia,
          tokenHash: hashToken(nuevo),
          iniciadaEn: fila.iniciadaEn,
          expiraEn: refreshExpiraEn,
          ip: ctx.ip,
          agente: ctx.agente,
        },
        cliente,
      );
      return true;
    });
    if (!rotado) throw AppError.conflicto('La sesión se está renovando en otra pestaña. Reintenta.', 'REFRESCO_CONCURRENTE');

    // Los roles se leen de la base en cada renovación: un rol nuevo (p. ej. Docente) aplica sin volver a entrar.
    const access = emitirAccess(cuenta, fila.familia);
    return { accessToken: access.token, accessExpiraEn: access.expiraEn, refreshToken: nuevo, refreshExpiraEn, usuario: usuarioPublico(cuenta) };
  },

  /** Cierre de sesión real: revoca la familia del refresh token. Sin cookie, no hay nada que cerrar. */
  async cerrarSesion(refreshToken: string | undefined, ctx: Contexto): Promise<void> {
    if (!esTokenOpaco(refreshToken)) return;
    const fila = await repo.buscarSesionPorHash(hashToken(refreshToken));
    if (!fila) return;
    await repo.revocarFamilia(fila.familia, 'CIERRE');
    registrarEvento('logout', { idUsuario: fila.idUsuario, ip: ctx.ip });
  },

  /**
   * Lo usa `autenticar` en cada petición: el access token deja de valer si su sesión se revocó, y los roles
   * salen de la base (no del token), así un rol nuevo o retirado aplica de inmediato (ADR-011, 11.10).
   */
  async sesionVigente(usuario: UsuarioSesion): Promise<Rol[] | null> {
    return UUID.test(usuario.sid) ? repo.rolesDeSesionVigente(usuario.sid, usuario.idUsuario) : null;
  },

  /**
   * RF-06 · Recuperar contraseña. Responde siempre lo mismo y al instante, exista o no el correo:
   * la búsqueda y el envío ocurren en segundo plano, así el tiempo de respuesta tampoco delata la cuenta.
   */
  async solicitarRecuperacion(datos: RecuperarDto, ctx: Contexto): Promise<{ mensaje: string }> {
    enSegundoPlano('recuperacion', async () => {
      const cuenta = await repo.buscarCuentaPorCorreo(datos.correo);
      if (!cuenta || cuenta.estado !== 'ACTIVO') {
        registrarEvento('recuperacion_sin_cuenta', { correo: ocultarCorreo(datos.correo), ip: ctx.ip });
        return;
      }
      const token = generarTokenOpaco();
      const creado = await enTransaccion(async (cliente) => {
        const haceUnaHora = new Date(Date.now() - 3_600_000);
        if ((await repo.contarTokensRecuperacionDesde(cliente, cuenta.idUsuario, haceUnaHora)) >= MAX_RECUPERACIONES_HORA) {
          return false;
        }
        await repo.reemplazarTokenRecuperacion(cliente, {
          idUsuario: cuenta.idUsuario,
          tokenHash: hashToken(token),
          minutos: env.RECUPERACION_MINUTOS,
          ip: ctx.ip,
        });
        return true;
      });
      if (!creado) {
        registrarEvento('recuperacion_limitada', { idUsuario: cuenta.idUsuario, ip: ctx.ip }, 'aviso');
        return;
      }
      // El token va en el fragmento (#): el navegador no lo envía a ningún servidor ni en el Referer.
      await enviarCorreo(
        correoRecuperacion({
          para: cuenta.correo,
          nombres: cuenta.nombres,
          enlace: `${env.FRONTEND_URL}/restablecer-contrasena#token=${token}`,
          minutos: env.RECUPERACION_MINUTOS,
        }),
      );
      registrarEvento('recuperacion_enviada', { idUsuario: cuenta.idUsuario, ip: ctx.ip });
    });
    return { mensaje: MENSAJE_RECUPERACION };
  },

  /** RF-06 · Nueva contraseña con el enlace: un solo uso, con vencimiento, y cierra todas las sesiones anteriores. */
  async restablecerContrasena(datos: RestablecerDto, ctx: Contexto): Promise<{ mensaje: string }> {
    const invalido = () => AppError.solicitudInvalida(MENSAJE_ENLACE_INVALIDO, [{ campo: 'token', mensaje: MENSAJE_ENLACE_INVALIDO }]);
    const acceso = (idUsuario: number | null, correo: string | null, motivo: NuevoEventoAcceso['motivo']) =>
      anotarAcceso({ idUsuario, correo, paso: 'RECUPERACION', motivo, agente: ctx.agente });
    if (!esTokenOpaco(datos.token)) {
      await acceso(null, null, 'TOKEN_INVALIDO');
      throw invalido();
    }
    const vigente = await repo.buscarTokenRecuperacionVigente(hashToken(datos.token));
    if (!vigente) {
      registrarEvento('restablecer_rechazado', { ip: ctx.ip }, 'aviso');
      await acceso(null, null, 'TOKEN_INVALIDO');
      throw invalido();
    }
    const cuenta = await repo.buscarCuentaPorId(vigente.idUsuario);
    if (!cuenta || cuenta.estado !== 'ACTIVO') {
      await acceso(cuenta?.idUsuario ?? null, cuenta?.correo ?? null, 'CUENTA_INACTIVA');
      throw invalido();
    }

    await exigirContrasenaSegura(datos.contrasena, cuenta);
    const contrasenaHash = await cifrarContrasena(datos.contrasena);

    const revocadas = await enTransaccion(async (cliente) => {
      if (!(await repo.consumirTokenRecuperacion(cliente, vigente.idToken))) return null;
      await repo.actualizarContrasena(cuenta.idUsuario, contrasenaHash, cliente);
      await repo.invalidarTokensRecuperacion(cuenta.idUsuario, cliente);
      return repo.revocarSesionesUsuario(cuenta.idUsuario, 'RESTABLECIMIENTO', null, cliente);
   }, { actor: cuenta.idPersona });
    if (revocadas === null) { // otra petición usó el enlace primero
      await acceso(cuenta.idUsuario, cuenta.correo, 'TOKEN_INVALIDO');
      throw invalido();
    }

    registrarEvento('contrasena_restablecida', { idUsuario: cuenta.idUsuario, sesionesCerradas: revocadas, ip: ctx.ip });
    await acceso(cuenta.idUsuario, cuenta.correo, 'OK');
    avisarCambioContrasena(cuenta);
    return { mensaje: 'Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.' };
  },

  /** RF-04 · Perfil del usuario autenticado. */
  async obtenerPerfil(usuario: UsuarioSesion): Promise<Perfil> {
    const perfil = await repo.obtenerPerfil(usuario.idUsuario);
    if (!perfil) throw AppError.noEncontrado('La cuenta no existe.');
    return perfil;
  },

  /** RF-04 · Actualizar nombres, apellidos, ciudad y biografía (el correo no se cambia aquí). */
  async actualizarPerfil(usuario: UsuarioSesion, datos: ActualizarPerfilDto): Promise<Perfil> {
    await enTransaccion((cliente) => repo.actualizarPersona(usuario.idPersona, datos, cliente), {
      actor: usuario.idPersona,
    });
    registrarEvento('perfil_actualizado', { idUsuario: usuario.idUsuario });
    return this.obtenerPerfil(usuario);
  },

  /**
   * Foto de perfil: se guarda el archivo nuevo, se cambia la URL en una transacción y, ya confirmada,
   * se borra la foto anterior. Si la transacción falla, se borra la nueva.
   */
  async cambiarFoto(usuario: UsuarioSesion, bytes: Buffer | undefined): Promise<Perfil> {
    if (!bytes) {
      throw AppError.solicitudInvalida('Selecciona una foto.', [{ campo: 'foto', mensaje: 'El campo foto es obligatorio.' }]);
    }
    const nueva = await almacenFotos.guardar(bytes);
    let anterior: string | null;
    try {
      anterior = await enTransaccion((cliente) => repo.cambiarFoto(usuario.idPersona, nueva, cliente), {
        actor: usuario.idPersona,
      });
    } catch (error) {
      await almacenFotos.eliminarPorUrl(nueva).catch(() => undefined);
      throw error;
    }
    await almacenFotos.eliminarPorUrl(anterior).catch(() => registrarEvento('foto_anterior_sin_borrar', {}, 'aviso'));
    registrarEvento('foto_perfil_cambiada', { idUsuario: usuario.idUsuario });
    return this.obtenerPerfil(usuario);
  },

  async quitarFoto(usuario: UsuarioSesion): Promise<Perfil> {
    const anterior = await enTransaccion((cliente) => repo.cambiarFoto(usuario.idPersona, null, cliente), {
      actor: usuario.idPersona,
    });
    await almacenFotos.eliminarPorUrl(anterior).catch(() => registrarEvento('foto_anterior_sin_borrar', {}, 'aviso'));
    return this.obtenerPerfil(usuario);
  },

  /** RF-04 · Cambiar contraseña: exige la actual, aplica la política y cierra las demás sesiones. */
  async cambiarContrasena(usuario: UsuarioSesion, datos: CambiarContrasenaDto, ctx: Contexto): Promise<{ mensaje: string }> {
    const cuenta = await repo.buscarCuentaPorId(usuario.idUsuario);
    if (!cuenta) throw AppError.noAutenticado();
    if (!(await compararContrasena(datos.actual, cuenta.contrasenaHash))) {
      registrarEvento('cambio_contrasena_fallido', { idUsuario: cuenta.idUsuario, ip: ctx.ip }, 'aviso');
      const mensaje = 'La contraseña actual no es correcta.';
      throw AppError.solicitudInvalida(mensaje, [{ campo: 'actual', mensaje }]);
    }
    if (datos.actual === datos.nueva) {
      const mensaje = 'La nueva contraseña debe ser distinta de la actual.';
      throw AppError.solicitudInvalida(mensaje, [{ campo: 'nueva', mensaje }]);
    }
    await exigirContrasenaSegura(datos.nueva, cuenta);

    const contrasenaHash = await cifrarContrasena(datos.nueva);
    const revocadas = await enTransaccion(async (cliente) => {
      await repo.actualizarContrasena(cuenta.idUsuario, contrasenaHash, cliente);
      await repo.invalidarTokensRecuperacion(cuenta.idUsuario, cliente);
      return repo.revocarSesionesUsuario(cuenta.idUsuario, 'CAMBIO_CONTRASENA', usuario.sid, cliente);
   }, { actor: usuario.idPersona });
    registrarEvento('contrasena_cambiada', { idUsuario: cuenta.idUsuario, sesionesCerradas: revocadas, ip: ctx.ip });
    avisarCambioContrasena(cuenta);
    return { mensaje: 'Tu contraseña se actualizó. Cerramos tus sesiones en otros dispositivos.' };
  },

  /** Para pruebas y para el cierre ordenado: espera los correos en curso. */
  async esperarTareas(): Promise<void> {
    await Promise.all([...tareas]);
  },
};

/** Lo único del servicio que ven `app.ts`, `server.ts` y otros módulos (vía `index.ts`). */
export interface ServicioIdentidad {
  /** Roles actuales si la sesión del access token sigue vigente (no revocada y cuenta activa); `null` si no. */
  sesionVigente(usuario: UsuarioSesion): Promise<Rol[] | null>;
  /** Espera los correos en segundo plano: cierre ordenado y pruebas. */
  esperarTareas(): Promise<void>;
  /** Cierra todas las sesiones de una cuenta desactivada, dentro de la transacción de quien la desactiva. */
  revocarSesionesDeCuentaInactiva(idUsuario: number, cliente: PoolClient): Promise<void>;
  /** Registro de accesos del panel del administrador (032), más recientes primero. */
  listarAccesos(filtro: FiltroAccesos): Promise<{ items: EventoAcceso[]; total: number }>;
  /** Cuentas con un bloqueo temporal vigente por intentos fallidos. */
  cuentasBloqueadas(): Promise<CuentaBloqueada[]>;
  /** Quita el bloqueo y reinicia los intentos, dentro de la transacción (auditada) del administrador. false si no existe. */
  desbloquearCuenta(idUsuario: number, cliente: PoolClient): Promise<boolean>;
  existeCorreo(correo: string): Promise<boolean>;
  /**
   * Alta por un administrador (D1): persona, usuario y rol Estudiante con una contraseña aleatoria que nadie conoce,
   * y un enlace de invitación de HORAS_INVITACION horas para que la persona cree la suya. Dentro de la transacción
   * del administrador. Devuelve el token en claro solo para enviarlo por correo; en la base queda su hash.
   */
  crearCuentaInvitada(
    cliente: PoolClient,
    datos: { nombres: string; apellidos: string; correo: string },
  ): Promise<{ idPersona: number; idUsuario: number; token: string; expiraEn: Date }>;
  sesionesActivas(idUsuario: number): Promise<SesionActiva[]>;
  /** Vencimiento de la invitación sin usar, o null. */
  invitacionPendiente(idUsuario: number): Promise<Date | null>;
  /** Cierra todas las sesiones abiertas de la cuenta con el motivo ADMIN. Devuelve cuántas cerró. */
  cerrarSesionesPorAdmin(idUsuario: number): Promise<number>;
}

/** Validez del enlace de invitación (migración 032: como mucho 72 horas). */
export const HORAS_INVITACION = 72;

export const identidadApi: ServicioIdentidad = {
  sesionVigente: (usuario) => identidadService.sesionVigente(usuario),
  esperarTareas: () => identidadService.esperarTareas(),
  async revocarSesionesDeCuentaInactiva(idUsuario, cliente) {
    await repo.revocarSesionesUsuario(idUsuario, 'CUENTA_INACTIVA', null, cliente);
  },
  listarAccesos: (filtro) => repo.listarAccesos(filtro),
  cuentasBloqueadas: () => repo.cuentasBloqueadas(),
  desbloquearCuenta: (idUsuario, cliente) => repo.desbloquearCuenta(cliente, idUsuario),
  existeCorreo: (correo) => repo.existeCorreo(correo),
  async crearCuentaInvitada(cliente, datos) {
    const contrasenaHash = await cifrarContrasena(generarTokenOpaco());
    const { idPersona, idUsuario } = await repo.crearCuentaEstudiante(cliente, { ...datos, contrasenaHash });
    const token = generarTokenOpaco();
    const expiraEn = await repo.crearInvitacion(cliente, idUsuario, hashToken(token), HORAS_INVITACION);
    return { idPersona, idUsuario, token, expiraEn };
  },
  sesionesActivas: (idUsuario) => repo.sesionesActivas(idUsuario),
  invitacionPendiente: (idUsuario) => repo.invitacionPendiente(idUsuario),
  cerrarSesionesPorAdmin: (idUsuario) => repo.revocarSesionesUsuario(idUsuario, 'ADMIN'),
};
