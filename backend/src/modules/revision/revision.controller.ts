import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DecisionRevisionDto, FiltroRevision, SuspensionCursoDto } from './revision.esquemas.js';
import { revisionService as service } from './revision.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

export const revisionController = {
  async listar(req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroRevision>(res);
    res.json(await service.listar(usuario(req), consulta.estado));
  },

  async suspender(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.suspender(id, req.body as SuspensionCursoDto, usuario(req)));
  },

  async reactivar(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.reactivar(id, usuario(req)));
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
