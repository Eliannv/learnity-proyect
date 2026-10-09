import type { Request, Response } from 'express';
import { identidadService } from './identidad.service.js';

// Capa controller: recibe la petición ya validada, llama al service y responde.
// Sin SQL ni reglas del negocio. Express 5 envía los errores async al manejador global.

export const identidadController = {
  async registrar(req: Request, res: Response) {
    res.status(201).json(await identidadService.registrar(req.body));
  },

  async iniciarSesion(req: Request, res: Response) {
    res.json(await identidadService.iniciarSesion(req.body));
  },

  async solicitarRecuperacion(req: Request, res: Response) {
    res.status(202).json(await identidadService.solicitarRecuperacion(req.body));
  },

  async restablecerContrasena(req: Request, res: Response) {
    res.json(await identidadService.restablecerContrasena(req.body));
  },

  async obtenerPerfil(req: Request, res: Response) {
    res.json(await identidadService.obtenerPerfil(req.usuario!));
  },

  async actualizarPerfil(req: Request, res: Response) {
    res.json(await identidadService.actualizarPerfil(req.usuario!, req.body));
  },

  async cambiarContrasena(req: Request, res: Response) {
    res.json(await identidadService.cambiarContrasena(req.usuario!, req.body));
  },
};
