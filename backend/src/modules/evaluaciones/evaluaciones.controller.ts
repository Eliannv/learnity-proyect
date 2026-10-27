import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DatosIntento } from './evaluaciones.esquemas.js';
import { evaluacionesService } from './evaluaciones.service.js';

// Capa controller del módulo Evaluaciones: recibe la petición, llama al service y responde.

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const evaluacionesController = {
  async obtener(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await evaluacionesService.obtener(id, usuario(req)));
  },
  async responder(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.status(201).json(await evaluacionesService.responder(id, req.body as DatosIntento, usuario(req)));
  },
};
