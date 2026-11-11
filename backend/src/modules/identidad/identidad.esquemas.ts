import { z } from 'zod';
import { MAX_BYTES_BCRYPT } from '../../shared/auth/contrasena.js';
import { esUrlFotoExterna } from '../../shared/archivos/fotos.js';
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

function fechaNacimientoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anioStr, mesStr, diaStr] = valor.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return false;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  return valor >= '1900-01-01' && valor <= hoy;
}

const fechaNacimientoOpcional = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((valor) => (valor && valor.length > 0 ? valor : null))
  .refine((valor) => valor === null || fechaNacimientoValida(valor), {
    message: 'Ingresa una fecha de nacimiento válida y no futura (AAAA-MM-DD).',
  });

export const actualizarPerfilSchema = z.object({
  nombres: nombre('nombres'),
  apellidos: nombre('apellidos'),
  pais: textoSeguro().trim().max(60).nullable().optional(),
  provincia: textoSeguro().trim().max(60).nullable().optional(),
  ciudad: textoSeguro().trim().max(60).nullable().optional(),
  fechaNacimiento: fechaNacimientoOpcional,
  biografia: textoSeguro().trim().max(300).nullable().optional(),
});

export const solicitarCambioCorreoSchema = z
  .object({
    correo: correo.optional(),
    nuevoCorreo: correo.optional(),
    contrasenaActual: contrasenaEscrita.optional(),
  })
  .refine((d) => Boolean(d.correo ?? d.nuevoCorreo), {
    path: ['nuevoCorreo'],
    message: 'Correo no válido',
  })
  .transform((d) => ({
    correo: (d.correo ?? d.nuevoCorreo)!,
    contrasenaActual: d.contrasenaActual,
  }));

export const confirmarCambioCorreoSchema = z.object({
  token: z.string().trim().min(1, 'El enlace de confirmación no es válido.').max(120),
});

/** Foto de perfil por enlace: solo `https://` externo (ver `esUrlFotoExterna`). */
export const fotoUrlSchema = z.strictObject({
  fotoUrl: z.string().trim().max(255).refine(esUrlFotoExterna, 'Indica un enlace https:// a una imagen (máx. 255 caracteres).'),
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
export type SolicitarCambioCorreoDto = z.infer<typeof solicitarCambioCorreoSchema>;
export type ConfirmarCambioCorreoDto = z.infer<typeof confirmarCambioCorreoSchema>;
