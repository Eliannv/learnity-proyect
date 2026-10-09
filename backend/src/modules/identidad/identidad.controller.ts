import type { Request, Response } from 'express';
import { borrarCookiesSesion, emitirCookiesSesion, leerRefreshToken } from '../../shared/http/cookies-sesion.js';
import { type Contexto, type SesionEmitida, identidadService } from './identidad.service.js';

// Capa controller: recibe la petición ya validada, llama al service y responde.
// Sin SQL ni reglas del negocio. Aquí vive lo propio de HTTP: cookies y códigos de estado.
// Express 5 envía los errores async al manejador global.

function contexto(req: Request): Contexto {
  return { ip: req.ip, agente: req.get('user-agent')?.slice(0, 200) };
}

/** El refresh token viaja solo en la cookie HttpOnly; el cuerpo lleva el access token y el usuario. */
function responderSesion(res: Response, sesion: SesionEmitida, status = 200) {
  emitirCookiesSesion(res, sesion.refreshToken, sesion.refreshExpiraEn);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ accessToken: sesion.accessToken, expiraEn: sesion.accessExpiraEn, usuario: sesion.usuario });
}

export const identidadController = {
  async registrar(req: Request, res: Response) {
    responderSesion(res, await identidadService.registrar(req.body, contexto(req)), 201);
  },

  async iniciarSesion(req: Request, res: Response) {
    responderSesion(res, await identidadService.iniciarSesion(req.body, contexto(req)));
  },

  async refrescarSesion(req: Request, res: Response) {
    try {
      responderSesion(res, await identidadService.refrescarSesion(leerRefreshToken(req), contexto(req)));
    } catch (error) {
      // Sesión inválida o revocada: se borran las cookies para que el navegador no la siga enviando.
      if ((error as { status?: number }).status === 401) borrarCookiesSesion(res);
      throw error;
    }
  },

  async cerrarSesion(req: Request, res: Response) {
    await identidadService.cerrarSesion(leerRefreshToken(req), contexto(req));
    borrarCookiesSesion(res);
    res.status(204).end();
  },

  async solicitarRecuperacion(req: Request, res: Response) {
    res.status(202).json(await identidadService.solicitarRecuperacion(req.body, contexto(req)));
  },

  async restablecerContrasena(req: Request, res: Response) {
    const respuesta = await identidadService.restablecerContrasena(req.body, contexto(req));
    borrarCookiesSesion(res);
    res.json(respuesta);
  },

  async obtenerPerfil(req: Request, res: Response) {
    res.json(await identidadService.obtenerPerfil(req.usuario!));
  },

  async actualizarPerfil(req: Request, res: Response) {
    res.json(await identidadService.actualizarPerfil(req.usuario!, req.body));
  },

  async cambiarContrasena(req: Request, res: Response) {
    res.json(await identidadService.cambiarContrasena(req.usuario!, req.body, contexto(req)));
  },
};
