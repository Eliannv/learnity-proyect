import { env } from '../config/env.js';
import { transporteBuzon } from './buzon.js';
import { transporteGmail } from './gmail.js';
import type { TransporteCorreo } from './transporte.js';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/** El compilador exige un transporte por cada valor de CORREO_TRANSPORTE (env.ts). */
const TRANSPORTES: Record<typeof env.CORREO_TRANSPORTE, TransporteCorreo> = {
  gmail: transporteGmail,
  buzon: transporteBuzon,
};

/**
 * Envía un correo con el transporte configurado:
 *  - gmail: Gmail API desde el backend (OAuth 2.0 de la cuenta emisora, alcance gmail.send).
 *  - buzon: escribe el mensaje en BUZON_DIR como JSON. Es el buzón de prueba de desarrollo y de las pruebas automáticas.
 */
export const enviarCorreo = (correo: Correo): Promise<void> => TRANSPORTES[env.CORREO_TRANSPORTE].enviar(correo);
