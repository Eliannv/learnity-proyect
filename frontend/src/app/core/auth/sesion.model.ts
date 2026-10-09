/** Roles de Learnity. Son acumulativos: toda cuenta tiene ESTUDIANTE. */
export type Rol = 'ESTUDIANTE' | 'DOCENTE' | 'ADMIN';

/** Usuario que devuelve la API al abrir o renovar la sesión (ver /api/docs). */
export interface UsuarioSesion {
  idUsuario: number;
  idPersona: number;
  nombres: string;
  apellidos: string;
  correo: string;
  fotoUrl: string | null;
  roles: Rol[];
}

/**
 * Respuesta de POST /api/auth/login, /registro y /refresh.
 * El refresh token NO llega aquí: queda en una cookie HttpOnly que JavaScript no puede leer.
 */
export interface RespuestaSesion {
  accessToken: string;
  expiraEn: string;
  usuario: UsuarioSesion;
}

/** Sesión en memoria (nunca en localStorage). `demo` indica una sesión simulada sin backend. */
export interface Sesion extends RespuestaSesion {
  demo?: boolean;
}

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
}

/** GET/PUT /api/perfil */
export interface Perfil extends UsuarioSesion {
  ciudad: string | null;
  biografia: string | null;
  creadoEn: string;
}
