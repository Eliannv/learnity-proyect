import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type {
  AtencionAlerta, FiltroAccesosAdmin, FiltroAlertasAdmin, FiltroAuditoriaAdmin, FiltroSesionesAdmin, RevocacionSesion,
} from './supervision.esquemas.js';
import { supervisionService as service } from './supervision.service.js';

// Capa controller: recibe la petición ya validada, llama al service y responde.

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const supervisionController = {
  async accesos(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroAccesosAdmin>(res);
    res.json(await service.accesos(consulta));
  },

  async cuentasBloqueadas(_req: Request, res: Response): Promise<void> {
    res.json(await service.cuentasBloqueadas());
  },

  async auditoria(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroAuditoriaAdmin>(res);
    res.json(await service.auditoria(consulta));
  },

  async detalleAuditoria(_req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.detalleAuditoria(id));
  },

  async opcionesAuditoria(_req: Request, res: Response): Promise<void> {
    res.json(await service.opcionesAuditoria());
  },

  async estadoBaseDatos(_req: Request, res: Response): Promise<void> {
    res.json(await service.estadoBaseDatos());
  },

  async alertas(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroAlertasAdmin>(res);
    res.json(await service.alertas(consulta));
  },

  async analizarAlertas(req: Request, res: Response): Promise<void> {
    res.json(await service.analizarAlertas(usuario(req)));
  },

  async atenderAlerta(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.atenderAlerta(id, (req.body as AtencionAlerta).nota, usuario(req)));
  },

  async sesiones(req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroSesionesAdmin>(res);
    res.json(await service.sesiones(consulta, usuario(req)));
  },

  async revocarSesion(req: Request, res: Response): Promise<void> {
    const { parametros: id, consulta } = datosValidados<string, RevocacionSesion>(res);
    await service.revocarSesion(id, consulta.confirmoPropia, usuario(req));
    res.status(204).end();
  },
};
