import type { Request, Response } from 'express';
import { datosValidados } from '../../shared/http/validar.js';
import type { FiltroAccesosAdmin } from './supervision.esquemas.js';
import { supervisionService as service } from './supervision.service.js';

// Capa controller: recibe la petición ya validada, llama al service y responde.

export const supervisionController = {
  async accesos(_req: Request, res: Response): Promise<void> {
    const { consulta } = datosValidados<unknown, FiltroAccesosAdmin>(res);
    res.json(await service.accesos(consulta));
  },

  async cuentasBloqueadas(_req: Request, res: Response): Promise<void> {
    res.json(await service.cuentasBloqueadas());
  },
};
