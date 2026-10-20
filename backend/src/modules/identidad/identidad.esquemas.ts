import { z } from 'zod';
import { MAX_BYTES_BCRYPT } from '../../shared/auth/contrasena.js';
import { textoSeguro } from '../../shared/http/esquemas.js';

// Esquemas de entrada (DTO) del módulo Identidad. Se validan en routes con `validarCuerpo`.

/** Mínimo de caracteres de la política (sin reglas de composición; ver politica-contrasena.ts). */
export const MIN_CARACTERES_CONTRASENA = 15;

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Correo no válido').max(120, 'El correo es demasiado largo'));

/** Unicode normalizado (NFKC) para que la misma contraseña escrita en otro teclado coincida. */
const texto = z.string().transform((s) => s.normalize('NFKC'));

/** Contraseña nueva: misma política que el frontend (shared/validadores/contrasena.ts). */
const contrasenaNueva = texto
  .refine((s) => Array.from(s).length >= MIN_CARACTERES_CONTRASENA, {
    message: `La contraseña debe tener al menos ${MIN_CARACTERES_CONTRASENA} caracteres`,
  })
  .refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_BYTES_BCRYPT, {
    message: `La contraseña no puede superar ${MAX_BYTES_BCRYPT} bytes (unos 72 caracteres sin tildes ni emojis)`,
  });

/** Contraseña que se comprueba (login, actual): sin política, solo un tope para no procesar textos enormes. */
const contrasenaEscrita = texto.pipe(z.string().min(1, 'Ingresa tu contraseña').max(256));

const nombre = (campo: string) => textoSeguro().trim().min(1, `Ingresa tus ${campo}`).max(80);

export const registroSchema = z.object({
  nombres: nombre('nombres'),
  apellidos: nombre('apellidos'),
  correo,
  contrasena: contrasenaNueva,
});

export const loginSchema = z.object({ correo, contrasena: contrasenaEscrita });

export const recuperarSchema = z.object({ correo });

export const restablecerSchema = z.object({
  token: z.string().min(1).max(100),
  contrasena: contrasenaNueva,
});

export const actualizarPerfilSchema = z.object({
  nombres: nombre('nombres'),
  apellidos: nombre('apellidos'),
  ciudad: textoSeguro().trim().max(60).nullable().optional(),
  biografia: textoSeguro().trim().max(300).nullable().optional(),
});

export const cambiarContrasenaSchema = z.object({
  actual: contrasenaEscrita,
  nueva: contrasenaNueva,
});

export type RegistroDto = z.infer<typeof registroSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RecuperarDto = z.infer<typeof recuperarSchema>;
export type RestablecerDto = z.infer<typeof restablecerSchema>;
export type ActualizarPerfilDto = z.infer<typeof actualizarPerfilSchema>;
export type CambiarContrasenaDto = z.infer<typeof cambiarContrasenaSchema>;
