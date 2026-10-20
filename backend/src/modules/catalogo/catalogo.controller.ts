import type { Request, Response } from 'express';
import { datosValidados } from '../../shared/http/validar.js';
import type { FiltrosCatalogoDto } from './catalogo.esquemas.js';
import { catalogoService } from './catalogo.service.js';

export const catalogoController = {
  async categorias(_req: Request, res: Response): Promise<void> {
    res.json(await catalogoService.categoriasPublicas());
  },

  async catalogo(_req: Request, res: Response): Promise<void> {
    const { consulta: datos } = datosValidados<unknown, FiltrosCatalogoDto>(res);
    res.json(
      await catalogoService.catalogoPublico({
        q: datos.q,
        categorias: datos.categoria ?? [],
        niveles: datos.nivel ?? [],
        orden: datos.orden,
        pagina: datos.pagina,
        limite: datos.limite,
      }),
    );
  },

  async detalle(_req: Request, res: Response): Promise<void> {
    const { parametros: id } = datosValidados<number>(res);
    res.json(await catalogoService.detallePublico(id));
  },
};
