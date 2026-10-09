/** Roles de la aplicación (tabla rol). Son acumulativos: toda cuenta tiene ESTUDIANTE. */
export const ROLES = ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

/** Datos que viajan dentro del access token (JWT). */
export interface UsuarioSesion {
  idUsuario: number;
  idPersona: number;
  correo: string;
  roles: Rol[];
  /** Familia de la sesión (tabla sesion). Permite revocar el access token antes de que venza. */
  sid: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Lo completa el middleware `autenticar` cuando el token es válido. */
      usuario?: UsuarioSesion;
    }
  }
}
