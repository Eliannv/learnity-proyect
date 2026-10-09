import type { AbstractControl, ValidationErrors } from '@angular/forms';

// Política de contraseña: la misma que aplica la API (backend/src/modules/identidad/identidad.esquemas.ts).
// Al menos 15 caracteres, como máximo 72 bytes (límite de bcrypt) y sin reglas de composición:
// una frase de varias palabras es la mejor opción. La API además rechaza contraseñas comunes,
// basadas en tu nombre o correo, y las expuestas en filtraciones de datos.

export const MIN_CARACTERES_CONTRASENA = 15;
export const MAX_BYTES_CONTRASENA = 72;

const normalizar = (valor: unknown) => String(valor ?? '').normalize('NFKC');

export const caracteresDe = (valor: unknown) => Array.from(normalizar(valor)).length;

export function politicaContrasena(control: AbstractControl): ValidationErrors | null {
  const valor = normalizar(control.value);
  if (!valor) return null;
  if (Array.from(valor).length < MIN_CARACTERES_CONTRASENA) return { contrasenaCorta: true };
  if (new TextEncoder().encode(valor).length > MAX_BYTES_CONTRASENA) return { contrasenaLarga: true };
  return null;
}

export function mensajeContrasena(errores: ValidationErrors | null): string {
  if (!errores) return '';
  if (errores['required']) return 'Escribe una contraseña.';
  if (errores['contrasenaCorta']) return `Usa al menos ${MIN_CARACTERES_CONTRASENA} caracteres. Una frase de varias palabras es ideal.`;
  if (errores['contrasenaLarga']) return 'Es demasiado larga: máximo 72 bytes (unos 72 caracteres sin tildes ni emojis).';
  if (errores['servidor']) return errores['servidor'] as string;
  return '';
}

export const AYUDA_CONTRASENA =
  'Mínimo 15 caracteres. Puedes usar espacios: por ejemplo, una frase que solo tú recuerdes. No uses tu nombre ni una contraseña de otro sitio.';
