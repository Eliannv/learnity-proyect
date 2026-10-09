import type { RequestHandler } from 'express';
import { AppError } from '../http/app-error.js';
import { verificarToken } from './jwt.js';
import type { Rol } from './tipos.js';

/** Exige el encabezado `Authorization: Bearer <token>` y deja los datos en `req.usuario`. */
export const autenticar: RequestHandler = (req, _res, next) => {
  const encabezado = req.headers.authorization ?? '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw AppError.noAutenticado();
  }
  try {
    req.usuario = verificarToken(token);
  } catch {
    throw AppError.noAutenticado('Tu sesión expiró o no es válida. Inicia sesión otra vez.');
  }
  next();
};

/**
 * Permite el paso solo a quien tenga alguno de los roles indicados.
 * Uso: router.get('/admin/usuarios', autenticar, autorizar('ADMIN'), controller.listar)
 */
export function autorizar(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) throw AppError.noAutenticado();
    if (!req.usuario.roles.some((rol) => roles.includes(rol))) throw AppError.sinPermiso();
    next();
  };
}
