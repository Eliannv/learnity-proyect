import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UsuarioSesion } from './tipos.js';

export function firmarToken(usuario: UsuarioSesion): string {
  return jwt.sign(usuario, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
}

/** Devuelve los datos del usuario si el token es válido; si no, lanza un error de jsonwebtoken. */
export function verificarToken(token: string): UsuarioSesion {
  const { idUsuario, idPersona, correo, roles } = jwt.verify(token, env.JWT_SECRET) as UsuarioSesion;
  return { idUsuario, idPersona, correo, roles };
}
