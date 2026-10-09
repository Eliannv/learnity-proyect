/** Roles de la aplicación (tabla rol). Son acumulativos: toda cuenta tiene ESTUDIANTE. */
export const ROLES = ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

/** Datos que viajan dentro del token JWT. */
export interface UsuarioSesion {
  idUsuario: number;
  idPersona: number;
  correo: string;
  roles: Rol[];
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
