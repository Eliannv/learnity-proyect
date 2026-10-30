import { z } from 'zod';

// Supervisión del administrador: registro de accesos (032), auditoría y sesiones abiertas (037).

export const filtroAccesos = z.strictObject({
  resultado: z.enum(['todos', 'fallidos']).default('todos'),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const consultaVacia = z.strictObject({});

const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess((v) => (v === '' ? undefined : v), esquema.optional());
const instante = z.iso.datetime({ offset: true, message: 'Usa una fecha y hora ISO 8601 con zona horaria.' });

/** Filtros del visor. `desde` es inclusivo y `hasta` exclusivo (el frontend manda la medianoche local del día siguiente). */
export const filtroAuditoria = z.strictObject({
  tabla: opcional(z.string().regex(/^[a-z_]{1,63}$/, 'Tabla inválida.')),
  operacion: opcional(z.enum(['INSERT', 'UPDATE', 'DELETE'])),
  usuarioBd: opcional(z.string().regex(/^[A-Za-z0-9_]{1,63}$/, 'Rol de base de datos inválido.')),
  actor: opcional(z.coerce.number().int().min(1).max(2_147_483_647)),
  desde: opcional(instante),
  hasta: opcional(instante),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
}).refine((f) => !f.desde || !f.hasta || new Date(f.desde) < new Date(f.hasta), {
  message: '«Desde» debe ser anterior a «Hasta».', path: ['hasta'],
});

/** ID de un registro de auditoría (BIGINT): solo dígitos decimales. */
export const idCambio = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,15}$/, 'Debe ser un entero positivo en decimal.').transform(Number),
}).transform(({ id }) => id);

export const filtroSesiones = z.strictObject({
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

/** El id de una sesión es su familia (UUID), que identifica la sesión a lo largo de sus renovaciones. */
export const idSesion = z.object({ id: z.uuid('Sesión inválida.') }).transform(({ id }) => id);

/** Cerrar la sesión propia exige confirmarlo: así no se cierra por accidente. */
export const revocacionSesion = z.strictObject({
  confirmoPropia: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export const filtroAlertas = z.strictObject({
  estado: z.enum(['pendientes', 'atendidas', 'todas']).default('pendientes'),
  /** recientes: la detectada más recientemente primero; antiguas: al revés. */
  orden: z.enum(['recientes', 'antiguas']).default('recientes'),
  severidad: opcional(z.enum(['ALTA', 'MEDIA', 'BAJA'])),
  tipo: opcional(z.enum(['INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA'])),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

export const idAlerta = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,15}$/, 'Debe ser un entero positivo en decimal.').transform(Number),
}).transform(({ id }) => id);

/** Nota opcional al marcar una alerta como atendida: vacía o solo espacios se guarda como null. */
export const atencionAlerta = z.strictObject({
  nota: z.string()
    .refine((v) => !v.includes('\u0000'), 'No puede contener caracteres nulos.')
    .transform((v) => v.normalize('NFC').trim())
    .pipe(z.string().max(300, 'La nota debe tener como máximo 300 caracteres.'))
    .nullish()
    .transform((v) => v || null),
});

export type FiltroAccesosAdmin = z.infer<typeof filtroAccesos>;
export type FiltroAlertasAdmin = z.infer<typeof filtroAlertas>;
export type AtencionAlerta = z.infer<typeof atencionAlerta>;
export type FiltroAuditoriaAdmin = z.infer<typeof filtroAuditoria>;
export type FiltroSesionesAdmin = z.infer<typeof filtroSesiones>;
export type RevocacionSesion = z.infer<typeof revocacionSesion>;
