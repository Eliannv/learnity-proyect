import type { Request, Response } from 'express';
import { datosValidados } from '../../../shared/http/validar.js';
import { gruposService } from './grupos.service.js';

const ruta = (res: Response) => datosValidados<{ id: number; grupo: number }>(res).parametros;
export const gruposController = {
  async listar(req: Request, res: Response) {
    res.json(await gruposService.listar(ruta(res).id, req.usuario!));
  },
  async crear(req: Request, res: Response) {
    res.status(201).json(await gruposService.guardar(ruta(res).id, null, req.body, req.usuario!));
  },
  async editar(req: Request, res: Response) {
    const { id, grupo } = ruta(res);
    res.json(await gruposService.guardar(id, grupo, req.body, req.usuario!, req.body.revision));
  },
  async borrar(req: Request, res: Response) {
    const { id, grupo } = ruta(res);
    res.json(await gruposService.borrar(id, grupo, req.usuario!));
  },
};
