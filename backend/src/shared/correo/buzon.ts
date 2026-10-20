import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import type { Correo } from './correo.js';
import type { TransporteCorreo } from './transporte.js';

/** Buzón de prueba de desarrollo y de las pruebas automáticas: escribe el mensaje en BUZON_DIR como JSON. */
export const transporteBuzon: TransporteCorreo = {
  async enviar(correo: Correo): Promise<void> {
    const carpeta = path.resolve(env.BUZON_DIR);
    await mkdir(carpeta, { recursive: true });
    const nombre = `${Date.now()}-${randomUUID()}.json`;
    await writeFile(path.join(carpeta, nombre), JSON.stringify({ ...correo, enviadoEn: new Date().toISOString() }, null, 2));
  },
};
