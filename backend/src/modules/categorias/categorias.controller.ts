import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DatosCategoria, DatosCategoriaNueva } from './categorias.esquemas.js';
import { categoriasService as service } from './categorias.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

export const categoriasController = {
  async listar(req: Request, res: Response): Promise<void> {
    res.json(await service.listar(usuario(req)));
  },
  async crear(req: Request, res: Response): Promise<void> {
    res.status(201).json(await service.crear(req.body as DatosCategoriaNueva, usuario(req)));
  },
  async actualizar(req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await service.actualizar(id, req.body as DatosCategoria, usuario(req)));
  },
};
