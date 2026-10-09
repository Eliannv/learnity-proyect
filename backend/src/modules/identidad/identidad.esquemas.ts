import { z } from 'zod';

// Esquemas de entrada (DTO) del módulo Identidad. Se validan en routes con `validarCuerpo`.

const correo = z.email('Correo no válido').max(120).transform((c) => c.trim().toLowerCase());
const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72);

export const registroSchema = z.object({
  nombres: z.string().trim().min(1, 'Ingresa tus nombres').max(80),
  apellidos: z.string().trim().min(1, 'Ingresa tus apellidos').max(80),
  correo,
  contrasena,
});

export const loginSchema = z.object({
  correo,
  contrasena: z.string().min(1, 'Ingresa tu contraseña'),
});

export const recuperarSchema = z.object({ correo });

export const restablecerSchema = z.object({
  token: z.string().min(1),
  contrasena,
});

export const actualizarPerfilSchema = z.object({
  nombres: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().min(1).max(80),
  ciudad: z.string().trim().max(60).nullable().optional(),
  biografia: z.string().trim().max(300).nullable().optional(),
});

export const cambiarContrasenaSchema = z.object({
  actual: z.string().min(1),
  nueva: contrasena,
});

export type RegistroDto = z.infer<typeof registroSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RecuperarDto = z.infer<typeof recuperarSchema>;
export type RestablecerDto = z.infer<typeof restablecerSchema>;
export type ActualizarPerfilDto = z.infer<typeof actualizarPerfilSchema>;
export type CambiarContrasenaDto = z.infer<typeof cambiarContrasenaSchema>;
