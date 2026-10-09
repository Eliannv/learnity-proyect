import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Agrega `Authorization: Bearer <token>` a las peticiones de la API.
 * Si la API responde 401 con una sesión real, la sesión expiró: se cierra.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const peticion = token && !auth.esDemo() ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && !auth.esDemo()) {
        auth.cerrarSesion();
      }
      return throwError(() => error);
    }),
  );
};
