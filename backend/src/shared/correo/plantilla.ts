import { registrarEvento } from '../log/registro.js';
import { enviarCorreo, type Correo } from './correo.js';

// Piezas comunes de los correos de Learnity. Nunca incluyen contraseñas, tokens de sesión ni datos de terceros.

export const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function marco(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#1d4ed8">Learnity</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapar(titulo)}</h1>
${cuerpo}
</td></tr></table></td></tr></table></body></html>`;
}

export const parrafo = (html: string) => `<p style="margin:0 0 16px;line-height:1.5">${html}</p>`;

export const boton = (texto: string, enlace: string) =>
  `<p style="margin:0 0 24px"><a href="${escapar(enlace)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escapar(texto)}</a></p>`;

export const cita = (texto: string) =>
  `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:4px solid #94a3b8;background:#f8fafc;line-height:1.5">${escapar(texto)}</blockquote>`;

const pendientes = new Set<Promise<void>>();

/**
 * Envía un aviso después de confirmar la operación, sin hacer esperar a quien la pidió.
 * Un fallo del transporte no deshace nada: queda en el registro como `correo_<nombre>_fallo`.
 */
export function notificar(nombre: string, correo: Correo): void {
  const tarea = enviarCorreo(correo)
    .catch((error: unknown) => registrarEvento(`correo_${nombre}_fallo`, { motivo: (error as Error).message }, 'error'))
    .finally(() => pendientes.delete(tarea));
  pendientes.add(tarea);
}

/** Para las pruebas y el cierre ordenado: espera a que salgan los avisos en curso. */
export async function esperarNotificaciones(): Promise<void> {
  await Promise.all([...pendientes]);
}
