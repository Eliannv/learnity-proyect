import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import type { Correo } from './correo.js';

// Gmail API (users.messages.send) con OAuth 2.0 de servidor.
// La cuenta emisora autoriza una sola vez (npm run correo:autorizar) y el backend guarda su
// refresh token en .env (fuera de Git). Alcance mínimo: https://www.googleapis.com/auth/gmail.send
// Los estudiantes no autorizan nada: solo reciben el correo.

export const ALCANCE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_ENVIO = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

let accessToken: { valor: string; vence: number } | null = null;

async function obtenerAccessToken(): Promise<string> {
  if (accessToken && accessToken.vence > Date.now() + 60_000) return accessToken.valor;
  const respuesta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID ?? '',
      client_secret: env.GMAIL_CLIENT_SECRET ?? '',
      refresh_token: env.GMAIL_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const datos = (await respuesta.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!respuesta.ok || !datos.access_token) {
    // Solo el código de error de Google: nunca el cuerpo completo ni las credenciales.
    throw new Error(`Gmail OAuth rechazó el refresh token (${datos.error ?? respuesta.status})`);
  }
  accessToken = { valor: datos.access_token, vence: Date.now() + (datos.expires_in ?? 3600) * 1000 };
  return accessToken.valor;
}

/** Quita saltos de línea: impide inyectar encabezados en el mensaje. */
const sinSaltos = (texto: string) => texto.replace(/[\r\n]+/g, ' ').trim();
const encabezadoUtf8 = (texto: string) => `=?UTF-8?B?${Buffer.from(sinSaltos(texto), 'utf8').toString('base64')}?=`;
const base64Lineas = (texto: string) => Buffer.from(texto, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');

/** Mensaje MIME (RFC 5322) con versión de texto y HTML. */
export function construirMime(correo: Correo, remitente: string, nombreRemitente: string): string {
  const limite = `learnity-${randomBytes(12).toString('hex')}`;
  return [
    `From: ${encabezadoUtf8(nombreRemitente)} <${sinSaltos(remitente)}>`,
    `To: <${sinSaltos(correo.para)}>`,
    `Subject: ${encabezadoUtf8(correo.asunto)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lineas(correo.texto),
    `--${limite}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lineas(correo.html),
    `--${limite}--`,
    '',
  ].join('\r\n');
}

export async function enviarConGmail(correo: Correo): Promise<void> {
  const mime = construirMime(correo, env.GMAIL_REMITENTE ?? '', env.GMAIL_NOMBRE_REMITENTE);
  const respuesta = await fetch(URL_ENVIO, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await obtenerAccessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mime, 'utf8').toString('base64url') }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!respuesta.ok) {
    const datos = (await respuesta.json().catch(() => ({}))) as { error?: { status?: string } };
    throw new Error(`Gmail API respondió ${respuesta.status} (${datos.error?.status ?? 'sin detalle'})`);
  }
}
