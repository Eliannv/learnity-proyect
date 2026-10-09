import type { Request, Response } from 'express';
import { z } from 'zod';
import { cursosService } from './cursos.service.js';

const repetible = <T extends z.ZodType>(elemento: T) => z.union([elemento, z.array(elemento).min(1).max(20)])
  .transform((valor) => Array.isArray(valor) ? valor : [valor]);

const filtros = z.strictObject({
  q: z.string().trim().max(100).optional(),
  categoria: repetible(z.string().min(1).max(80)).optional(),
  nivel: repetible(z.enum(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'])).optional(),
  orden: z.enum(['recientes', 'populares', 'az']).default('recientes'),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(9),
});

const idCurso = z.coerce.number().int().positive().safe();

export const cursosController = {
  async categorias(_req: Request, res: Response) {
    res.json(await cursosService.categoriasPublicas());
  },

  async catalogo(req: Request, res: Response) {
    const datos = filtros.parse(req.query);
    res.json(await cursosService.catalogoPublico({
      q: datos.q,
      categorias: datos.categoria ?? [],
      niveles: datos.nivel ?? [],
      orden: datos.orden,
      pagina: datos.pagina,
      limite: datos.limite,
    }));
  },

  async detalle(req: Request, res: Response) {
    const id = idCurso.parse(req.params['id']);
    res.json(await cursosService.detallePublico(id));
  },
};
