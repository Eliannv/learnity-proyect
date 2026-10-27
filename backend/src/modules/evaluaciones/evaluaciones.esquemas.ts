import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

export const idEvaluacionRuta = z.object({ id: idRuta }).transform(({ id }) => id);

/** Una respuesta por pregunta; el servidor califica, nunca acepta un puntaje del navegador. */
export const datosIntentoSchema = z.strictObject({
  respuestas: z.array(z.strictObject({
    preguntaId: z.number().int().positive().max(2_147_483_647),
    opcion: z.enum(['A', 'B', 'C', 'D']),
  })).min(1).max(10),
});

export type DatosIntento = z.infer<typeof datosIntentoSchema>;
