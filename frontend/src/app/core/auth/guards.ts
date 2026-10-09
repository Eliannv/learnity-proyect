import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import type { Rol } from './sesion.model';

/** Solo usuarios con sesión. Si no, lleva al login y recuerda a dónde quería ir. */
export const autenticadoGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.autenticado()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

/** Solo usuarios con el rol indicado. Si no lo tienen, van a su pantalla de inicio. */
export function rolGuard(rol: Rol): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.autenticado()) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
    return auth.tieneRol(rol) ? true : router.parseUrl(auth.rutaInicio());
  };
}

/** Login, registro y recuperar contraseña: si ya hay sesión, no tiene sentido mostrarlos. */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? inject(Router).parseUrl(auth.rutaInicio()) : true;
};

/** /perfil es el perfil del Estudiante; Docente y Administrador editan el suyo dentro de su panel. */
export const perfilEstudianteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.rutaPerfil() === '/perfil' ? true : inject(Router).parseUrl(auth.rutaPerfil());
};

/** La ruta solo coincide si hay sesión (el inicio "/" muestra una página distinta al visitante). */
export const conSesionMatch: CanMatchFn = () => inject(AuthService).autenticado();
