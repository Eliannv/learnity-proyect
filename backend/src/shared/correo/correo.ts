import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { enviarConGmail } from './gmail.js';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/**
 * Envía un correo con el transporte configurado:
 *  - gmail: Gmail API desde el backend (OAuth 2.0 de la cuenta emisora, alcance gmail.send).
 *  - buzon: escribe el mensaje en BUZON_DIR como JSON. Es el buzón de prueba de desarrollo y de las pruebas automáticas.
 */
export async function enviarCorreo(correo: Correo): Promise<void> {
  if (env.CORREO_TRANSPORTE === 'gmail') {
    await enviarConGmail(correo);
    return;
  }
  const carpeta = path.resolve(env.BUZON_DIR);
  await mkdir(carpeta, { recursive: true });
  const nombre = `${Date.now()}-${randomUUID()}.json`;
  await writeFile(path.join(carpeta, nombre), JSON.stringify({ ...correo, enviadoEn: new Date().toISOString() }, null, 2));
}
