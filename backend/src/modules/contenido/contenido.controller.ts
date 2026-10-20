import type { NextFunction, Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import { contenidoService as service } from './contenido.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

export const contenidoController = {
  async autorizarCarga(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    await service.verificarCarga(id, usuario(req));
    next();
  },

  async subir(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await service.subir(id, req.file, usuario(req));
    res.status(200).json(curso);
  },

  async descargar(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    const archivo = await service.descargar(id, usuario(req));

    res.setHeader('Cache-Control', 'private, no-store');
    res
      .type('application/pdf')
      .attachment(archivo.nombreOriginal)
      .send(archivo.bytes);
  },
};