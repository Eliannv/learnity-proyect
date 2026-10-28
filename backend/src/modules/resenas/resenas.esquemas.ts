import { z } from 'zod';
import { idRuta, textoSeguro } from '../../shared/http/esquemas.js';

export const idCursoResenas = z.object({ id: idRuta }).transform(({ id }) => id);

export const paginacionResenas = z.strictObject({
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

/** Comentario opcional: vacío o solo espacios se guarda como null. */
export const datosResena = z.strictObject({
  estrellas: z.number().int().min(1, 'Elige de 1 a 5 estrellas.').max(5, 'Elige de 1 a 5 estrellas.'),
  comentario: textoSeguro()
    .transform((valor) => valor.normalize('NFC').trim())
    .pipe(z.string().max(1000, 'El comentario debe tener como máximo 1000 caracteres.'))
    .nullish()
    .transform((valor) => valor || null),
});

export type PaginacionResenas = z.infer<typeof paginacionResenas>;
export type DatosResena = z.infer<typeof datosResena>;
