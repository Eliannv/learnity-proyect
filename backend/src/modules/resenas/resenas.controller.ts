import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DatosResena, PaginacionResenas } from './resenas.esquemas.js';
import { resenasService as service } from './resenas.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const resenasController = {
  async listar(_req: Request, res: Response): Promise<void> {
    const { parametros: id, consulta } = datosValidados<number, PaginacionResenas>(res);
    res.json(await service.listar(id, consulta));
  },
  async mia(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.mia(id, usuario(req)));
  },
  async guardar(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.guardar(id, req.body as DatosResena, usuario(req)));
  },
  async eliminar(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    await service.eliminar(id, usuario(req));
    res.status(204).end();
  },
};
