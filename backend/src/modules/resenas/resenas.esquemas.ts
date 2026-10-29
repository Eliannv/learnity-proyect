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

// ------------------------------------------------------------------ docente

const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess((v) => (v === '' ? undefined : v), esquema.optional());

export const idResena = z.object({ id: idRuta }).transform(({ id }) => id);

export const filtrosBandeja = z.strictObject({
  curso: opcional(z.coerce.number().int().min(1).max(2_147_483_647)),
  estrellas: opcional(z.coerce.number().int().min(1).max(5)),
  comentario: opcional(z.enum(['con', 'sin'])),
  respuesta: opcional(z.enum(['respondidas', 'sin-responder'])),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

export const datosRespuesta = z.strictObject({
  texto: textoSeguro()
    .transform((valor) => valor.normalize('NFC').trim())
    .pipe(z.string().min(1, 'Escribe tu respuesta.').max(1000, 'La respuesta debe tener como máximo 1000 caracteres.')),
});

export const datosReporte = z.strictObject({
  motivo: z.enum(['SPAM', 'OFENSIVO', 'OTRO'], { message: 'Elige el motivo del reporte.' }),
  detalle: textoSeguro()
    .transform((valor) => valor.normalize('NFC').trim())
    .pipe(z.string().max(500, 'El detalle debe tener como máximo 500 caracteres.'))
    .nullish()
    .transform((valor) => valor || null),
});

// ------------------------------------------------------------ administrador

export const filtrosReportes = z.strictObject({
  estado: z.enum(['PENDIENTE', 'OCULTADA', 'DESESTIMADA']).default('PENDIENTE'),
});

export const filtrosResenasAdmin = z.strictObject({
  estado: z.enum(['vigentes', 'borradas', 'todas']).default('todas'),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export const decisionReporte = z.strictObject({
  decision: z.enum(['OCULTAR', 'DESESTIMAR'], { message: 'Elige ocultar la reseña o desestimar el reporte.' }),
});

export type FiltrosBandeja = z.infer<typeof filtrosBandeja>;
export type DatosRespuesta = z.infer<typeof datosRespuesta>;
export type DatosReporte = z.infer<typeof datosReporte>;
export type FiltrosReportes = z.infer<typeof filtrosReportes>;
export type FiltrosResenasAdmin = z.infer<typeof filtrosResenasAdmin>;
export type DecisionReporte = z.infer<typeof decisionReporte>;
