import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Rutas de /api/auth que no llevan access token ni se reintentan (usan la cookie o credenciales). */
const SIN_TOKEN = /\/auth\/(login|registro|refresh|logout|recuperar|restablecer)$/;

/**
 * Agrega `Authorization: Bearer <access token>` a las peticiones de la API.
 * Si la API responde 401 (el token venció o la sesión se revocó), renueva la sesión una vez
 * con el refresh token (cookie) y repite la petición; si no se puede, pide iniciar sesión de nuevo.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(environment.apiUrl) || SIN_TOKEN.test(req.url) || auth.esDemo()) return next(req);

  const conToken = () => {
    const token = auth.token();
    return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  };
  const teniaSesion = auth.autenticado();

  return next(conToken()).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !teniaSesion) return throwError(() => error);
      return from(auth.renovar()).pipe(
        switchMap((renovada) => {
          if (renovada) return next(conToken());
          auth.sesionExpirada();
          return throwError(() => error);
        }),
      );
    }),
  );
};
