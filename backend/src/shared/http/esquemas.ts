import { z } from 'zod';

/**
 * Piezas de esquema compartidas por todos los módulos (ADR-006, ADR-011).
 */

/** Texto sin el carácter NUL: PostgreSQL lo rechaza (22021) y daría un 500 (ADR-011, 11.7). Encadenable: `textoSeguro().trim().max(80)`. */
export const textoSeguro = () => z.string().refine((valor) => !valor.includes('\u0000'), 'No puede contener caracteres nulos.');

/**
 * ID de ruta: solo dígitos decimales, de 1 a 2 147 483 647 (ADR-011, 11.11).
 * Rechaza `1e3`, `0x10`, ` 7 `, `7.0` y `007`, que `z.coerce.number()` aceptaba. Uso: `validarParametros(z.object({ id: idRuta }))`.
 */
export const idRuta = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/, 'Debe ser un entero positivo en decimal.')
  .transform(Number)
  .pipe(z.number().max(2_147_483_647, 'Es demasiado grande.'));
