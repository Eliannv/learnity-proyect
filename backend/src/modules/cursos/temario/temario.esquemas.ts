import { z } from 'zod';

export const datosModuloSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(10),
});

export type DatosModulo = z.infer<typeof datosModuloSchema>;

const datosDocumentoSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(12),
  tipo: z.literal('DOCUMENTO'),
});

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Acepta solo IDs y enlaces del proveedor conocido; nunca un iframe arbitrario. */
export function extraerYoutubeVideoId(entrada: string): string | null {
  if (VIDEO_ID.test(entrada)) return entrada;
  let url: URL;
  try { url = new URL(entrada); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  }
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) return null;
  if (url.pathname === '/watch') {
    const ids = url.searchParams.getAll('v');
    return ids.length === 1 && VIDEO_ID.test(ids[0]!) ? ids[0]! : null;
  }
  const match = /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
  return match?.[1] ?? null;
}

const datosVideoSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(12),
  tipo: z.literal('VIDEO'),
  youtubeUrl: z.string().trim().min(1).max(255).refine(
    (valor) => extraerYoutubeVideoId(valor) !== null,
    'Indica un enlace válido de YouTube o su ID.',
  ),
});

/** Las preguntas se guardan aparte, con `PUT /lecciones/:id/evaluacion`. */
const datosEvaluacionSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(12),
  tipo: z.literal('EVALUACION'),
});

export const datosLeccionSchema = z.discriminatedUnion('tipo', [
  datosDocumentoSchema, datosVideoSchema, datosEvaluacionSchema,
]);

export type DatosLeccion = z.infer<typeof datosLeccionSchema>;

export const LETRAS = ['A', 'B', 'C', 'D'] as const;
export const MIN_PREGUNTAS = 5;
export const MAX_PREGUNTAS = 10;

const textoSinNul = (maximo: number) => z.string().trim().min(1).max(maximo)
  .refine((valor) => !valor.includes('\u0000'), 'No puede contener caracteres nulos.');

/** Cuestionario completo: reemplaza las preguntas anteriores. Cuatro opciones A–D y una sola correcta. */
export const datosCuestionarioSchema = z.strictObject({
  preguntas: z.array(z.strictObject({
    enunciado: textoSinNul(300),
    opciones: z.array(textoSinNul(200)).length(4),
    correcta: z.enum(LETRAS),
  })).min(MIN_PREGUNTAS).max(MAX_PREGUNTAS),
});

export type DatosCuestionario = z.infer<typeof datosCuestionarioSchema>;
