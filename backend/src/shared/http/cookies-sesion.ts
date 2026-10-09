import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { firmarHmac, generarTokenOpaco, hashToken, igualesSeguro } from '../auth/tokens.js';
import { registrarEvento } from '../log/registro.js';
import { AppError } from './app-error.js';

/**
 * Cookies de la sesión:
 *  - learnity_rt: refresh token opaco. HttpOnly (JavaScript no la lee), SameSite=Lax y solo viaja a /api/auth.
 *  - XSRF-TOKEN: token CSRF legible por Angular, que lo devuelve en el encabezado X-XSRF-TOKEN
 *    (doble envío firmado: el valor está ligado con HMAC al refresh token de esa sesión).
 * `Secure` depende de COOKIE_SECURE: obligatorio en producción (HTTPS); en desarrollo local por HTTP va en false.
 */
export const COOKIE_REFRESH = 'learnity_rt';
export const COOKIE_CSRF = 'XSRF-TOKEN';
export const ENCABEZADO_CSRF = 'x-xsrf-token';

const base = (): CookieOptions => ({ secure: env.COOKIE_SECURE, sameSite: 'lax' });
const opcionesRefresh = (): CookieOptions => ({ ...base(), httpOnly: true, path: '/api/auth' });
const opcionesCsrf = (): CookieOptions => ({ ...base(), httpOnly: false, path: '/' });

function firmaCsrf(nonce: string, refreshToken: string): string {
  return firmarHmac(env.JWT_SECRET, `csrf:${nonce}:${hashToken(refreshToken)}`);
}

export function emitirCookiesSesion(res: Response, refreshToken: string, expiraEn: Date): void {
  const nonce = generarTokenOpaco();
  res.cookie(COOKIE_REFRESH, refreshToken, { ...opcionesRefresh(), expires: expiraEn });
  res.cookie(COOKIE_CSRF, `${nonce}.${firmaCsrf(nonce, refreshToken)}`, { ...opcionesCsrf(), expires: expiraEn });
}

export function borrarCookiesSesion(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, opcionesRefresh());
  res.clearCookie(COOKIE_CSRF, opcionesCsrf());
}

export function leerRefreshToken(req: Request): string | undefined {
  const valor: unknown = req.cookies?.[COOKIE_REFRESH];
  return typeof valor === 'string' && valor ? valor : undefined;
}

/**
 * Rechaza peticiones que vienen de otro sitio. Los navegadores envían Origin en los POST;
 * los clientes sin navegador (pruebas, curl) no lo envían y siguen sujetos al resto de controles.
 */
export const verificarOrigen: RequestHandler = (req, _res, next) => {
  const origen = req.get('origin');
  const sitio = req.get('sec-fetch-site');
  if ((origen && !env.ORIGENES.includes(origen)) || sitio === 'cross-site') {
    registrarEvento('origen_rechazado', { ruta: req.path, origen, ip: req.ip }, 'aviso');
    throw AppError.sinPermiso('Origen no permitido.', 'ORIGEN_NO_PERMITIDO');
  }
  next();
};

/**
 * Protección CSRF de las rutas que se autentican con la cookie (refrescar y cerrar sesión).
 * Si no hay cookie de sesión no hay nada que proteger: el controller responde como sin sesión.
 */
export const exigirCsrf: RequestHandler = (req, _res, next) => {
  const refresh = leerRefreshToken(req);
  if (!refresh) return next();
  const encabezado = req.get(ENCABEZADO_CSRF) ?? '';
  const cookie: unknown = req.cookies?.[COOKIE_CSRF];
  const [nonce = '', firma = ''] = encabezado.split('.');
  const valido =
    typeof cookie === 'string' &&
    igualesSeguro(encabezado, cookie) &&
    nonce.length > 0 &&
    igualesSeguro(firma, firmaCsrf(nonce, refresh));
  if (!valido) {
    registrarEvento('csrf_rechazado', { ruta: req.path, ip: req.ip }, 'aviso');
    throw AppError.sinPermiso('La solicitud no se pudo verificar. Recarga la página.', 'CSRF_INVALIDO');
  }
  next();
};
