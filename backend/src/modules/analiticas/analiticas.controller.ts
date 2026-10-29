import type { Request, Response } from 'express';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { FiltrosAnaliticas } from './analiticas.esquemas.js';
import { analiticasService as service } from './analiticas.service.js';

export const analiticasController = {
  async obtener(req: Request, res: Response): Promise<void> {
    if (!req.usuario) throw AppError.noAutenticado();
    const { consulta } = datosValidados<unknown, FiltrosAnaliticas>(res);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await service.obtener(consulta, req.usuario));
  },
};
