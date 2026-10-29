import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DatosProgreso, PaginacionEstudiantes } from './aprendizaje.esquemas.js';
import { aprendizajeService } from './aprendizaje.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const aprendizajeController = {
  async inscribir(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    const resultado = await aprendizajeService.inscribir(id, usuario(req));
    res.status(resultado.creada ? 201 : 200).json(resultado.inscripcion);
  },
  async listar(req: Request, res: Response): Promise<void> {
    res.json(await aprendizajeService.listar(usuario(req)));
  },
  async detalle(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await aprendizajeService.detalle(id, usuario(req)));
  },
  async guardarProgreso(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await aprendizajeService.guardarProgreso(id, req.body as DatosProgreso, usuario(req)));
  },
  async seguimiento(req: Request, res: Response): Promise<void> {
    const { parametros: id, consulta } = datosValidados<number, PaginacionEstudiantes>(res);
    res.json(await aprendizajeService.seguimiento(id, consulta, usuario(req)));
  },

  async exportarEstudiantes(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    const { nombre, contenido } = await aprendizajeService.exportarEstudiantes(id, usuario(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(contenido);
  },
};
