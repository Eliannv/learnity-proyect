/** Roles de Learnity. Son acumulativos: toda cuenta tiene ESTUDIANTE. */
export type Rol = 'ESTUDIANTE' | 'DOCENTE' | 'ADMIN';

/** Usuario que devuelve la API en registro e inicio de sesión (ver /api/docs). */
export interface UsuarioSesion {
  idUsuario: number;
  idPersona: number;
  nombres: string;
  apellidos: string;
  correo: string;
  fotoUrl: string | null;
  roles: Rol[];
}

/** Respuesta de POST /api/auth/login y POST /api/auth/registro. */
export interface RespuestaSesion {
  token: string;
  usuario: UsuarioSesion;
}

/** Sesión guardada en el navegador. `demo` indica que no viene del backend. */
export interface Sesion extends RespuestaSesion {
  demo?: boolean;
}

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
}
