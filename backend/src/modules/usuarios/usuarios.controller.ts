import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type {
  CambioEstadoUsuario,
  CambioRolesUsuario,
  DecisionSolicitud,
  FiltroSolicitudes,
  FiltroUsuariosAdmin,
  NuevaSolicitudDocente,
} from './usuarios.esquemas.js';
import { usuariosService as service } from './usuarios.service.js';

// Capa controller: recibe la petición ya validada, llama al service y responde.

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const usuariosController = {
  async solicitarDocencia(req: Request, res: Response): Promise<void> {
    res.status(201).json(await service.solicitarDocencia(usuario(req), req.body as NuevaSolicitudDocente));
  },

  async miSolicitud(req: Request, res: Response): Promise<void> {
    res.json({ solicitud: await service.miSolicitud(usuario(req)) });
  },

  async listarSolicitudes(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroSolicitudes>(res);
    res.json(await service.listarSolicitudes(consulta.estado));
  },

  async decidirSolicitud(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.decidirSolicitud(id, req.body as DecisionSolicitud, usuario(req)));
  },

  async listarUsuarios(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroUsuariosAdmin>(res);
    res.json(await service.listarUsuarios(consulta));
  },

  async cambiarEstado(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.cambiarEstado(id, req.body as CambioEstadoUsuario, usuario(req)));
  },

  async cambiarRoles(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.cambiarRoles(id, req.body as CambioRolesUsuario, usuario(req)));
  },
};
