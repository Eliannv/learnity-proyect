import { z } from 'zod';

/**
 * Piezas de esquema compartidas por todos los módulos (ADR-006, ADR-011).
 */

/** Texto sin el carácter NUL: PostgreSQL lo rechaza (22021) y daría un 500 (ADR-011, 11.7). Encadenable: `textoSeguro().trim().max(80)`. */
export const textoSeguro = () => z.string().refine((valor) => !valor.includes('\u0000'), 'No puede contener caracteres nulos.');
