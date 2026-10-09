import type { RequestHandler } from 'express';
import { AppError } from '../http/app-error.js';
import { verificarAccessToken } from './jwt.js';
import type { Rol, UsuarioSesion } from './tipos.js';

/**
 * Comprueba que la sesión del token siga vigente (no se cerró ni se revocó por un cambio de contraseña).
 * Lo registra el módulo Identidad al armar la aplicación: así `shared` no depende de un módulo.
 */
type VerificadorSesion = (usuario: UsuarioSesion) => Promise<boolean>;
let verificadorSesion: VerificadorSesion | null = null;

export function registrarVerificadorSesion(verificador: VerificadorSesion): void {
  verificadorSesion = verificador;
}

/** Exige el encabezado `Authorization: Bearer <token>` y deja los datos en `req.usuario`. */
export const autenticar: RequestHandler = async (req, _res, next) => {
  const encabezado = req.headers.authorization ?? '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw AppError.noAutenticado();
  }
  let usuario: UsuarioSesion;
  try {
    usuario = verificarAccessToken(token);
  } catch {
    throw AppError.noAutenticado('Tu sesión expiró o no es válida.', 'TOKEN_INVALIDO');
  }
  if (!verificadorSesion || !(await verificadorSesion(usuario))) {
    throw AppError.noAutenticado('Tu sesión se cerró. Inicia sesión otra vez.', 'SESION_REVOCADA');
  }
  req.usuario = usuario;
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
