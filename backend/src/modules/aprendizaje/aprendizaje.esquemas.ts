import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

export const idAprendizajeRuta = z.object({ id: idRuta }).transform(({ id }) => id);

export const progresoLeccionSchema = z.strictObject({
  segundosVistos: z.number().int().min(0).max(86_400).optional(),
  completada: z.boolean().optional(),
}).refine((valor) => valor.segundosVistos !== undefined || valor.completada !== undefined, {
  message: 'Indica la posición o si la lección está completada.',
});

export const paginacionEstudiantesSchema = z.strictObject({
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export const filtrosEstudiantesDocenteSchema = z.strictObject({
  curso: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export type DatosProgreso = z.infer<typeof progresoLeccionSchema>;
export type PaginacionEstudiantes = z.infer<typeof paginacionEstudiantesSchema>;
export type FiltrosEstudiantesDocente = z.infer<typeof filtrosEstudiantesDocenteSchema>;
