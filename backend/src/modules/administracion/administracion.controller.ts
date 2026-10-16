import type {
  Request,
  Response,
} from 'express';

import type {
  UsuarioSesion,
} from '../../shared/auth/tipos.js';

import { AppError } from '../../shared/http/app-error.js';

import {
  administracionService as service,
} from './administracion.service.js';

import {
  identificador,
  filtroRevision,
  decisionRevision,
} from './administracion.esquemas.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }

  return req.usuario;
}

export const administracionController = {
  async listar(
    req: Request,
    res: Response,
  ): Promise<void> {
    filtroRevision.parse(req.query);

    const resultado = await service.listar(
      usuario(req),
    );

    res.json(resultado);
  },

  async detalle(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = identificador.parse(
      req.params.id,
    );

    const curso = await service.detalle(
      id,
      usuario(req),
    );

    res.json(curso);
  },

  async decidir(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = identificador.parse(
      req.params.id,
    );

    const datos = decisionRevision.parse(
      req.body,
    );

    const curso = await service.decidir(
      id,
      datos,
      usuario(req),
    );

    res.json(curso);
  },
};