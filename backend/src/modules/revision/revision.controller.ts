import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DecisionRevisionDto } from './revision.esquemas.js';
import { revisionService as service } from './revision.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

export const revisionController = {
  async listar(req: Request, res: Response): Promise<void> {
    res.json(await service.listar(usuario(req)));
  },

  async detalle(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.detalle(id, usuario(req)));
  },

  async decidir(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.decidir(id, req.body as DecisionRevisionDto, usuario(req)));
  },
};
