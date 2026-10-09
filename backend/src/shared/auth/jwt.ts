import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ROLES, type UsuarioSesion } from './tipos.js';

const OPCIONES = { algorithm: 'HS256', issuer: 'learnity-api', audience: 'learnity-web' } as const;

/** Access token: JWT breve (ACCESS_MINUTOS). El navegador lo guarda solo en memoria. */
export function firmarAccessToken(usuario: UsuarioSesion): { token: string; expiraEn: Date } {
  const token = jwt.sign(
    { idPersona: usuario.idPersona, correo: usuario.correo, roles: usuario.roles, sid: usuario.sid },
    env.JWT_SECRET,
    { ...OPCIONES, subject: String(usuario.idUsuario), expiresIn: env.ACCESS_MINUTOS * 60 },
  );
  return { token, expiraEn: new Date(Date.now() + env.ACCESS_MINUTOS * 60_000) };
}

/** Devuelve los datos del usuario si el token es válido; si no, lanza un error de jsonwebtoken. */
export function verificarAccessToken(token: string): UsuarioSesion {
  const datos = jwt.verify(token, env.JWT_SECRET, { ...OPCIONES, algorithms: [OPCIONES.algorithm] }) as jwt.JwtPayload;
  const idUsuario = Number(datos.sub);
  if (
    !Number.isInteger(idUsuario) ||
    typeof datos['sid'] !== 'string' ||
    !Array.isArray(datos['roles']) ||
    !datos['roles'].every((r: unknown) => (ROLES as readonly unknown[]).includes(r))
  ) {
    throw new Error('Token con datos incompletos');
  }
  return { idUsuario, idPersona: datos['idPersona'], correo: datos['correo'], roles: datos['roles'], sid: datos['sid'] };
}
