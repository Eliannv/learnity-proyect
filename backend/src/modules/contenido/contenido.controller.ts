import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import { z } from 'zod';

import type {
  UsuarioSesion,
} from '../../shared/auth/tipos.js';

import { AppError } from '../../shared/http/app-error.js';

import {
  contenidoService as service,
} from './contenido.service.js';

const identificador = z.coerce
  .number()
  .int()
  .min(1)
  .max(2_147_483_647);

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }

  return req.usuario;
}

export const contenidoController = {
  async autorizarCarga(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const id = identificador.parse(
      req.params.id,
    );

    await service.verificarCarga(
      id,
      usuario(req),
    );

    next();
  },

  async subir(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = identificador.parse(
      req.params.id,
    );

    const curso = await service.subir(
      id,
      req.file,
      usuario(req),
    );

    res.status(200).json(curso);
  },

  async descargar(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = identificador.parse(
      req.params.id,
    );

    const archivo = await service.descargar(
      id,
      usuario(req),
    );

    res.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    res
      .type('application/pdf')
      .attachment(archivo.nombreOriginal)
      .send(archivo.bytes);
  },
};