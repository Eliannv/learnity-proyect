import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type {
  DatosReporte, DatosResena, DatosRespuesta, DecisionReporte, FiltrosBandeja, FiltrosReportes, FiltrosResenasAdmin,
  PaginacionResenas,
} from './resenas.esquemas.js';
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

  async bandeja(req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltrosBandeja>(res);
    res.json(await service.bandeja(consulta, usuario(req)));
  },
  async valoracion(req: Request, res: Response): Promise<void> {
    res.json(await service.valoracion(usuario(req)));
  },
  async responder(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.responder(id, req.body as DatosRespuesta, usuario(req)));
  },
  async retirarRespuesta(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.responder(id, null, usuario(req)));
  },
  async reportar(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.status(201).json(await service.reportar(id, req.body as DatosReporte, usuario(req)));
  },
  async todas(req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltrosResenasAdmin>(res);
    res.json(await service.todas(consulta, usuario(req)));
  },
  async reportes(req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltrosReportes>(res);
    res.json(await service.reportes(consulta, usuario(req)));
  },
  async resolverReporte(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    await service.resolverReporte(id, req.body as DecisionReporte, usuario(req));
    res.status(204).end();
  },
  async historial(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.historial(id, usuario(req)));
  },
};
