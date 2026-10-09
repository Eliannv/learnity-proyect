import { AppError } from '../../shared/http/app-error.js';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import type {
  ActualizarPerfilDto,
  CambiarContrasenaDto,
  LoginDto,
  RecuperarDto,
  RegistroDto,
  RestablecerDto,
} from './identidad.esquemas.js';
import type { Perfil } from './identidad.repository.js';

// Capa service: reglas del negocio del módulo Identidad.
// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 1 · pendiente de implementar. Ya están listos para usar:
//   - identidadRepository (identidad.repository.ts): consultas a la base, probadas.
//   - enTransaccion (shared/database/pool.ts)
//   - cifrarContrasena / compararContrasena (shared/auth/contrasena.ts)
//   - firmarToken (shared/auth/jwt.ts)
// Cada método indica los pasos esperados. Mientras tanto responde 501.
// ─────────────────────────────────────────────────────────────────────────────

/** Respuesta de registro e inicio de sesión. El frontend ya espera exactamente esta forma. */
export interface RespuestaSesion {
  token: string;
  usuario: {
    idUsuario: number;
    idPersona: number;
    nombres: string;
    apellidos: string;
    correo: string;
    fotoUrl: string | null;
    roles: UsuarioSesion['roles'];
  };
}

/** Inicios de sesión fallidos seguidos antes del bloqueo temporal. */
export const MAX_INTENTOS = 5;
/** Minutos de bloqueo temporal. */
export const MINUTOS_BLOQUEO = 15;

export const identidadService = {
  /**
   * RF-01 · Registro.
   * 1. Si identidadRepository.existeCorreo(correo) → AppError.conflicto('Ese correo ya está registrado.').
   * 2. contrasenaHash = await cifrarContrasena(contrasena).
   * 3. En enTransaccion: identidadRepository.crearCuentaEstudiante(cliente, {...}).
   * 4. Devolver RespuestaSesion (roles: ['ESTUDIANTE']) con firmarToken(...).
   */
  async registrar(_datos: RegistroDto): Promise<RespuestaSesion> {
    throw AppError.pendiente('Registro');
  },

  /**
   * RF-02 · Inicio de sesión con bloqueo temporal.
   * 1. cuenta = identidadRepository.buscarCuentaPorCorreo(correo). Si no existe → 401 genérico
   *    ('Correo o contraseña incorrectos'), sin revelar si el correo existe.
   * 2. Si cuenta.estado === 'INACTIVO' → AppError.sinPermiso('Tu cuenta está desactivada.').
   * 3. Si cuenta.bloqueadoHasta > ahora → AppError(423, 'Cuenta bloqueada temporalmente…').
   * 4. Si !compararContrasena(...) → registrarIntentoFallido(idUsuario, MAX_INTENTOS, ahora + MINUTOS_BLOQUEO) y 401.
   * 5. registrarAccesoCorrecto(idUsuario) y devolver RespuestaSesion con firmarToken({ idUsuario, idPersona, correo, roles }).
   */
  async iniciarSesion(_datos: LoginDto): Promise<RespuestaSesion> {
    throw AppError.pendiente('Inicio de sesión');
  },

  /**
   * RF-06 · Recuperar contraseña (enlace por correo).
   * 1. Si el correo existe, firmar un token corto (ej. 30 min) con el idUsuario y enviarlo por correo.
   * 2. Responder SIEMPRE el mismo mensaje, exista o no el correo.
   */
  async solicitarRecuperacion(_datos: RecuperarDto): Promise<{ mensaje: string }> {
    throw AppError.pendiente('Recuperar contraseña');
  },

  /** RF-06 · Verificar el token del enlace y guardar la nueva contraseña con cifrarContrasena. */
  async restablecerContrasena(_datos: RestablecerDto): Promise<{ mensaje: string }> {
    throw AppError.pendiente('Restablecer contraseña');
  },

  /** RF-04 · Perfil del usuario autenticado: identidadRepository.obtenerPerfil(idUsuario). */
  async obtenerPerfil(_usuario: UsuarioSesion): Promise<Perfil> {
    throw AppError.pendiente('Ver perfil');
  },

  /** RF-04 · Actualizar nombres, apellidos, ciudad y biografía: identidadRepository.actualizarPersona. */
  async actualizarPerfil(_usuario: UsuarioSesion, _datos: ActualizarPerfilDto): Promise<Perfil> {
    throw AppError.pendiente('Editar perfil');
  },

  /** RF-04 · Cambiar contraseña: comparar la actual y guardar la nueva cifrada. */
  async cambiarContrasena(_usuario: UsuarioSesion, _datos: CambiarContrasenaDto): Promise<{ mensaje: string }> {
    throw AppError.pendiente('Cambiar contraseña');
  },
};
